"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

// Cree une nouvelle etape de fabrication (globale, disponible pour tous les
// SKU ensuite) depuis l'editeur du catalogue. Reserve aux admins (meme regle
// que la page Reglages > Etapes de fabrication).
export async function createCustomStep(
  name: string,
  phase: StagePhase
): Promise<{ error?: string; code?: string; id?: string }> {
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
  formData: FormData
): Promise<string | null> {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${sku}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("sku-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });

  if (error) throw new Error(error.message);
  return path;
}

export async function createSkuCatalogEntry(formData: FormData): Promise<void> {
  const supabase = createClient();
  const sku = str(formData, "sku")?.trim().toUpperCase();
  if (!sku) {
    redirect(`/catalogue/new?error=${encodeURIComponent("Le SKU est obligatoire")}`);
  }

  const photoPath = await uploadPhotoIfPresent(supabase, sku as string, formData);

  const payload = {
    sku,
    edition: str(formData, "edition"),
    description: str(formData, "description"),
    // Le modele PK (ce SKU) transforme toujours un seul modele fournisseur
    // precis : c'est ce qui permettra a la vente de retrouver le bon stock.
    bag_model_id: str(formData, "bag_model_id"),
    steps: readSteps(formData),
    photo_path: photoPath,
  };

  const { error } = await supabase.from("sku_catalog").insert(payload);
  if (error) {
    redirect(`/catalogue/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/catalogue");
  redirect(`/catalogue/${sku}`);
}

export async function updateSkuCatalogEntry(sku: string, formData: FormData) {
  const supabase = createClient();

  const photoPath = await uploadPhotoIfPresent(supabase, sku, formData);

  const payload: Record<string, unknown> = {
    edition: str(formData, "edition"),
    description: str(formData, "description"),
    bag_model_id: str(formData, "bag_model_id"),
    steps: readSteps(formData),
  };
  if (photoPath) payload.photo_path = photoPath;

  await supabase.from("sku_catalog").update(payload).eq("sku", sku);
  revalidatePath("/catalogue");
  revalidatePath(`/catalogue/${sku}`);
}

export async function deleteSkuCatalogEntry(sku: string) {
  const supabase = createClient();
  await supabase.from("sku_catalog").delete().eq("sku", sku);
  revalidatePath("/catalogue");
  redirect("/catalogue");
}
