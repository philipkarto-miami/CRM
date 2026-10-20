import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SkuDesignForm } from "@/components/SkuDesignForm";
import { SavedToast } from "@/components/SavedToast";
import { MIGRATION_0029_MESSAGE, deriveDesign, fetchAllRows } from "@/lib/catalogue";
import { COLOR_NONE, photoGroupOf, type DesignRow } from "@/lib/sku";
import { toRecipeSteps } from "@/lib/stages";

type CatalogRow = {
  sku: string;
  design: string | null;
  bag_model_id: string | null;
  color_code: string | null;
  edition: string | null;
  photo_path: string | null;
  photo_path_back: string | null;
  steps: Record<string, number | string> | null;
};

// Cle stable d'une recette (pour comparer deux recettes entre elles).
function recipeKey(steps: Record<string, number | string> | null): string {
  return JSON.stringify(Object.entries(steps ?? {}).sort(([a], [b]) => a.localeCompare(b)));
}

// Fiche d'un design : tous ses codes PK, avec deux listes de cases (modeles,
// couleurs) pour creer ou retirer des codes d'un coup, les photos recto/verso
// par couleur et le renommage de l'acronyme.
export default async function SkuDesignPage({
  params,
  searchParams,
}: {
  params: { design: string };
  searchParams: { error?: string };
}) {
  const design = decodeURIComponent(params.design);
  const supabase = createClient();

  const [catalog, { data: models }, { data: stages }] = await Promise.all([
    fetchAllRows<CatalogRow>((from, to) =>
      supabase
        .from("sku_catalog")
        .select("sku, design, bag_model_id, color_code, edition, photo_path, photo_path_back, steps")
        .order("sku")
        .range(from, to)
    ),
    supabase.from("bag_models").select("id, name, base_size, brands(name)").order("sort_order"),
    supabase
      .from("production_stages")
      .select("name, catalog_column, phase, order_index")
      .not("catalog_column", "is", null)
      .eq("is_active", true)
      .order("phase")
      .order("order_index"),
  ]);

  // Colonnes `design` / `color_code` absentes : la migration 0029 n'a pas ete
  // lancee. La gestion en fiche en depend, on l'explique au lieu d'echouer.
  if (catalog.error) {
    return (
      <div>
        <p className="text-xs uppercase tracking-widest2 text-gold">
          <Link href="/catalogue" className="text-paper/45 hover:text-gold">
            Catalogue
          </Link>{" "}
          <span className="text-paper/45">/</span> PK{design}
        </p>
        <h2 className="mt-0.5 font-serif text-2xl text-paper">PK{design}</h2>
        <p className="mt-4 max-w-xl rounded-sm border border-line bg-gold/5 px-3.5 py-2.5 text-sm text-paper/70">
          {MIGRATION_0029_MESSAGE}
        </p>
        <p className="mt-2 text-xs text-paper/40">Detail technique : {catalog.error}</p>
      </div>
    );
  }

  const designCodes = catalog.rows.filter((r) => (r.design ?? deriveDesign(r.sku)) === design);
  if (designCodes.length === 0) notFound();

  const codes = designCodes.map((r) => r.sku);

  const rows: DesignRow[] = designCodes.map((r) => ({
    sku: r.sku,
    modelId: r.bag_model_id,
    colorCode: r.color_code,
  }));

  // Photos : une paire recto/verso par (couleur x groupe de modeles), cle
  // "<couleur>__<groupe>" (la premiere trouvee ; l'enregistrement l'applique a
  // tous les codes du groupe et de la couleur). Les codes sans modele rattache
  // n'entrent dans aucun groupe.
  const modelById = new Map((models ?? []).map((m) => [m.id as string, m]));
  const photoPathsBySlot = new Map<string, { front: string | null; back: string | null }>();
  for (const r of designCodes) {
    const model = r.bag_model_id ? modelById.get(r.bag_model_id) : undefined;
    const group = model ? photoGroupOf(model.name as string, model.base_size as string | null) : null;
    if (!group) continue;
    const key = `${r.color_code ?? COLOR_NONE}__${group}`;
    const current = photoPathsBySlot.get(key) ?? { front: null, back: null };
    photoPathsBySlot.set(key, {
      front: current.front ?? r.photo_path,
      back: current.back ?? r.photo_path_back,
    });
  }

  const signed = new Map<string, string>();
  const paths = new Set<string>();
  for (const p of photoPathsBySlot.values()) {
    if (p.front) paths.add(p.front);
    if (p.back) paths.add(p.back);
  }
  if (paths.size > 0) {
    const { data } = await supabase.storage.from("sku-photos").createSignedUrls([...paths], 3600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
  }

  const photos: Record<string, { front: string | null; back: string | null }> = {};
  for (const [key, p] of photoPathsBySlot) {
    photos[key] = {
      front: p.front ? signed.get(p.front) ?? null : null,
      back: p.back ? signed.get(p.back) ?? null : null,
    };
  }

  // Recettes : une par couleur, commune a toutes les tailles/modeles. Si les
  // codes d'une couleur n'ont pas tous la meme recette (heritage), on propose
  // la plus courante et on le signale : l'enregistrement les alignera.
  const recipeGroups = new Map<string, Map<string, { count: number; steps: Record<string, number | string> }>>();
  for (const r of designCodes) {
    const key = r.color_code ?? COLOR_NONE;
    const variants = recipeGroups.get(key) ?? new Map();
    const rk = recipeKey(r.steps);
    const entry = variants.get(rk) ?? { count: 0, steps: r.steps ?? {} };
    entry.count += 1;
    variants.set(rk, entry);
    recipeGroups.set(key, variants);
  }
  const recipes: Record<string, Record<string, number | string>> = {};
  const divergentColors: string[] = [];
  for (const [key, variants] of recipeGroups) {
    const sorted = [...variants.values()].sort((a, b) => b.count - a.count);
    recipes[key] = sorted[0].steps;
    if (sorted.length > 1) divergentColors.push(key);
  }
  // Une couleur ajoutee dans la fiche demarre avec la recette du premier code
  // (c'est aussi celle que recopie l'enregistrement pour les nouveaux codes).
  const referenceRecipe = designCodes[0].steps ?? {};

  // Usage des codes (pour le renommage) : sacs et commandes concernes.
  const [{ count: bagsCount }, { count: ordersCount }] = await Promise.all([
    supabase.from("bags").select("id", { count: "exact", head: true }).in("sku", codes),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("desired_sku", codes),
  ]);

  const modelOptions = (models ?? []).map((m) => {
    const brand = Array.isArray(m.brands) ? m.brands[0] : m.brands;
    return {
      id: m.id as string,
      brand: (brand?.name as string | undefined) ?? "",
      name: m.name as string,
      baseSize: (m.base_size as string | null) ?? null,
    };
  });

  return (
    <>
      <SavedToast />
      <SkuDesignForm
        design={design}
        edition={designCodes.find((r) => r.edition)?.edition ?? null}
        models={modelOptions}
        rows={rows}
        allSkus={catalog.rows.map((r) => r.sku)}
        photos={photos}
        stepOptions={toRecipeSteps(stages ?? [])}
        recipes={recipes}
        divergentColors={divergentColors}
        referenceRecipe={referenceRecipe}
        bagsCount={bagsCount ?? 0}
        ordersCount={ordersCount ?? 0}
        error={searchParams?.error}
      />
    </>
  );
}
