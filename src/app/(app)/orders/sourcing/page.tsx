import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import type { Order } from "@/types/database";

type OrderWithRelations = Order & {
  customers: { full_name: string } | null;
  bag_models: { name: string; base_size: string | null; brands: { name: string } | null } | null;
};

type BagRow = {
  id: string;
  model_id: string | null;
  serial_number: string;
  supplier_id: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  suppliers: { name: string } | null;
};

function daysAgo(dateISO: string) {
  const ms = new Date().getTime() - new Date(dateISO).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default async function SourcingPage() {
  const supabase = createClient();

  const [{ data: pendingOrders }, { data: allBags }, { data: linkedBagIds }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers(full_name), bag_models(name, base_size, brands(name))")
      .eq("status", "sac_a_commander")
      .order("order_date"),
    supabase
      .from("bags")
      .select("id, model_id, serial_number, supplier_id, purchase_price, purchase_date, suppliers(name)"),
    // F2 : une commande annulee ne doit pas rendre son sac indisponible.
    supabase.from("orders").select("bag_id").not("bag_id", "is", null).neq("status", "annule"),
  ]);

  const typedOrders = (pendingOrders as OrderWithRelations[] | null) ?? [];
  const typedBags = (allBags as unknown as BagRow[] | null) ?? [];
  const usedBagIds = new Set((linkedBagIds ?? []).map((o) => o.bag_id));

  const bagsByModel = new Map<string, BagRow[]>();
  for (const b of typedBags) {
    if (!b.model_id) continue;
    const list = bagsByModel.get(b.model_id) ?? [];
    list.push(b);
    bagsByModel.set(b.model_id, list);
  }

  const groupsByModel = new Map<string, { model: OrderWithRelations["bag_models"]; orders: OrderWithRelations[] }>();
  for (const order of typedOrders) {
    const key = order.desired_model_id ?? "sans-modele";
    const existing = groupsByModel.get(key);
    if (existing) existing.orders.push(order);
    else groupsByModel.set(key, { model: order.bag_models, orders: [order] });
  }

  const groups = Array.from(groupsByModel.entries())
    .map(([modelId, g]) => {
      const modelBags = modelId !== "sans-modele" ? bagsByModel.get(modelId) ?? [] : [];
      const freeBags = modelBags.filter((b) => !usedBagIds.has(b.id));
      const engagedExample = modelBags.find((b) => usedBagIds.has(b.id));
      const lastPurchase = modelBags
        .filter((b) => b.supplier_id && b.purchase_date)
        .sort((a, b) => (b.purchase_date ?? "").localeCompare(a.purchase_date ?? ""))[0];
      const modelLabel = g.model
        ? [g.model.brands?.name, g.model.name, g.model.base_size].filter(Boolean).join(" ")
        : "Modele non renseigne";
      const oldestOrderDate = g.orders.reduce(
        (min, o) => (o.order_date < min ? o.order_date : min),
        g.orders[0].order_date
      );
      return { modelId, modelLabel, orders: g.orders, modelBags, freeBags, engagedExample, lastPurchase, oldestOrderDate };
    })
    .sort((a, b) => a.oldestOrderDate.localeCompare(b.oldestOrderDate));

  return (
    <div>
      <PageHeader
        eyebrow="Ventes"
        title="A sourcer"
        action={<LinkButton href="/orders/new">+ Nouvelle commande</LinkButton>}
      />

      <div className="mb-5 flex gap-5 text-[13px]">
        <Link href="/orders" className="text-paper/55 hover:text-gold">
          Commandes
        </Link>
        <span className="border-b-2 border-gold pb-0.5 font-semibold text-gold">
          A sourcer · {typedOrders.length}
        </span>
      </div>

      {typedOrders.length === 0 ? (
        <p className="card rounded-sm px-4 py-10 text-center text-sm text-paper/55">
          Aucune commande en attente d&apos;un sac.{" "}
          <Link href="/orders" className="text-gold underline">
            Retour aux commandes
          </Link>
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-paper/60">
            {typedOrders.length} commande{typedOrders.length > 1 ? "s" : ""} attendent un sac — {groups.length} modele
            {groups.length > 1 ? "s" : ""} a acheter, triees du plus urgent au plus recent.
          </p>

          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.modelId} className="card rounded-sm">
                <div className="flex items-center justify-between px-5 pb-3 pt-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-serif text-lg text-paper">{group.modelLabel}</h3>
                    <span className="rounded-full border border-danger px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-danger">
                      × {group.orders.length} a acheter
                    </span>
                  </div>
                  <Link
                    href="/suppliers"
                    className="rounded-sm border border-line px-3.5 py-1.5 text-xs text-paper/70 hover:border-gold hover:text-gold"
                  >
                    Voir les fournisseurs
                  </Link>
                </div>
                <p className="px-5 pb-2.5 text-xs text-paper/55">
                  {group.freeBags.length > 0
                    ? `${group.freeBags.length} sac de ce modele deja libre en stock — verifie la compatibilite SKU.`
                    : group.engagedExample
                      ? `${group.modelBags.length} sac${group.modelBags.length > 1 ? "s" : ""} de ce modele en stock mais deja engage (${group.engagedExample.serial_number}).`
                      : "Aucun sac de ce modele libre en stock."}
                  {!group.lastPurchase && " Jamais achete — pas de prix de reference."}
                </p>

                <div className="border-t border-line/60">
                  {group.orders.map((order) => {
                    const days = daysAgo(order.order_date);
                    return (
                      <div
                        key={order.id}
                        className="grid grid-cols-[1.2fr_1fr_150px_110px_110px] items-center border-b border-line/60 px-5 py-2.5 text-[13px] last:border-0"
                      >
                        <span>
                          {order.order_name} · <span className="text-gold">{order.desired_sku ?? "?"}</span>
                        </span>
                        <span className="text-paper/70">{order.customers?.full_name ?? "-"}</span>
                        <span className={cn(days > 14 ? "text-danger" : "text-paper/60")}>
                          {formatDate(order.order_date)} · il y a {days} j
                        </span>
                        <span className="text-paper/70">{order.sale_price ? formatMoney(order.sale_price) : "—"}</span>
                        <Link href={`/orders#order-${order.id}`} className="text-right text-gold hover:underline">
                          Voir la commande
                        </Link>
                      </div>
                    );
                  })}
                </div>

                {group.lastPurchase && (
                  <div className="border-t border-line bg-gold/[0.04] px-5 py-2.5 text-xs text-paper/60">
                    Dernier achat de ce modele :{" "}
                    <span className="text-paper/85">
                      {group.lastPurchase.suppliers?.name ?? "?"} — {formatMoney(group.lastPurchase.purchase_price)} —{" "}
                      {formatDate(group.lastPurchase.purchase_date)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
