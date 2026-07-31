import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { NewBagForm } from "@/components/NewBagForm";
import type { BagModel, Supplier } from "@/types/database";

export default async function NewBagPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const [{ data: models }, { data: suppliers }] = await Promise.all([
    supabase.from("bag_models").select("*, brands(name)").order("sort_order"),
    supabase.from("suppliers").select("*").order("name"),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Stock" title="Nouveau sac" />

      {searchParams?.error && (
        <p className="mb-4 text-sm text-red-400">Erreur : {searchParams.error}</p>
      )}

      <NewBagForm
        models={(models as (BagModel & { brands: { name: string } | null })[]) ?? []}
        suppliers={(suppliers as Supplier[]) ?? []}
      />
    </div>
  );
}
