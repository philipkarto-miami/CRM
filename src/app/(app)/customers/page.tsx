import { createClient } from "@/lib/supabase/server";
import { deleteCustomer } from "./actions";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SavedToast } from "@/components/SavedToast";
import { PAYMENT_TERMS_LABELS } from "@/lib/constants";
import type { Customer } from "@/types/database";

export default async function CustomersPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const { data: customers } = await supabase.from("customers").select("*").order("full_name");

  return (
    <div>
      <SavedToast />
      <PageHeader
        eyebrow="Clients Pro"
        title="Carnet clients professionnels"
        action={<LinkButton href="/customers/new">+ Nouveau client pro</LinkButton>}
      />

      {searchParams?.error && <p className="mb-4 text-sm text-danger">Erreur : {searchParams.error}</p>}

      <div className="card overflow-hidden rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-widest2 text-paper/40">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Telephone</th>
              <th className="px-4 py-3">Conditions de paiement</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(customers as Customer[] | null)?.map((c) => (
              <tr key={c.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 text-paper/80">{c.full_name}</td>
                <td className="px-4 py-3 text-paper/60">{c.contact_name ?? "-"}</td>
                <td className="px-4 py-3 text-paper/60">{c.email ?? "-"}</td>
                <td className="px-4 py-3 text-paper/60">{c.phone ?? "-"}</td>
                <td className="px-4 py-3 text-paper/60">
                  {PAYMENT_TERMS_LABELS[c.payment_terms]}
                  {c.payment_terms === "partiel" && c.payment_terms_percent
                    ? ` (${c.payment_terms_percent}%)`
                    : ""}
                </td>
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
                <td colSpan={6} className="px-4 py-10 text-center text-paper/40">
                  Aucun client enregistre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
