import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCustomer } from "../actions";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PaymentTermsFields } from "@/components/PaymentTermsFields";
import { SavedToast } from "@/components/SavedToast";
import { COUNTRIES } from "@/lib/countries";
import { PAYMENT_STATUS_LABELS, PAYMENT_TERMS_LABELS } from "@/lib/constants";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { Customer, Order } from "@/types/database";

type CustomerOrder = Order & {
  bags: { serial_number: string; model_label: string } | null;
  bag_models: { name: string; base_size: string | null; brands: { name: string } | null } | null;
};

// Fiche d'un client pro, en deux onglets : "Fiche" (modifiable) et
// "Historique" (totaux + commandes du client).
export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; error?: string };
}) {
  const supabase = createClient();
  const tab = searchParams?.tab === "historique" ? "historique" : "fiche";

  const [{ data: customerData }, { data: orderData }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("orders")
      .select("*, bags(serial_number, model_label), bag_models(name, base_size, brands(name))")
      .eq("customer_id", params.id)
      .order("order_date", { ascending: false }),
  ]);

  if (!customerData) notFound();
  const customer = customerData as Customer;
  const orders = (orderData as CustomerOrder[] | null) ?? [];

  // Totaux : les commandes annulees ne comptent pas. "Non solde" = montant des
  // commandes dont le paiement n'est pas complet (en attente ou partiel).
  const active = orders.filter((o) => o.status !== "annule");
  const revenue = active.reduce((sum, o) => sum + (o.sale_price ?? 0), 0);
  const unpaid = active
    .filter((o) => o.payment_status !== "paye")
    .reduce((sum, o) => sum + (o.sale_price ?? 0), 0);
  const lastOrder = active[0]?.order_date ?? null;

  const updateWithId = updateCustomer.bind(null, customer.id);

  const tabClass = (active: boolean) =>
    cn(
      "border-b-2 pb-0.5 text-[13px]",
      active ? "border-gold font-semibold text-gold" : "border-transparent text-paper/55 hover:text-gold"
    );

  return (
    <div>
      <SavedToast />
      <p className="text-xs uppercase tracking-widest2 text-gold">
        <Link href="/customers" className="text-paper/45 hover:text-gold">
          Clients Pro
        </Link>
      </p>
      <h1 className="mt-0.5 font-serif text-3xl text-paper">{customer.full_name}</h1>
      <p className="mt-1 text-sm text-paper/55">
        {[customer.contact_name, customer.email, customer.phone].filter(Boolean).join(" · ") || "Aucune coordonnée"}
      </p>

      <div className="mb-6 mt-5 flex gap-5">
        <Link href={`/customers/${customer.id}`} className={tabClass(tab === "fiche")}>
          Fiche
        </Link>
        <Link href={`/customers/${customer.id}?tab=historique`} className={tabClass(tab === "historique")}>
          Historique · {orders.length}
        </Link>
      </div>

      {searchParams?.error && <p className="mb-4 text-sm text-danger">Erreur : {searchParams.error}</p>}

      {tab === "fiche" ? (
        <form action={updateWithId} className="card max-w-2xl space-y-6 rounded-sm p-6">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest2 text-paper/40">Entreprise</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormRow label="Nom de la societe">
                <Input name="full_name" required defaultValue={customer.full_name} />
              </FormRow>
              <FormRow label="Contact principal">
                <Input name="contact_name" defaultValue={customer.contact_name ?? ""} />
              </FormRow>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest2 text-paper/40">Coordonnees</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormRow label="Email">
                <Input type="email" name="email" defaultValue={customer.email ?? ""} />
              </FormRow>
              <FormRow label="Telephone">
                <Input name="phone" defaultValue={customer.phone ?? ""} />
              </FormRow>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest2 text-paper/40">Adresse</p>
            <FormRow label="Adresse (ligne 1)">
              <Input name="address_line1" defaultValue={customer.address_line1 ?? ""} />
            </FormRow>
            <FormRow label="Adresse (ligne 2, optionnelle)">
              <Input name="address_line2" defaultValue={customer.address_line2 ?? ""} />
            </FormRow>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormRow label="Ville">
                <Input name="city" defaultValue={customer.city ?? ""} />
              </FormRow>
              <FormRow label="Region / Etat / Province">
                <Input name="region" defaultValue={customer.region ?? ""} />
              </FormRow>
              <FormRow label="Code postal">
                <Input name="postal_code" defaultValue={customer.postal_code ?? ""} />
              </FormRow>
            </div>
            <FormRow label="Pays">
              <Select name="country" defaultValue={customer.country ?? "Etats-Unis"}>
                {customer.country && !COUNTRIES.includes(customer.country) && (
                  <option value={customer.country}>{customer.country}</option>
                )}
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </Select>
            </FormRow>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest2 text-paper/40">Conditions commerciales</p>
            <PaymentTermsFields
              defaultTerms={customer.payment_terms}
              defaultPercent={customer.payment_terms_percent}
            />
            <FormRow label="Tax ID / EIN (optionnel)">
              <Input name="tax_id" defaultValue={customer.tax_id ?? ""} />
            </FormRow>
            <FormRow label="Notes">
              <Textarea name="notes" rows={3} defaultValue={customer.notes ?? ""} />
            </FormRow>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-paper/45">
              Client depuis le {formatDate(customer.created_at)} · {PAYMENT_TERMS_LABELS[customer.payment_terms]}
            </p>
            <div className="flex gap-2.5">
              <Link
                href="/customers"
                className="inline-flex items-center border border-line px-4 py-2 text-sm text-paper/70 hover:border-gold"
              >
                Retour
              </Link>
              <Button type="submit">Enregistrer</Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Commandes", value: String(active.length) },
              { label: "Chiffre d'affaires", value: formatMoney(revenue) },
              { label: "Non solde", value: formatMoney(unpaid), warn: unpaid > 0 },
              { label: "Derniere commande", value: formatDate(lastOrder) },
            ].map((stat) => (
              <div key={stat.label} className="card rounded-sm p-4">
                <p className="text-[11px] uppercase tracking-widest2 text-paper/45">{stat.label}</p>
                <p className={cn("mt-1 font-serif text-xl", stat.warn ? "text-danger" : "text-paper")}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
          <p className="-mt-3 max-w-3xl text-[11px] text-paper/45">
            Hors commandes annulees. « Non solde » = commandes en attente de paiement ou partiellement payees.
          </p>

          <div className="card overflow-hidden rounded-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-widest2 text-paper/40">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Commande</th>
                  <th className="px-4 py-3">Sac / modele</th>
                  <th className="px-4 py-3 text-right">Prix</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Paiement</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const desired = order.bag_models
                    ? [order.bag_models.brands?.name, order.bag_models.name, order.bag_models.base_size]
                        .filter(Boolean)
                        .join(" ")
                    : null;
                  return (
                    <tr key={order.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3 text-paper/60">{formatDate(order.order_date)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order.id}`} className="text-gold hover:underline">
                          {order.order_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-paper/70">
                        {order.bags
                          ? `${order.bags.model_label} (${order.bags.serial_number})`
                          : desired
                            ? `${order.desired_sku ? `${order.desired_sku} · ` : ""}${desired}`
                            : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-paper/80">{formatMoney(order.sale_price)}</td>
                      <td className="px-4 py-3">
                        {order.status === "annule" ? (
                          <Badge tone="red">Annulee</Badge>
                        ) : order.status === "livre" || order.status === "expedie" ? (
                          <Badge tone="green">{order.status === "livre" ? "Livree" : "Expediee"}</Badge>
                        ) : order.bags || order.status !== "sac_a_commander" ? (
                          <Badge tone="gold">En cours</Badge>
                        ) : (
                          <span className="text-xs text-paper/45">En attente de sac</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            order.payment_status === "paye" ? "green" : order.payment_status === "partiel" ? "gold" : "neutral"
                          }
                        >
                          {PAYMENT_STATUS_LABELS[order.payment_status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-paper/40">
                      Aucune commande pour ce client.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
