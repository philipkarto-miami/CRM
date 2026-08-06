import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { OrderRow } from "@/components/OrderRow";
import type { Bag, Customer, Order } from "@/types/database";

type OrderWithRelations = Order & {
  bags: Bag | null;
  customers: Customer | null;
  bag_models: { name: string; base_size: string | null; brands: { name: string } | null } | null;
};

export default async function OrdersPage() {
  const supabase = createClient();
  const [{ data: orders }, { data: linkedBagIds }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, bags(serial_number, model_label), customers(full_name), bag_models(name, base_size, brands(name))")
      .order("order_date", { ascending: false }),
    supabase.from("orders").select("bag_id").not("bag_id", "is", null),
  ]);

  // Sacs "disponibles" = pas encore rattaches a une commande : ce sont ceux
  // qu'on peut proposer pour completer une commande en "sac a commander".
  const usedBagIds = new Set((linkedBagIds ?? []).map((o) => o.bag_id));
  const { data: availableBags } = await supabase
    .from("bags")
    .select("id, serial_number, model_label, model_id, sku");
  const availableByModel = new Map<
    string,
    { id: string; serial_number: string; model_label: string; sku: string | null }[]
  >();
  for (const b of availableBags ?? []) {
    if (usedBagIds.has(b.id) || !b.model_id) continue;
    const list = availableByModel.get(b.model_id) ?? [];
    list.push(b);
    availableByModel.set(b.model_id, list);
  }

  const pendingCount = (orders as OrderWithRelations[] | null)?.filter((o) => o.status === "sac_a_commander").length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Ventes"
        title="Commandes clients"
        action={<LinkButton href="/orders/new">+ Nouvelle commande</LinkButton>}
      />

      {pendingCount > 0 && (
        <p className="mb-4 text-sm text-gold/80">
          {pendingCount} commande{pendingCount > 1 ? "s" : ""} en attente d&apos;un sac (« Sac à commander »).
        </p>
      )}

      <div className="card overflow-hidden rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-widest2 text-paper/40">
              <th className="px-4 py-3">Commande</th>
              <th className="px-4 py-3">Sac / modele souhaite</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(orders as OrderWithRelations[] | null)?.map((order) => {
              const desiredLabel = order.bag_models
                ? [order.bag_models.brands?.name, order.bag_models.name, order.bag_models.base_size]
                    .filter(Boolean)
                    .join(" ")
                : null;
              // Un sac deja affecte a un autre SKU que celui souhaite n'est
              // pas un vrai match (le SKU determine une transformation
              // precise) : on ne propose que les sacs libres (sans SKU) ou
              // deja sur le bon SKU.
              const matchingBags = order.desired_model_id
                ? (availableByModel.get(order.desired_model_id) ?? []).filter(
                    (b) => !order.desired_sku || !b.sku || b.sku === order.desired_sku
                  )
                : [];
              return (
                <OrderRow
                  key={order.id}
                  order={order}
                  bagLabel={order.bags ? `${order.bags.serial_number} — ${order.bags.model_label}` : null}
                  desiredModelLabel={
                    order.desired_sku ? `${order.desired_sku} (${desiredLabel ?? "?"})` : desiredLabel
                  }
                  matchingBags={matchingBags}
                  customerName={order.customers?.full_name ?? "-"}
                />
              );
            })}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-paper/40">
                  Aucune commande enregistree.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
