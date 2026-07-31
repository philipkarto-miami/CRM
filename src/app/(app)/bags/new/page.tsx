import { createClient } from "@/lib/supabase/server";
import { createBag } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { BagModel, Supplier } from "@/types/database";

export default async function NewBagPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const [{ data: models }, { data: suppliers }] = await Promise.all([
    supabase.from("bag_models").select("*, brands(name)").order("name"),
    supabase.from("suppliers").select("*").order("name"),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Stock" title="Nouveau sac" />

      {searchParams?.error && (
        <p className="mb-4 text-sm text-red-400">Erreur : {searchParams.error}</p>
      )}

      <form action={createBag} className="card space-y-6 rounded-sm p-6">
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="SKU">
            <Input name="sku" required placeholder="PKPOP35" />
          </FormRow>
          <FormRow label="N° de serie interne">
            <Input name="serial_number" required placeholder="PK2607001" />
          </FormRow>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Modele (reference catalogue)">
            <Select name="model_id">
              <option value="">—</option>
              {(models as (BagModel & { brands: { name: string } | null })[] | null)?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.brands?.name} {m.name} {m.base_size}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Libelle du modele (affichage)">
            <Input name="model_label" required placeholder="PHILIP KARTO Speedy 35 cms POP ART" />
          </FormRow>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormRow label="Taille">
            <Input name="size" placeholder="35" />
          </FormRow>
          <FormRow label="Type de vente">
            <Select name="sale_type" defaultValue="disassemble">
              <option value="disassemble">Desassemble</option>
              <option value="assemble">Assemble</option>
            </Select>
          </FormRow>
          <FormRow label="Lien photos">
            <Input name="photos_link" placeholder="https://..." />
          </FormRow>
        </div>

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

        <div className="grid grid-cols-3 gap-4">
          <FormRow label="Prix d'achat (€)">
            <Input type="number" step="0.01" name="purchase_price" />
          </FormRow>
          <FormRow label="Date d'achat">
            <Input type="date" name="purchase_date" />
          </FormRow>
          <FormRow label="Date de fabrication (LV / Hermes)">
            <Input type="date" name="factory_date" />
          </FormRow>
        </div>

        <FormRow label="Notes">
          <Textarea name="notes" rows={3} />
        </FormRow>

        <Button type="submit">Creer le sac</Button>
      </form>
    </div>
  );
}
