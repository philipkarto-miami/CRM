"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  COLOR_NONE,
  generateSkuVariants,
  isSkuColorCode,
  normalizeDesign,
  PHOTO_GROUPS,
  photoGroupOf,
  planDesignChanges,
  sizeCode,
  type DesignModel,
  type SkuModelInput,
} from "@/lib/sku";
import type { StagePhase } from "@/types/database";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

// Lit tous les champs "step_<CODE>" presents dans le formulaire (le nombre
// d'etapes n'est plus fixe : de nouvelles etapes peuvent avoir ete creees a
// la volee depuis l'editeur de SKU). Case vide/absente = etape ignoree,
// nombre = position dans la sequence, texte = note de sous-traitance.
function readSteps(formData: FormData): Record<string, number | string> {
  const steps: Record<string, number | string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("step_") || typeof value !== "string") continue;
    const raw = value.trim();
    if (!raw) continue;
    const code = key.slice("step_".length);
    const n = Number(raw);
    steps[code] = Number.isFinite(n) && raw === String(n) ? n : raw;
  }
  return steps;
}

// Recettes saisies dans la fiche design : une par couleur, champs
// "recipe__<COULEUR>__<ETAPE>". Seules les couleurs marquees "recipe_touched__"
// sont renvoyees (une recette videe n'envoie aucun champ d'etape : le marqueur
// permet de la distinguer d'une recette non modifiee).
function readColorRecipes(formData: FormData, colorKeys: string[]): Map<string, Record<string, number | string>> {
  const recipes = new Map<string, Record<string, number | string>>();
  for (const key of colorKeys) {
    if (formData.get(`recipe_touched__${key}`) === "1") recipes.set(key, {});
  }
  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const match = /^recipe__([A-Z0-9]+)__(.+)$/.exec(name);
    if (!match) continue;
    const target = recipes.get(match[1]);
    if (!target) continue;
    const raw = value.trim();
    if (!raw) continue;
    const n = Number(raw);
    target[match[2]] = Number.isFinite(n) && raw === String(n) ? n : raw;
  }
  return recipes;
}

// Cree une nouvelle etape de fabrication (globale, disponible pour tous les
// SKU ensuite) depuis l'editeur du catalogue. Reserve aux admins (meme regle
// que la page Reglages > Etapes de fabrication). Seule la phase Fabrication
// est choisissable par SKU : les autres phases sont fixes.
export async function createCustomStep(
  name: string
): Promise<{ error?: string; code?: string; id?: string }> {
  const phase: StagePhase = "manufacturing";
  const supabase = createClient();
  const cleanName = name.trim();
  if (!cleanName) return { error: "Le nom de l'etape est obligatoire" };

  const baseCode = cleanName
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const { data: existing } = await supabase.from("production_stages").select("catalog_column");
  const usedCodes = new Set((existing ?? []).map((s) => s.catalog_column).filter(Boolean));
  let code = baseCode || "ETAPE";
  let suffix = 2;
  while (usedCodes.has(code)) {
    code = `${baseCode}_${suffix}`;
    suffix += 1;
  }

  const { data: maxOrder } = await supabase
    .from("production_stages")
    .select("order_index")
    .eq("phase", phase)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("production_stages")
    .insert({
      phase,
      name: cleanName,
      order_index: (maxOrder?.order_index ?? 0) + 1,
      catalog_column: code,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/catalogue");
  revalidatePath("/settings/stages");
  return { code, id: data.id };
}

// Upload la photo (si presente dans le formulaire) et renvoie son chemin de
// stockage. Factorise entre creation et edition : la photo peut desormais
// etre deposee des la creation du code PK, pas seulement apres coup.
async function uploadPhotoIfPresent(
  supabase: ReturnType<typeof createClient>,
  sku: string,
  formData: FormData,
  field: string = "photo"
): Promise<string | null> {
  const file = formData.get(field) as File | null;
  if (!file || file.size === 0) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${sku}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("sku-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });

  if (error) throw new Error(error.message);
  return path;
}

function failNewSku(message: string): never {
  redirect(`/catalogue/new?error=${encodeURIComponent(message)}`);
}

// Creation d'un design : une saisie (acronyme + modeles coches + couleurs
// cochees) genere autant de codes PK que de combinaisons modele x couleur.
// Tous partagent la meme edition, description et recette de fabrication ;
// photos et ajustements se font ensuite code par code. Les codes deja presents
// dans le catalogue sont ignores (jamais ecrases).
export async function createSkuCatalogBatch(formData: FormData): Promise<void> {
  const supabase = createClient();

  const design = normalizeDesign(String(formData.get("design") ?? ""));
  if (!design) failNewSku("L'acronyme du design est obligatoire (lettres et chiffres uniquement).");

  const modelIds = formData.getAll("model_ids").map(String).filter(Boolean);
  if (modelIds.length === 0) failNewSku("Coche au moins un modele de sac.");

  const colorCodes = formData.getAll("colors").map(String).filter(isSkuColorCode);

  const { data: modelRows, error: modelError } = await supabase
    .from("bag_models")
    .select("id, name, base_size, sort_order, brands(name)")
    .in("id", modelIds);
  if (modelError) failNewSku(modelError.message);

  const models: SkuModelInput[] = (modelRows ?? [])
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .map((m) => {
      const brand = Array.isArray(m.brands) ? m.brands[0] : m.brands;
      return {
        id: m.id as string,
        name: m.name as string,
        label: [brand?.name, m.name, m.base_size].filter(Boolean).join(" "),
        baseSize: m.base_size as string | null,
      };
    });

  const withoutSize = models.find((m) => !sizeCode(m.baseSize));
  if (withoutSize) failNewSku(`Le modele « ${withoutSize.label} » n'a pas de taille : impossible de construire son code PK.`);

  const variants = generateSkuVariants(design, colorCodes, models);

  // Deux modeles ne doivent pas aboutir au meme code (ex : Speedy 30 et
  // Birkin 30 donnent tous deux ...30).
  const seen = new Map<string, string>();
  for (const v of variants) {
    const other = seen.get(v.sku);
    if (other) {
      failNewSku(`Le code ${v.sku} serait cree deux fois (${other} et ${v.modelLabel}). Cree ce design separement pour chacun de ces modeles.`);
    }
    seen.set(v.sku, v.modelLabel);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("sku_catalog")
    .select("sku")
    .in(
      "sku",
      variants.map((v) => v.sku)
    );
  if (existingError) failNewSku(existingError.message);

  const existing = new Set((existingRows ?? []).map((r) => r.sku as string));
  const toCreate = variants.filter((v) => !existing.has(v.sku));
  if (toCreate.length === 0) failNewSku("Tous ces codes PK existent deja dans le catalogue.");

  const steps = readSteps(formData);
  const edition = str(formData, "edition");
  const description = str(formData, "description");

  const { error } = await supabase.from("sku_catalog").insert(
    toCreate.map((v) => ({
      sku: v.sku,
      // Cle de regroupement en fiche + couleur : voir migration 0029.
      design,
      color_code: v.colorCode,
      edition,
      description,
      // Un code PK transforme toujours un seul modele fournisseur precis :
      // c'est ce qui permet de retrouver le bon stock a la vente.
      bag_model_id: v.modelId,
      steps,
    }))
  );
  if (error) {
    failNewSku(
      /design|color_code/.test(error.message)
        ? "La migration 0029_fiches_design_catalogue.sql n'est pas encore appliquee dans Supabase : lance-la dans l'editeur SQL, puis reessaie."
        : error.message
    );
  }

  const skipped = variants.length - toCreate.length;
  const message =
    `${toCreate.length} code${toCreate.length > 1 ? "s" : ""} PK cree${toCreate.length > 1 ? "s" : ""}` +
    (skipped > 0 ? ` · ${skipped} deja existant${skipped > 1 ? "s" : ""} ignore${skipped > 1 ? "s" : ""}` : "");

  revalidatePath("/catalogue");
  redirect(`/catalogue?q=${encodeURIComponent(`PK${design}`)}&saved=${encodeURIComponent(message)}`);
}

// Renomme l'acronyme d'un design, donc tous ses codes PK, ainsi que les sacs et
// commandes qui les utilisent (tout se fait dans la fonction SQL
// rename_sku_design, en une seule transaction : voir migration 0030).
export async function renameSkuDesign(formData: FormData): Promise<void> {
  const supabase = createClient();
  const design = String(formData.get("design") ?? "");
  if (!design) redirect("/catalogue");

  const ficheUrl = `/catalogue/design/${encodeURIComponent(design)}`;
  function fail(message: string): never {
    redirect(`${ficheUrl}?error=${encodeURIComponent(message)}`);
  }

  const newDesign = normalizeDesign(String(formData.get("new_design") ?? ""));
  if (!newDesign) fail("L'acronyme est obligatoire (lettres et chiffres uniquement).");
  if (newDesign === design) fail("C'est deja l'acronyme actuel.");

  const { data, error } = await supabase.rpc("rename_sku_design", { p_old: design, p_new: newDesign });
  if (error) {
    fail(
      /rename_sku_design|schema cache|find the function/i.test(error.message)
        ? "La migration 0030_renommer_design.sql n'est pas encore appliquee dans Supabase : lance-la dans l'editeur SQL, puis reessaie."
        : error.message
    );
  }

  const newUrl = `/catalogue/design/${encodeURIComponent(newDesign)}`;
  revalidatePath("/catalogue");
  revalidatePath(newUrl);
  redirect(`${newUrl}?saved=${encodeURIComponent(typeof data === "string" ? data : "Acronyme renomme")}`);
}

// Fiche d'un design existant : on coche des modeles et des couleurs, et on
// aligne le catalogue dessus. Les combinaisons (modele x couleur) manquantes
// sont creees (edition, description et recette recopiees d'un code existant du
// design) ; celles qu'on decoche sont supprimees, sauf si un sac utilise deja
// le code. Les codes sans modele rattache ne sont jamais touches.
export async function saveSkuDesign(formData: FormData): Promise<void> {
  const supabase = createClient();
  const design = String(formData.get("design") ?? "");
  if (!design) redirect("/catalogue");

  const ficheUrl = `/catalogue/design/${encodeURIComponent(design)}`;
  function fail(message: string): never {
    redirect(`${ficheUrl}?error=${encodeURIComponent(message)}`);
  }

  const modelIds = formData.getAll("model_ids").map(String).filter(Boolean);
  const colorKeys = formData
    .getAll("colors")
    .map(String)
    .filter((c) => c === COLOR_NONE || isSkuColorCode(c));
  if (modelIds.length === 0) fail("Coche au moins un modele de sac.");
  if (colorKeys.length === 0) fail("Coche au moins une couleur (ou « Sans couleur »).");

  const [{ data: rowData }, { data: modelRows }] = await Promise.all([
    supabase.from("sku_catalog").select("*").eq("design", design).order("sku"),
    supabase.from("bag_models").select("id, name, base_size, sort_order, brands(name)"),
  ]);
  const rows = rowData ?? [];
  if (rows.length === 0) redirect("/catalogue");

  const models: DesignModel[] = (modelRows ?? [])
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .map((m) => {
      const brand = Array.isArray(m.brands) ? m.brands[0] : m.brands;
      return {
        id: m.id as string,
        name: m.name as string,
        label: [brand?.name, m.name, m.base_size].filter(Boolean).join(" "),
        baseSize: m.base_size as string | null,
      };
    });

  const designRows = rows.map((r) => ({
    sku: r.sku as string,
    modelId: (r.bag_model_id ?? null) as string | null,
    colorCode: (r.color_code ?? null) as string | null,
  }));
  const planArgs = { design, rows: designRows, models, selectedModelIds: modelIds, selectedColorKeys: colorKeys };

  // Premier passage pour connaitre les codes a creer, puis on verifie lesquels
  // existent deja ailleurs dans le catalogue (autre design) pour ne rien ecraser.
  const firstPass = planDesignChanges({ ...planArgs, allSkus: new Set() });
  let taken = new Set<string>();
  if (firstPass.create.length > 0) {
    const { data } = await supabase
      .from("sku_catalog")
      .select("sku")
      .in(
        "sku",
        firstPass.create.map((c) => c.sku)
      );
    taken = new Set((data ?? []).map((r) => r.sku as string));
  }
  const plan = planDesignChanges({ ...planArgs, allSkus: taken });

  // Photos : une paire recto/verso par (groupe de modeles x couleur), partagee
  // par tous les codes du groupe (ex : Speedy 35 et 40). Un nouveau code reprend
  // celle de son groupe et de sa couleur, s'il y en a une.
  const modelById = new Map(models.map((m) => [m.id, m]));
  const groupOfModel = (modelId: string | null): string | null => {
    const m = modelId ? modelById.get(modelId) : undefined;
    return m ? photoGroupOf(m.name, m.baseSize) : null;
  };
  const slotKey = (colorKey: string, groupKey: string) => `${colorKey}__${groupKey}`;

  const photoBySlot = new Map<string, { front: string | null; back: string | null }>();
  for (const r of rows) {
    const group = groupOfModel((r.bag_model_id ?? null) as string | null);
    if (!group) continue;
    const key = slotKey((r.color_code ?? COLOR_NONE) as string, group);
    const current = photoBySlot.get(key) ?? { front: null, back: null };
    photoBySlot.set(key, {
      front: current.front ?? (r.photo_path as string | null) ?? null,
      back: current.back ?? (r.photo_path_back as string | null) ?? null,
    });
  }

  const reference = rows[0];
  if (plan.create.length > 0) {
    const { error } = await supabase.from("sku_catalog").insert(
      plan.create.map((c) => {
        const group = groupOfModel(c.modelId);
        const photos = group ? photoBySlot.get(slotKey(c.colorCode ?? COLOR_NONE, group)) : undefined;
        return {
          sku: c.sku,
          design,
          color_code: c.colorCode,
          edition: reference.edition ?? null,
          description: reference.description ?? null,
          bag_model_id: c.modelId,
          steps: reference.steps ?? {},
          photo_path: photos?.front ?? null,
          photo_path_back: photos?.back ?? null,
        };
      })
    );
    if (error) fail(error.message);
  }

  let removed = 0;
  let blocked = 0;
  if (plan.remove.length > 0) {
    const codes = plan.remove.map((r) => r.sku);
    const { data: used } = await supabase.from("bags").select("sku").in("sku", codes);
    const inUse = new Set((used ?? []).map((b) => b.sku as string));
    const deletable = codes.filter((c) => !inUse.has(c));
    blocked = codes.length - deletable.length;
    if (deletable.length > 0) {
      const { error } = await supabase.from("sku_catalog").delete().in("sku", deletable);
      if (error) fail(error.message);
      removed = deletable.length;
    }
  }

  // Photos deposees dans la fiche (champs photo__<couleur>__<groupe> et
  // photo_back__<couleur>__<groupe>) : appliquees a tous les codes de la couleur
  // dont le modele fait partie du groupe (y compris ceux qui viennent d'etre
  // crees ci-dessus).
  let photosSaved = 0;
  for (const colorKey of colorKeys) {
    for (const group of PHOTO_GROUPS) {
      const field = slotKey(colorKey, group.key);
      const payload: Record<string, string> = {};
      try {
        const front = await uploadPhotoIfPresent(supabase, `${design}-${field}`, formData, `photo__${field}`);
        const back = await uploadPhotoIfPresent(supabase, `${design}-${field}`, formData, `photo_back__${field}`);
        if (front) payload.photo_path = front;
        if (back) payload.photo_path_back = back;
      } catch (e) {
        fail(e instanceof Error ? e.message : "Envoi de la photo impossible.");
      }
      if (Object.keys(payload).length === 0) continue;

      const groupModelIds = models.filter((m) => photoGroupOf(m.name, m.baseSize) === group.key).map((m) => m.id);
      if (groupModelIds.length === 0) continue;

      let query = supabase
        .from("sku_catalog")
        .update(payload)
        .eq("design", design)
        .in("bag_model_id", groupModelIds);
      query = colorKey === COLOR_NONE ? query.is("color_code", null) : query.eq("color_code", colorKey);
      const { error } = await query;
      if (error) fail(error.message);
      photosSaved += Object.keys(payload).length;
    }
  }

  // Recettes de fabrication : une par couleur, commune a tous les modeles et
  // tailles du design (seule la couleur change le travail). On l'applique a
  // tous les codes de la couleur, y compris ceux qui viennent d'etre crees.
  const recipes = readColorRecipes(formData, colorKeys);
  let recipesSaved = 0;
  for (const [key, steps] of recipes) {
    let query = supabase.from("sku_catalog").update({ steps }).eq("design", design);
    query = key === COLOR_NONE ? query.is("color_code", null) : query.eq("color_code", key);
    const { error } = await query;
    if (error) fail(error.message);
    recipesSaved += 1;
  }

  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  const parts: string[] = [];
  if (plan.create.length > 0) parts.push(plural(plan.create.length, "code cree", "codes crees"));
  if (removed > 0) parts.push(plural(removed, "code supprime", "codes supprimes"));
  if (photosSaved > 0) parts.push(plural(photosSaved, "photo enregistree", "photos enregistrees"));
  if (recipesSaved > 0) parts.push(plural(recipesSaved, "recette enregistree", "recettes enregistrees"));
  if (blocked > 0) parts.push(plural(blocked, "code garde (utilise par des sacs)", "codes gardes (utilises par des sacs)"));
  if (plan.conflicts.length > 0) {
    parts.push(plural(plan.conflicts.length, "code deja existant ailleurs ignore", "codes deja existants ailleurs ignores"));
  }
  const message = parts.length > 0 ? parts.join(" · ") : "Aucun changement";

  revalidatePath("/catalogue");
  revalidatePath(ficheUrl);
  redirect(`${ficheUrl}?saved=${encodeURIComponent(message)}`);
}

export async function updateSkuCatalogEntry(sku: string, formData: FormData) {
  const supabase = createClient();

  // La recette (steps) et les photos ne sont plus modifiables code par code :
  // elles sont communes a un groupe de modeles / une couleur et se reglent dans
  // la fiche du design.
  const payload: Record<string, unknown> = {
    edition: str(formData, "edition"),
    description: str(formData, "description"),
    bag_model_id: str(formData, "bag_model_id"),
  };

  await supabase.from("sku_catalog").update(payload).eq("sku", sku);
  revalidatePath("/catalogue");
  revalidatePath(`/catalogue/${sku}`);
  redirect(`/catalogue/${sku}?saved=${encodeURIComponent("Modifications enregistrees")}`);
}

export async function deleteSkuCatalogEntry(sku: string) {
  const supabase = createClient();
  await supabase.from("sku_catalog").delete().eq("sku", sku);
  revalidatePath("/catalogue");
  redirect("/catalogue");
}
