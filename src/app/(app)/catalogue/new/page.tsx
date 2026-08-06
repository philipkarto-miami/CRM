import { createClient } from "@/lib/supabase/server";
import { createSkuCatalogEntry } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SkuStepsEditor } from "@/components/SkuStepsEditor";
import type { BagModel } from "@/types/database";

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
    supabase.from("bag_models").select("*, brands(name)").order("sort_order"),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Catalogue" title="Nouveau code PK" />

      {searchParams?.error && <p className="mb-4 text-sm text-red-400">Erreur : {searchParams.error}</p>}

      <form action={createSkuCatalogEntry} className="card space-y-4 rounded-sm p-6">
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="SKU">
            <Input name="sku" required placeholder="PKPOP35" />
          </FormRow>
          <FormRow label="Edition">
            <Input name="edition" placeholder="PK.03" />
          </FormRow>
        </div>

        <FormRow label="Modele fournisseur transforme (un SKU = un seul modele/taille)">
          <Select name="bag_model_id" required>
            <option value="">—</option>
            {(models as (BagModel & { brands: { name: string } | null })[] | null)?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brands?.name} {m.name} {m.base_size}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Description">
          <Textarea name="description" rows={4} placeholder="Description du produit" />
        </FormRow>

        <p className="eyebrow pt-2">Etapes de fabrication pour ce SKU</p>
        <SkuStepsEditor
          availableSteps={(stages ?? []).map((s) => ({ code: s.catalog_column as string, name: s.name }))}
          initialSteps={{}}
        />

        <Button type="submit">Creer le code PK</Button>
      </form>
    </div>
  );
}
