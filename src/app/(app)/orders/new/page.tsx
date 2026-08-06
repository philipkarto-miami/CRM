import { createClient } from "@/lib/supabase/server";
import { createOrder } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ModelBagPicker } from "@/components/ModelBagPicker";
import type { BagModel, Customer } from "@/types/database";

export default async function NewOrderPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const [{ data: allBags }, { data: linkedBagIds }, { data: customers }, { data: models }] = await Promise.all([
    supabase.from("bags").select("id, serial_number, model_id, sku").order("serial_number"),
    supabase.from("orders").select("bag_id").not("bag_id", "is", null),
    supabase.from("customers").select("id, full_name").order("full_name"),
    supabase.from("bag_models").select("*, brands(name)").order("sort_order"),
  ]);

  // Un sac deja rattache a une autre commande n'est plus "disponible" a la
  // vente : le SKU garantissant un modele unique, on filtre juste par
  // modele une fois choisi (voir ModelBagPicker).
  const usedBagIds = new Set((linkedBagIds ?? []).map((o) => o.bag_id));
  const availableBags = (allBags ?? []).filter((b) => !usedBagIds.has(b.id));

  const modelOptions = ((models as (BagModel & { brands: { name: string } | null })[] | null) ?? []).map((m) => ({
    id: m.id,
    label: [m.brands?.name, m.name, m.base_size].filter(Boolean).join(" "),
  }));

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Ventes" title="Nouvelle commande" />

      {searchParams?.error && (
        <p className="mb-4 text-sm text-red-400">Erreur : {searchParams.error}</p>
      )}

      <form action={createOrder} className="card space-y-4 rounded-sm p-6">
        <FormRow label="Nom de la commande">
          <Input name="order_name" required placeholder="CMD-2607-01" />
        </FormRow>

        <FormRow label="Client">
          <Select name="customer_id" required>
            <option value="">—</option>
            {(customers as Pick<Customer, "id" | "full_name">[] | null)?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </Select>
        </FormRow>

        <ModelBagPicker models={modelOptions} bags={availableBags} />
        <p className="text-xs text-paper/40">
          Un SKU ne correspond qu&apos;a un seul modele de sac : en choisissant le modele vendu,
          l&apos;outil ne propose que les sacs en stock de ce modele (produits finis avec leur SKU, ou
          encore en pieces detachees). Si aucun ne convient, la commande part en « Sac à commander ».
        </p>

        <div className="grid grid-cols-3 gap-4">
          <FormRow label="Type de vente">
            <Select name="sale_type" defaultValue="assemble">
              <option value="assemble">Assemble</option>
              <option value="disassemble">Desassemble</option>
            </Select>
          </FormRow>
          <FormRow label="Prix de vente (€)">
            <Input type="number" step="0.01" name="sale_price" />
          </FormRow>
          <FormRow label="Date de commande">
            <Input type="date" name="order_date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </FormRow>
        </div>

        <FormRow label="Notes">
          <Textarea name="notes" rows={3} />
        </FormRow>

        <Button type="submit">Creer la commande</Button>
      </form>
    </div>
  );
}
