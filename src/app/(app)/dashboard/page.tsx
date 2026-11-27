import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { DashboardRelierButton } from "@/components/DashboardRelierButton";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import type { Bag, BagStageProgress, Order, ProductionStage } from "@/types/database";

type OrderRow = Order & {
  customers: { full_name: string } | null;
  bag_models: { name: string; base_size: string | null; brands: { name: string } | null } | null;
};

type BlockedRow = BagStageProgress & {
  bags: { id: string; serial_number: string } | null;
  production_stages: Pick<ProductionStage, "name"> | null;
};

// Degrade beige -> or, un ton par phase (hors comptabilite, qui ne concerne
// pas la charge de fabrication).
const PHASE_BAR_COLORS: Record<string, string> = {
  reception: "#c9c0a6",
  disassembly: "#bba97c",
  stock_propre: "#ad9a68",
  manufacturing: "#8a6a30",
  quality_control: "#a98c4e",
  wrapping: "#c0a76a",
  shipping: "#b5ab8e",
};

function daysBetween(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

// Particulier => nom saisi librement sur la commande ; professionnel => nom
// de la fiche du carnet clients pro.
function customerLabel(order: OrderRow): string | null {
  return order.customer_type === "particulier"
    ? order.individual_customer_name
    : order.customers?.full_name ?? null;
}

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ data: orders }, { data: bags }, { data: blockedRows }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers(full_name), bag_models(name, base_size, brands(name))")
      .neq("status", "annule"),
    supabase.from("bags").select("*"),
    supabase
      .from("bag_stage_progress")
      .select("*, bags(id, serial_number), production_stages(name)")
      .eq("status", "bloque"),
  ]);

  const typedOrders = (orders as OrderRow[] | null) ?? [];
  const typedBags = (bags as Bag[] | null) ?? [];
  const typedBlocked = (blockedRows as BlockedRow[] | null) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // Sacs "disponibles" pour completer une commande sans sac : pas encore
  // rattaches a une commande (meme logique que /orders).
  const usedBagIds = new Set(typedOrders.filter((o) => o.bag_id).map((o) => o.bag_id));
  const availableByModel = new Map<string, Bag[]>();
  for (const b of typedBags) {
    if (usedBagIds.has(b.id) || !b.model_id) continue;
    const list = availableByModel.get(b.model_id) ?? [];
    list.push(b);
    availableByModel.set(b.model_id, list);
  }

  const pendingOrders = typedOrders
    .filter((o) => o.status === "sac_a_commander")
    .map((o) => ({
      order: o,
      matchingBags: o.desired_model_id
        ? (availableByModel.get(o.desired_model_id) ?? []).filter(
            (b) => !o.desired_sku || !b.sku || b.sku === o.desired_sku
          )
        : [],
    }));
  const pendingWithMatch = pendingOrders.filter((p) => p.matchingBags.length > 0).length;

  const blockedBagIds = new Set(typedBlocked.map((b) => b.bag_id));
  const subcontractPending = typedBlocked.filter((b) => b.subcontract_note).length;

  const lateBags = typedBags.filter(
    (b) =>
      b.delivery_date &&
      b.delivery_date < today &&
      b.current_phase !== "shipping" &&
      b.current_phase !== "accounting"
  );
  const readyToShip = typedBags.filter((b) => b.current_phase === "shipping");

  const orderByBagId = new Map(typedOrders.filter((o) => o.bag_id).map((o) => [o.bag_id as string, o]));

  const enTraitement = typedOrders.filter((o) => o.status === "recu" || o.status === "en_traitement").length;
  const expedieesCetteSemaine = typedOrders.filter(
    (o) => o.status === "expedie" && o.shipped_at && daysBetween(o.shipped_at, now) <= 7
  ).length;
  const delaisMoyens = (() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const withDelay = typedOrders.filter(
      (o) => o.shipped_at && new Date(o.order_date) >= cutoff
    );
    if (withDelay.length === 0) return null;
    const total = withDelay.reduce((sum, o) => sum + daysBetween(o.order_date, o.shipped_at as string), 0);
    return Math.round(total / withDelay.length);
  })();

  const counts = PHASE_ORDER.map((phase) => ({
    phase,
    count: typedBags.filter((b) => b.current_phase === phase).length,
  }));
  const chargeTotal = counts.filter((c) => c.phase !== "accounting").reduce((s, c) => s + c.count, 0) || 1;

  // Colonnes "charge de l'atelier" : phases non vides, sacs prioritaires puis
  // livraison la plus proche (ou la plus depassee) d'abord, sans date en dernier.
  const phaseColumns = PHASE_ORDER.filter((phase) => phase !== "accounting")
    .map((phase) => ({
      phase,
      bags: typedBags
        .filter((b) => b.current_phase === phase)
        .sort((a, b) => {
          if (a.is_priority !== b.is_priority) return a.is_priority ? -1 : 1;
          if (!a.delivery_date && !b.delivery_date) return 0;
          if (!a.delivery_date) return 1;
          if (!b.delivery_date) return -1;
          return a.delivery_date.localeCompare(b.delivery_date);
        }),
    }))
    .filter((col) => col.bags.length > 0);

  // File d'actions : commandes sans sac avec match possible, puis etapes
  // bloquees (les plus anciennes d'abord), puis retards (les plus longs
  // d'abord). La progression de phase etant automatique dans cet outil, il
  // n'y a pas de sacs "prets mais pas encore avances" a signaler ici.
  type PriorityRow = { key: string; text: React.ReactNode; sub: string; action: React.ReactNode };

  const matchRows: PriorityRow[] = pendingOrders
    .filter((p) => p.matchingBags.length > 0)
    .map(({ order, matchingBags }) => {
      const desiredLabel = order.bag_models
        ? [order.bag_models.brands?.name, order.bag_models.name, order.bag_models.base_size].filter(Boolean).join(" ")
        : order.desired_sku ?? "?";
      return {
        key: `match-${order.id}`,
        text: (
          <>
            La commande <span className="text-gold">{customerLabel(order) ?? "?"} — {desiredLabel}</span> attend
            un sac
          </>
        ),
        sub: `${matchingBags.length} sac${matchingBags.length > 1 ? "s" : ""} libre${matchingBags.length > 1 ? "s" : ""} compatible${matchingBags.length > 1 ? "s" : ""}`,
        action:
          matchingBags.length === 1 ? (
            <DashboardRelierButton orderId={order.id} bagId={matchingBags[0].id} serialNumber={matchingBags[0].serial_number} />
          ) : (
            <Link href="/orders" className="shrink-0 whitespace-nowrap rounded-sm border border-line px-3 py-1.5 text-[11px] text-paper/65 hover:border-gold hover:text-gold">
              Voir les sacs disponibles
            </Link>
          ),
      };
    });

  const blockedRowsSorted = [...typedBlocked].sort((a, b) => (a.blocked_at ?? "").localeCompare(b.blocked_at ?? ""));
  const blockedFeedRows: PriorityRow[] = blockedRowsSorted
    .filter((b) => b.bags)
    .map((b) => {
      const since = b.blocked_at ? daysBetween(b.blocked_at, now) : null;
      return {
        key: `blocked-${b.id}`,
        text: (
          <>
            <span className="text-gold">{b.bags?.serial_number}</span> bloque sur « {b.production_stages?.name ?? "?"} »
            {since !== null && ` depuis ${since} jour${since > 1 ? "s" : ""}`}
          </>
        ),
        sub: b.subcontract_note ? `Sous-traite — ${b.subcontract_note}` : "Relancer l'atelier",
        action: (
          <Link href={`/bags/${b.bags?.id}`} className="shrink-0 whitespace-nowrap rounded-sm border border-line px-3 py-1.5 text-[11px] text-paper/65 hover:border-gold hover:text-gold">
            Voir le sac
          </Link>
        ),
      };
    });

  const lateFeedRows: PriorityRow[] = [...lateBags]
    .sort((a, b) => (a.delivery_date ?? "").localeCompare(b.delivery_date ?? ""))
    .map((bag) => {
      const days = bag.delivery_date ? daysBetween(bag.delivery_date, today) : 0;
      const linkedOrder = orderByBagId.get(bag.id);
      return {
        key: `late-${bag.id}`,
        text: (
          <>
            <span className="text-gold">{bag.serial_number}</span> en retard de {days} jour{days > 1 ? "s" : ""} — phase{" "}
            {PHASE_LABELS[bag.current_phase]}
          </>
        ),
        sub: `Livraison prevue le ${formatDate(bag.delivery_date)}${linkedOrder && customerLabel(linkedOrder) ? `, commande ${customerLabel(linkedOrder)}` : ""}`,
        action: (
          <Link href={`/bags/${bag.id}`} className="shrink-0 whitespace-nowrap rounded-sm border border-line px-3 py-1.5 text-[11px] text-paper/65 hover:border-gold hover:text-gold">
            Voir le sac
          </Link>
        ),
      };
    });

  const priorityRows = [...matchRows, ...blockedFeedRows, ...lateFeedRows].slice(0, 10);

  return (
    <div>
      <PageHeader eyebrow="Vue d'ensemble" title="Tableau de bord" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/orders/sourcing"
          className={cn(
            "block rounded-sm border bg-white p-4",
            pendingOrders.length > 0 ? "border-danger" : "border-line"
          )}
        >
          <p className={cn("text-[10px] uppercase tracking-widest2", pendingOrders.length > 0 ? "text-danger" : "text-gold")}>
            Commandes sans sac
          </p>
          <p className={cn("font-serif text-3xl", pendingOrders.length > 0 ? "text-danger" : "text-paper")}>
            {pendingOrders.length}
          </p>
          {pendingOrders.length > 0 && (
            <p className="mt-1.5 text-[11px] text-danger">
              dont {pendingWithMatch} avec un sac compatible en stock →
            </p>
          )}
        </Link>

        <Link
          href="/bags"
          className={cn(
            "block rounded-sm border bg-white p-4",
            blockedBagIds.size > 0 ? "border-danger" : "border-line"
          )}
        >
          <p className={cn("text-[10px] uppercase tracking-widest2", blockedBagIds.size > 0 ? "text-danger" : "text-gold")}>
            Etapes bloquees
          </p>
          <p className={cn("font-serif text-3xl", blockedBagIds.size > 0 ? "text-danger" : "text-paper")}>
            {blockedBagIds.size}
          </p>
          {subcontractPending > 0 && <p className="mt-1.5 text-[11px] text-danger">{subcontractPending} sous-traitance en attente →</p>}
        </Link>

        <Link href="/bags?late=1" className="block rounded-sm border border-line bg-white p-4">
          <p className="text-[10px] uppercase tracking-widest2 text-gold">Livraisons en retard</p>
          <p className="font-serif text-3xl text-paper">{lateBags.length}</p>
          <p className="mt-1.5 text-[11px] text-gold">Voir les retards →</p>
        </Link>

        <Link href="/production#phase-shipping" className="block rounded-sm border border-line bg-white p-4">
          <p className="text-[10px] uppercase tracking-widest2 text-gold">Prets a expedier</p>
          <p className="font-serif text-3xl text-paper">{readyToShip.length}</p>
          <p className="mt-1.5 text-[11px] text-gold">Preparer les envois →</p>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <p className="eyebrow mb-2.5">A traiter en priorite</p>
          <div className="card divide-y divide-line/60 rounded-sm">
            {priorityRows.map((row) => (
              <div key={row.key} className="flex items-center gap-3 px-4 py-3.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
                <div className="flex-1">
                  <p className="text-[13px] text-paper/85">{row.text}</p>
                  <p className="mt-0.5 text-xs text-paper/55">{row.sub}</p>
                </div>
                {row.action}
              </div>
            ))}
            {priorityRows.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-paper/50">Rien a signaler pour le moment.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <p className="eyebrow mb-2.5">Ventes en attente de l&apos;atelier</p>
          <div className="card divide-y divide-line/60 rounded-sm">
            <div className="flex items-center justify-between px-4 py-3 text-[13px]">
              <span className="text-paper/75">Sac a commander</span>
              <span className={cn("font-serif", pendingOrders.length > 0 ? "text-danger" : "text-paper")}>
                {pendingOrders.length}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-[13px]">
              <span className="text-paper/75">En traitement a l&apos;atelier</span>
              <span className="font-serif text-paper">{enTraitement}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-[13px]">
              <span className="text-paper/75">A expedier</span>
              <span className="font-serif text-paper">{readyToShip.length}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-[13px]">
              <span className="text-paper/75">Expediees cette semaine</span>
              <span className="font-serif text-success">{expedieesCetteSemaine}</span>
            </div>
          </div>
          {delaisMoyens !== null && (
            <p className="mt-2.5 text-xs text-paper/55">
              Delai moyen commande → expedition : <strong className="text-paper/80">{delaisMoyens} jours</strong>
            </p>
          )}
        </div>
      </div>

      <p className="eyebrow mb-2.5">Charge de l&apos;atelier par phase</p>
      {/* Une colonne par phase qui contient des sacs, avec les sacs eux-memes :
          on voit quels sacs sont ou, et lesquels sont en retard ou bloques. */}
      {phaseColumns.length === 0 ? (
        <p className="card rounded-sm px-4 py-5 text-sm text-paper/50">Aucun sac en cours de fabrication.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {phaseColumns.map((col) => (
            <div
              key={col.phase}
              className="card rounded-sm border-t-[3px] px-3.5 pb-3 pt-3"
              style={{ borderTopColor: PHASE_BAR_COLORS[col.phase] }}
            >
              <Link
                href={`/production#phase-${col.phase}`}
                className="mb-2 flex items-baseline justify-between gap-2 hover:text-gold"
                title="Ouvrir le kanban"
              >
                <span className="text-[11px] uppercase tracking-wide text-paper/70">{PHASE_LABELS[col.phase]}</span>
                <span className="font-serif text-2xl leading-none text-paper">{col.bags.length}</span>
              </Link>
              <ul className="divide-y divide-line/60">
                {col.bags.slice(0, 5).map((b) => {
                  const late = Boolean(b.delivery_date) && (b.delivery_date as string) < today;
                  const blocked = blockedBagIds.has(b.id);
                  return (
                    <li key={b.id}>
                      <Link
                        href={`/bags/${b.id}?from=production`}
                        className="flex min-h-[44px] items-center gap-2.5 py-2 hover:bg-bone/60"
                      >
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            late ? "bg-danger" : blocked ? "bg-amber-500" : "bg-line"
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-gold">{b.serial_number}</span>
                          <span className="block truncate text-xs text-paper/55">{b.model_label}</span>
                        </span>
                        <span className="shrink-0 text-right text-[11px] leading-tight">
                          {late && (
                            <span className="block text-danger">
                              retard {daysBetween(b.delivery_date as string, today)} j
                            </span>
                          )}
                          {blocked && <span className="block text-amber-600">bloque</span>}
                          {b.is_priority && <span className="block text-paper/60">prioritaire</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {col.bags.length > 5 && (
                <Link
                  href={`/production#phase-${col.phase}`}
                  className="mt-1 block py-2 text-xs text-gold hover:underline"
                >
                  + {col.bags.length - 5} autre{col.bags.length - 5 > 1 ? "s" : ""} →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3.5 text-xs text-paper/55">
        Clique sur un sac pour ouvrir sa fiche, sur le titre d&apos;une phase pour ouvrir le kanban. Le chiffre
        d&apos;affaires et les paiements restent sur la page Commandes (role comptabilite) — ils ne pilotent pas
        l&apos;atelier.
      </p>
      <p className="mt-1 text-[11px] text-paper/40">
        {chargeTotal} sac{chargeTotal > 1 ? "s" : ""} en cours de fabrication (hors comptabilite).
      </p>
    </div>
  );
}
