import { createClient } from "@/lib/supabase/server";
import { createCustomer, deleteCustomer } from "./actions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { FormRow, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import type { Customer } from "@/types/database";

export default async function CustomersPage() {
  const supabase = createClient();
  const { data: customers } = await supabase.from("customers").select("*").order("full_name");

  return (
    <div>
      <PageHeader eyebrow="Clients" title="Carnet clients" />

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2">
          <div className="card overflow-hidden rounded-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-widest2 text-paper/40">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Telephone</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(customers as Customer[] | null)?.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 text-paper/80">{c.full_name}</td>
                    <td className="px-4 py-3 text-paper/60">{c.email ?? "-"}</td>
                    <td className="px-4 py-3 text-paper/60">{c.phone ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteCustomer.bind(null, c.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={`Supprimer le client "${c.full_name}" ? Cette action est definitive.`}
                          variant="ghost"
                          className="!px-0 !py-0 text-xs text-danger hover:underline"
                        >
                          Supprimer
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
                {(!customers || customers.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-paper/40">
                      Aucun client enregistre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Card>
          <CardTitle>Nouveau client</CardTitle>
          <form action={createCustomer} className="space-y-3">
            <FormRow label="Nom complet">
              <Input name="full_name" required />
            </FormRow>
            <FormRow label="Email">
              <Input type="email" name="email" />
            </FormRow>
            <FormRow label="Telephone">
              <Input name="phone" />
            </FormRow>
            <FormRow label="Adresse">
              <Textarea name="address" rows={2} />
            </FormRow>
            <FormRow label="Notes">
              <Textarea name="notes" rows={2} />
            </FormRow>
            <Button type="submit" className="w-full">
              Ajouter
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
