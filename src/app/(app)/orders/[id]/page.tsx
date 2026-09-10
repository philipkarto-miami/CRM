import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  CUSTOMER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PHASE_LABELS,
} from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/utils";
import type { ActivityLog, Bag, Customer, Order, StagePhase } from "@/types/database";

type OrderWithRelations = Order & {
  bags: (Bag & { current_phase: StagePhase }) | null;
  customers: Customer | null;
  bag_models: { name: string; base_size: string | null; brands: { name: string } | null } | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: order }, { data: history }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, bags(*, current_phase), customers(*), bag_models(name, base_size, brands(name))"
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("activity_log")
      .select("*")
      .eq("order_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!order) notFound();

  const typedOrder = order as OrderWithRelations;

  const customerLabel =
    typedOrder.customer_type === "particulier"
      ? typedOrder.individual_customer_name ?? "-"
      : typedOrder.customers?.full_name ?? "-";

  const desiredLabel = typedOrder.bag_models
    ? [typedOrder.bag_models.brands?.name, typedOrder.bag_models.name, typedOrder.bag_models.base_size]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <div className="max-w-3xl">
      <Link href="/orders" className="text-[13px] text-paper/55">
        ← Commandes
      </Link>

      <div className="mb-8 mt-2.5 flex items-start justify-between">
        <div>
          <p className="eyebrow">Commandes</p>
          <h1 className="font-serif text-3xl text-paper">{typedOrder.order_name}</h1>
        </div>
        <div>
          {typedOrder.status === "annule" ? (
            <Badge tone="red">Annulee</Badge>
          ) : typedOrder.bags ? (
            <Badge tone="gold">{PHASE_LABELS[typedOrder.bags.current_phase]}</Badge>
          ) : (
            <span className="text-xs text-paper/45">En attente de sac</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardTitle>Client</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-paper/50">Type</dt>
              <dd className="text-paper/85">{CUSTOMER_TYPE_LABELS[typedOrder.customer_type]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-paper/50">Nom</dt>
              <dd className="text-paper/85">{customerLabel}</dd>
            </div>
            {typedOrder.customer_type === "professionnel" && typedOrder.customers && (
              <div className="flex justify-between">
                <dt className="text-paper/50">Contact</dt>
                <dd className="text-paper/85">{typedOrder.customers.contact_name ?? "-"}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardTitle>Sac</CardTitle>
          {typedOrder.bags ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-paper/50">N° série</dt>
                <dd>
                  <Link href={`/bags/${typedOrder.bags.id}`} className="text-gold hover:underline">
                    {typedOrder.bags.serial_number}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-paper/50">Modele</dt>
                <dd className="text-paper/85">{typedOrder.bags.model_label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-paper/50">SKU</dt>
                <dd className="text-paper/85">{typedOrder.bags.sku ?? "-"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-paper/60">
              Souhaite : {typedOrder.desired_sku ? `${typedOrder.desired_sku} (${desiredLabel ?? "?"})` : desiredLabel ?? "-"}
            </p>
          )}
        </Card>

        <Card>
          <CardTitle>Paiement &amp; dates</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-paper/50">Statut commande</dt>
              <dd className="text-paper/85">{ORDER_STATUS_LABELS[typedOrder.status]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-paper/50">Paiement</dt>
              <dd className="text-paper/85">{PAYMENT_STATUS_LABELS[typedOrder.payment_status]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-paper/50">Prix de vente</dt>
              <dd className="text-paper/85">{formatMoney(typedOrder.sale_price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-paper/50">Date de commande</dt>
              <dd className="text-paper/85">{formatDate(typedOrder.order_date)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-paper/50">Expedition prevue</dt>
              <dd className="text-paper/85">{formatDate(typedOrder.expected_shipping_date)}</dd>
            </div>
            {typedOrder.is_priority && (
              <div className="flex justify-between">
                <dt className="text-paper/50">Priorite</dt>
                <dd>
                  <Badge tone="gold">★ Prioritaire</Badge>
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardTitle>Expedition</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-paper/50">N° de facture</dt>
              <dd className="text-paper/85">{typedOrder.invoice_number ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-paper/50">Transporteur</dt>
              <dd className="text-paper/85">{typedOrder.shipping_carrier ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-paper/50">N° de suivi</dt>
              <dd className="text-paper/85">{typedOrder.tracking_number ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-paper/50">Expediee le</dt>
              <dd className="text-paper/85">{formatDate(typedOrder.shipped_at)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {typedOrder.notes && (
        <Card className="mt-6">
          <CardTitle>Notes</CardTitle>
          <p className="whitespace-pre-wrap text-sm text-paper/80">{typedOrder.notes}</p>
        </Card>
      )}

      <Card className="mt-6">
        <CardTitle>Historique</CardTitle>
        <div className="space-y-3">
          {((history as ActivityLog[] | null) ?? []).map((entry) => (
            <div key={entry.id} className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2 text-sm last:border-0">
              <p className="text-paper/80">{entry.action}</p>
              <p className="shrink-0 text-xs text-paper/40">{formatDateTime(entry.created_at)}</p>
            </div>
          ))}
          {(!history || history.length === 0) && (
            <p className="text-sm text-paper/40">Aucun evenement enregistre.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
