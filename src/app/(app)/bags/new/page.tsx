import { createClient } from "@/lib/supabase/server";
import { createBag } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
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

      <form action={createBag} className="card space-y-6 rounded-sm p-6">
        <p className="text-xs text-paper/40">
          Le n° de série PK est généré automatiquement (format PK+année+mois+incrément).
          Le SKU et les autres informations (prix d&apos;achat, notes, photos...) pourront
          être complétés plus tard depuis la fiche du sac.
        </p>

        <FormRow label="Modèle">
          <Select name="model_id" required>
            <option value="">—</option>
            {(models as (BagModel & { brands: { name: string } | null })[] | null)?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brands?.name} {m.name} {m.base_size}
              </option>
            ))}
          </Select>
        </FormRow>

        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Fournisseur">
            <Select name="supplier_id">
              <option value="">—</option>
              {(suppliers as Supplier[] | null)?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="N° authentification fournisseur">
            <Input name="auth_number_supplier" placeholder="ARI3956" />
          </FormRow>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Date de livraison">
            <Input type="date" name="delivery_date" />
          </FormRow>
          <FormRow label="Date de fabrication (LV / Hermès)">
            <Input type="date" name="factory_date" />
          </FormRow>
        </div>

        <FormRow label="N° de facture">
          <Input name="invoice_number" />
        </FormRow>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-paper/70">
            <input type="checkbox" name="size_verified" className="accent-gold" />
            Taille conforme (OK)
          </label>
          <label className="flex items-center gap-2 text-sm text-paper/70">
            <input type="checkbox" name="canvas_verified" className="accent-gold" />
            Toile conforme (OK)
          </label>
        </div>

        <Button type="submit">Créer le sac</Button>
      </form>
    </div>
  );
}
