import { createClient } from "@/lib/supabase/server";
import { NewSkuBatchForm } from "@/components/NewSkuBatchForm";
import { toRecipeSteps } from "@/lib/stages";

export default async function NewSkuCatalogPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const [{ data: stages }, { data: models }] = await Promise.all([
    supabase
      .from("production_stages")
      .select("name, catalog_column, phase, order_index")
      .not("catalog_column", "is", null)
      .eq("is_active", true)
      .order("phase")
      .order("order_index"),
    supabase.from("bag_models").select("id, name, base_size, brands(name)").order("sort_order"),
  ]);

  // Tous les codes deja au catalogue (par pages de 1000 : limite de l'API) pour
  // signaler en direct ceux qui existent deja.
  const existingSkus: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("sku_catalog")
      .select("sku")
      .order("sku")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    existingSkus.push(...data.map((r) => r.sku as string));
    if (data.length < 1000) break;
  }

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
    <NewSkuBatchForm
      models={modelOptions}
      existingSkus={existingSkus}
      recipeSteps={toRecipeSteps(stages ?? [])}
      error={searchParams?.error}
    />
  );
}
