import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { ProductionColumns, type ProductionCard, type ProductionColumn } from "@/components/ProductionColumns";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Bag, BagStageProgress, ProductionStage } from "@/types/database";

type Progress = BagStageProgress & { production_stages: ProductionStage };
type BagWithProgress = Bag & { bag_stage_progress: Progress[] };

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(value));
}

function daysBetween(fromISO: string, toISO: string) {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  return Math.round(ms / 86_400_000);
}

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: { q?: string; blocked?: string; late?: string };
}) {
  const supabase = createClient();
  const { data: bags } = await supabase
    .from("bags")
    .select(
      "*, bag_stage_progress(status, blocked_at, subcontract_note, sequence_override, production_stages(phase, name, order_index))"
    )
    .order("created_at", { ascending: false });

  const typedBags = ((bags as BagWithProgress[] | null) ?? []).map((b) => ({
    ...b,
    bag_stage_progress: (b.bag_stage_progress ?? []).filter((p) => p.production_stages),
  }));

  const today = new Date().toISOString().slice(0, 10);

  // Un sac "en cours" au sens fabrication ne peut etre bloque que sur une
  // etape de sa phase actuelle (les phases passees sont deja terminees, les
  // futures pas encore commencees).
  const cards: ProductionCard[] = typedBags.map((bag) => {
    const currentPhaseProgress = bag.bag_stage_progress
      .filter((p) => p.production_stages.phase === bag.current_phase)
      .sort((a, b) => (a.sequence_override ?? a.production_stages.order_index) - (b.sequence_override ?? b.production_stages.order_index));

    const blockedStep = currentPhaseProgress.find((p) => p.status === "bloque") ?? null;
    const nextStep = currentPhaseProgress.find((p) => p.status !== "termine") ?? null;
    const doneInPhase = currentPhaseProgress.filter((p) => p.status === "termine").length;

    const isLate = Boolean(bag.delivery_date) && bag.delivery_date! < today && bag.current_phase !== "shipping";
    const daysLate = isLate ? daysBetween(bag.delivery_date as string, today) : 0;

    return {
      id: bag.id,
      phase: bag.current_phase,
      serial_number: bag.serial_number,
      model_label: bag.model_label,
      sku: bag.sku,
      isBlocked: Boolean(blockedStep),
      isLate,
      daysLate,
      deliveryShort: bag.delivery_date ? formatShortDate(bag.delivery_date) : null,
      doneInPhase,
      totalInPhase: currentPhaseProgress.length,
      nextStepName: nextStep?.production_stages.name ?? null,
      blockedStepName: blockedStep?.production_stages.name ?? null,
      blockedSubcontractNote: blockedStep?.subcontract_note ?? null,
    };
  });

  const blockedCount = cards.filter((c) => c.isBlocked).length;
  const lateCount = cards.filter((c) => c.isLate).length;

  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const blockedActive = searchParams?.blocked === "1";
  const lateActive = searchParams?.late === "1";

  const filteredCards = cards.filter((c) => {
    if (blockedActive && !c.isBlocked) return false;
    if (lateActive && !c.isLate) return false;
    if (q) {
      const haystack = `${c.serial_number} ${c.model_label} ${c.sku ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const columns: ProductionColumn[] = PHASE_ORDER.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    bags: filteredCards.filter((c) => c.phase === phase),
  }));

  function chipHref(param: "blocked" | "late", active: boolean) {
    const params = new URLSearchParams();
    if (q) params.set("q", searchParams?.q ?? "");
    if (param === "blocked" ? !active : blockedActive) params.set("blocked", "1");
    if (param === "late" ? !active : lateActive) params.set("late", "1");
    const s = params.toString();
    return `/production${s ? `?${s}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Fabrication"
        title="Suivi de production"
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <form>
              {blockedActive && <input type="hidden" name="blocked" value="1" />}
              {lateActive && <input type="hidden" name="late" value="1" />}
              <input
                type="search"
                name="q"
                defaultValue={searchParams?.q ?? ""}
                placeholder="N° série, modèle…"
                className="input-base w-[220px] px-3 py-1.5 text-sm"
              />
            </form>
            <Link
              href={chipHref("blocked", blockedActive)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                blockedActive ? "border-danger bg-danger/10 text-danger" : "border-danger text-danger"
              )}
            >
              Bloqués · {blockedCount}
            </Link>
            <Link
              href={chipHref("late", lateActive)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                lateActive ? "border-gold bg-gold/10 text-gold" : "border-line text-paper/60"
              )}
            >
              En retard · {lateCount}
            </Link>
          </div>
        }
      />

      <ProductionColumns columns={columns} />
    </div>
  );
}
