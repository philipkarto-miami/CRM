import { createClient } from "@/lib/supabase/server";
import { createOrder } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { Bag, Customer } from "@/types/database";

export default async function NewOrderPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const [{ data: bags }, { data: customers }] = await Promise.all([
    supabase.from("bags").select("id, serial_number, model_label").order("serial_number"),
    supabase.from("customers").select("id, full_name").order("full_name"),
  ]);

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

        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Sac">
            <Select name="bag_id" required>
              <option value="">—</option>
              {(bags as Pick<Bag, "id" | "serial_number" | "model_label">[] | null)?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.serial_number} — {b.model_label}
                </option>
              ))}
            </Select>
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
        </div>

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
