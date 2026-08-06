import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { NewBagForm } from "@/components/NewBagForm";
import type { BagModel, Supplier } from "@/types/database";

export default async function NewBagPage() {
  const supabase = createClient();
  const [{ data: models }, { data: suppliers }, { data: skuOptions }] = await Promise.all([
    supabase.from("bag_models").select("*, brands(name)").order("sort_order"),
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("sku_catalog").select("sku, edition").order("sku"),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Stock" title="Nouveau sac" />

      <NewBagForm
        models={(models as (BagModel & { brands: { name: string } | null })[]) ?? []}
        suppliers={(suppliers as Supplier[]) ?? []}
        skuOptions={(skuOptions as { sku: string; edition: string | null }[]) ?? []}
      />
    </div>
  );
}
