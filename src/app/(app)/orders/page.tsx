import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { OrderRow } from "@/components/OrderRow";
import { SavedToast } from "@/components/SavedToast";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Bag, Customer, Order, StagePhase } from "@/types/database";

type OrderWithRelations = Order & {
  bags: (Bag & { current_phase: StagePhase }) | null;
  customers: Customer | null;
  bag_models: { name: string; base_size: string | null; brands: { name: string } | null } | null;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { phase?: string };
}) {
  const supabase = createClient();
  const [{ data: orders }, { data: linkedBagIds }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, bags(serial_number, model_label, current_phase), customers(full_name), bag_models(name, base_size, brands(name))"
      )
      .order("order_date", { ascending: false }),
    // F2 : une commande annulee ne doit pas rendre son sac indisponible.
    supabase.from("orders").select("bag_id").not("bag_id", "is", null).neq("status", "annule"),
  ]);

  const allOrders = (orders as OrderWithRelations[] | null) ?? [];

  // Comptage par phase du sac (pour les chips de filtre) : une commande sans
  // sac rattache n'a pas de "statut de sac" et n'entre dans aucune chip.
  const countsByPhase = new Map<string, number>();
  for (const o of allOrders) {
    if (!o.bags) continue;
    countsByPhase.set(o.bags.current_phase, (countsByPhase.get(o.bags.current_phase) ?? 0) + 1);
  }

  const activePhase = (searchParams?.phase as StagePhase | undefined) || null;
  const filteredOrders = activePhase ? allOrders.filter((o) => o.bags?.current_phase === activePhase) : allOrders;

  function phaseHref(phase: StagePhase | null) {
    const params = new URLSearchParams();
    if (phase) params.set("phase", phase);
    const qs = params.toString();
    return qs ? `/orders?${qs}` : "/orders";
  }

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

  const pendingCount = allOrders.filter((o) => o.status === "sac_a_commander").length;

  return (
    <div>
      <SavedToast />
      <PageHeader
        eyebrow="Ventes"
        title="Commandes clients"
        action={
          <div className="flex items-center gap-2.5">
            <a
              href="/orders/export"
              className="inline-flex items-center justify-center gap-2 border border-line px-4 py-2 text-sm tracking-wide text-paper transition-colors hover:border-gold hover:text-gold"
            >
              Exporter
            </a>
            <LinkButton href="/orders/new">+ Nouvelle commande</LinkButton>
          </div>
        }
      />

      <div className="mb-5 flex gap-5 text-[13px]">
        <span className="border-b-2 border-gold pb-0.5 font-semibold text-gold">Commandes</span>
        {pendingCount > 0 && (
          <Link href="/orders/sourcing" className="text-paper/55 hover:text-gold">
            A sourcer · {pendingCount}
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={phaseHref(null)}
          className={cn(
            "rounded-full border px-3 py-[5px] text-[11px]",
            !activePhase ? "border-gold bg-gold/10 text-gold" : "border-line text-paper/60"
          )}
        >
          Toutes · {allOrders.length}
        </Link>
        {PHASE_ORDER.filter((phase) => (countsByPhase.get(phase) ?? 0) > 0).map((phase) => (
          <Link
            key={phase}
            href={phaseHref(phase)}
            className={cn(
              "rounded-full border px-3 py-[5px] text-[11px]",
              activePhase === phase ? "border-gold bg-gold/10 text-gold" : "border-line text-paper/60"
            )}
          >
            {PHASE_LABELS[phase]} · {countsByPhase.get(phase) ?? 0}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-widest2 text-paper/40">
              <th className="px-4 py-3">Commande</th>
              <th className="px-4 py-3">Sac / modele souhaite</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Statut du sac</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
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
                  bagPhase={order.bags?.current_phase ?? null}
                  desiredModelLabel={
                    order.desired_sku ? `${order.desired_sku} (${desiredLabel ?? "?"})` : desiredLabel
                  }
                  matchingBags={matchingBags}
                  customerName={
                    order.customer_type === "particulier"
                      ? order.individual_customer_name ?? "-"
                      : order.customers?.full_name ?? "-"
                  }
                />
              );
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-paper/40">
                  Aucune commande ne correspond a ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
