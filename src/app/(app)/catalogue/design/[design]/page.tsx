import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SkuDesignForm } from "@/components/SkuDesignForm";
import { SavedToast } from "@/components/SavedToast";
import { deriveDesign, fetchAllRows } from "@/lib/catalogue";
import type { DesignRow } from "@/lib/sku";

type CatalogRow = {
  sku: string;
  design: string | null;
  bag_model_id: string | null;
  color_code: string | null;
  edition: string | null;
};

// Fiche d'un design : tous ses codes PK, avec deux listes de cases (modeles,
// couleurs) pour creer ou retirer des codes d'un coup.
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
      supabase.from("sku_catalog").select("sku, design, bag_model_id, color_code, edition").order("sku").range(from, to)
    ),
    supabase.from("bag_models").select("id, name, base_size, brands(name)").order("sort_order"),
  ]);

  const designCodes = catalog.filter((r) => (r.design ?? deriveDesign(r.sku)) === design);
  if (designCodes.length === 0) notFound();

  const rows: DesignRow[] = designCodes.map((r) => ({
    sku: r.sku,
    modelId: r.bag_model_id,
    colorCode: r.color_code,
  }));

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
        allSkus={catalog.map((r) => r.sku)}
        error={searchParams?.error}
      />
    </>
  );
}
