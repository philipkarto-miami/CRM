import { createClient } from "@/lib/supabase/server";
import { createSupplier, deleteSupplier } from "./actions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { FormRow, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { Supplier } from "@/types/database";

export default async function SuppliersPage() {
  const supabase = createClient();
  const { data: suppliers } = await supabase.from("suppliers").select("*").order("name");

  return (
    <div>
      <PageHeader eyebrow="Achats" title="Fournisseurs" />

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2">
          <div className="card overflow-hidden rounded-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-widest2 text-paper/40">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(suppliers as Supplier[] | null)?.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 text-paper/80">{s.name}</td>
                    <td className="px-4 py-3 text-paper/60">{s.contact_name ?? "-"}</td>
                    <td className="px-4 py-3 text-paper/60">{s.email ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteSupplier.bind(null, s.id)}>
                        <button className="text-xs text-red-400 hover:underline">Supprimer</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {(!suppliers || suppliers.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-paper/40">
                      Aucun fournisseur enregistre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Card>
          <CardTitle>Nouveau fournisseur</CardTitle>
          <form action={createSupplier} className="space-y-3">
            <FormRow label="Nom">
              <Input name="name" required />
            </FormRow>
            <FormRow label="Contact">
              <Input name="contact_name" />
            </FormRow>
            <FormRow label="Email">
              <Input type="email" name="email" />
            </FormRow>
            <FormRow label="Telephone">
              <Input name="phone" />
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
