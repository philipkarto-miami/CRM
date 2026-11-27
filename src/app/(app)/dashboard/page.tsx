import Link from "next/link";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { bagHref } from "@/lib/atelier/links";
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
  reception: "#e6dfca",
  disassembly: "#ddd0ab",
  stock_propre: "#d1bf8c",
  manufacturing: "#bf9d57",
  quality_control: "#a98544",
  wrapping: "#8f6e33",
  shipping: "#6f5424",
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
  const profile = await getCurrentProfile();

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
  const phaseByBagId = new Map(typedBags.map((b) => [b.id, b.current_phase]));
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

  // Etat de l'atelier : combien de sacs a chaque phase (hors comptabilite), dont
  // combien en retard ou bloques. Les phases vides restent affichees (a 0) pour
  // que le tableau garde toujours la meme forme.
  const atelierRows = PHASE_ORDER.filter((phase) => phase !== "accounting").map((phase) => {
    const inPhase = typedBags.filter((b) => b.current_phase === phase);
    return {
      phase,
      count: inPhase.length,
      late: phase === "shipping" ? 0 : inPhase.filter((b) => b.delivery_date && b.delivery_date < today).length,
      blocked: inPhase.filter((b) => blockedBagIds.has(b.id)).length,
    };
  });
  const atelierTotal = atelierRows.reduce((n, r) => n + r.count, 0);
  const atelierMax = Math.max(1, ...atelierRows.map((r) => r.count));

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
          <Link href={bagHref(b.bags?.id ?? "", phaseByBagId.get(b.bags?.id ?? ""), profile?.role)} className="shrink-0 whitespace-nowrap rounded-sm border border-line px-3 py-1.5 text-[11px] text-paper/65 hover:border-gold hover:text-gold">
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
          <Link href={bagHref(bag.id, bag.current_phase, profile?.role)} className="shrink-0 whitespace-nowrap rounded-sm border border-line px-3 py-1.5 text-[11px] text-paper/65 hover:border-gold hover:text-gold">
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

      <div className="mb-6">
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

      {/* Etat de l'atelier : une ligne par phase, barre arrondie proportionnelle au
          nombre de sacs (barres centrees, comme un entonnoir). Chaque ligne ouvre
          le kanban de l'Atelier a cette phase. */}
      <div className="rounded-[26px] border border-line bg-white px-5 py-6 shadow-[0_2px_18px_rgba(34,31,25,0.06)] sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-[22px] text-paper">Etat de l&apos;atelier</h2>
          <span className="rounded-full bg-[#f3efe2] px-3.5 py-1.5 text-[10px] uppercase tracking-widest2 text-paper/55">
            {atelierTotal} sac{atelierTotal > 1 ? "s" : ""} en cours
          </span>
        </div>

        <div className="mt-5 space-y-1">
          {atelierRows.map((row) => (
            <Link
              key={row.phase}
              href={`/production#phase-${row.phase}`}
              className="group grid grid-cols-[96px_1fr_40px] items-center gap-x-3 rounded-2xl px-2 py-2 transition-colors hover:bg-[#faf8f1] sm:grid-cols-[170px_1fr_56px] sm:gap-x-5 sm:px-3"
            >
              <span className="text-[11px] font-medium uppercase tracking-widest2 text-paper/55 group-hover:text-gold">
                {PHASE_LABELS[row.phase]}
              </span>

              <span className="flex flex-col items-center gap-1.5">
                <span className="flex h-12 w-full items-center justify-center">
                  {row.count === 0 ? (
                    <span className="block h-12 w-14 rounded-full bg-[#f1ede0]" />
                  ) : (
                    <span
                      className="block h-12 rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${Math.max(12, (row.count / atelierMax) * 100)}%`,
                        background: PHASE_BAR_COLORS[row.phase],
                      }}
                    />
                  )}
                </span>
                {(row.late > 0 || row.blocked > 0) && (
                  <span className="text-[11.5px] leading-none">
                    {row.late > 0 && <span className="text-danger">↓ {row.late} en retard</span>}
                    {row.late > 0 && row.blocked > 0 && <span className="text-paper/35"> · </span>}
                    {row.blocked > 0 && (
                      <span className="text-amber-600">
                        {row.blocked} bloque{row.blocked > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                )}
              </span>

              <span
                className={cn(
                  "text-right font-serif text-[32px] leading-none",
                  row.count === 0 ? "text-paper/30" : "text-paper"
                )}
              >
                {row.count}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 px-2 pt-4 text-[13px] text-paper/55 sm:px-3">
          <span>
            {lateBags.length > 0 ? (
              <span className="text-danger">{lateBags.length} en retard de livraison</span>
            ) : (
              "Aucun retard de livraison"
            )}
            {blockedBagIds.size > 0 && (
              <>
                {" · "}
                <span className="text-amber-600">{blockedBagIds.size} avec une etape bloquee</span>
              </>
            )}
          </span>
          {delaisMoyens !== null && (
            <span>
              Delai moyen commande → expedition <strong className="ml-1 text-[15px] text-paper">{delaisMoyens} j</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
