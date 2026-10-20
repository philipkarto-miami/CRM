import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SkuDesignForm } from "@/components/SkuDesignForm";
import { SavedToast } from "@/components/SavedToast";
import { MIGRATION_0029_MESSAGE, deriveDesign, fetchAllRows } from "@/lib/catalogue";
import { COLOR_NONE, type DesignRow } from "@/lib/sku";

type CatalogRow = {
  sku: string;
  design: string | null;
  bag_model_id: string | null;
  color_code: string | null;
  edition: string | null;
  photo_path: string | null;
  photo_path_back: string | null;
};

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

  const [catalog, { data: models }] = await Promise.all([
    fetchAllRows<CatalogRow>((from, to) =>
      supabase
        .from("sku_catalog")
        .select("sku, design, bag_model_id, color_code, edition, photo_path, photo_path_back")
        .order("sku")
        .range(from, to)
    ),
    supabase.from("bag_models").select("id, name, base_size, brands(name)").order("sort_order"),
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

  // Photos : une paire recto/verso par couleur (la premiere trouvee dans le
  // groupe de couleur ; l'enregistrement les applique a tous les codes).
  const photoPathsByColor = new Map<string, { front: string | null; back: string | null }>();
  for (const r of designCodes) {
    const key = r.color_code ?? COLOR_NONE;
    const current = photoPathsByColor.get(key) ?? { front: null, back: null };
    photoPathsByColor.set(key, {
      front: current.front ?? r.photo_path,
      back: current.back ?? r.photo_path_back,
    });
  }

  const signed = new Map<string, string>();
  const paths = new Set<string>();
  for (const p of photoPathsByColor.values()) {
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
  for (const [key, p] of photoPathsByColor) {
    photos[key] = {
      front: p.front ? signed.get(p.front) ?? null : null,
      back: p.back ? signed.get(p.back) ?? null : null,
    };
  }

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
        bagsCount={bagsCount ?? 0}
        ordersCount={ordersCount ?? 0}
        error={searchParams?.error}
      />
    </>
  );
}
