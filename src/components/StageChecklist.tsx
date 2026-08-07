"use client";

import { useState, useTransition } from "react";
import { updateStageProgress } from "@/app/(app)/bags/actions";
import { PHASE_LABELS, PHASE_ORDER, STAGE_STATUS_LABELS } from "@/lib/constants";
import type { BagStageProgress, ProductionStage, StageStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type Progress = BagStageProgress & { production_stages: ProductionStage };

const STATUS_OPTIONS: StageStatus[] = ["a_faire", "en_cours", "termine", "bloque"];

const STATUS_DOT: Record<StageStatus, string> = {
  a_faire: "bg-paper/15",
  en_cours: "bg-sky-500",
  termine: "bg-success",
  bloque: "bg-danger",
};

const STATUS_LABEL_COLOR: Record<StageStatus, string> = {
  a_faire: "text-paper/50",
  en_cours: "text-sky-600",
  termine: "text-success",
  bloque: "text-danger",
};

export function StageChecklist({ bagId, progress }: { bagId: string; progress: Progress[] }) {
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Une etape dont sequence_override est renseigne a ete positionnee selon
  // le SKU attribue au sac (peut differer de l'ordre par defaut) ; sinon on
  // retombe sur l'ordre par defaut de production_stages.
  const sortKey = (p: Progress) => p.sequence_override ?? p.production_stages.order_index;

  const grouped = PHASE_ORDER.map((phase) => ({
    phase,
    items: progress.filter((p) => p.production_stages.phase === phase).sort((a, b) => sortKey(a) - sortKey(b)),
  })).filter((g) => g.items.length > 0);

  function setStatus(item: Progress, status: StageStatus) {
    if (isPending) return;
    startTransition(() => {
      updateStageProgress(bagId, item.stage_id, status, item.notes ?? null);
    });
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => {
        const done = group.items.filter((i) => i.status === "termine").length;
        return (
          <div key={group.phase}>
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow">{PHASE_LABELS[group.phase]}</p>
              <p className="text-xs text-paper/60">
                {done}/{group.items.length} terminees
              </p>
            </div>
            <ul className="card divide-y divide-line/60 rounded-sm">
              {group.items.map((item) => {
                const expanded = expandedId === item.id;
                return (
                  <li key={item.id} className={cn(expanded && "bg-gold/5")}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
                    >
                      <span className="flex items-center gap-3">
                        <span className={cn("h-3 w-3 shrink-0 rounded-full", STATUS_DOT[item.status])} />
                        <span className={cn("text-[15px] text-paper/80", expanded && "font-semibold text-paper")}>
                          {item.production_stages.name}
                          {item.subcontract_note && (
                            <span className="ml-2 text-xs text-gold/80">
                              (sous-traite : {item.subcontract_note})
                            </span>
                          )}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px] uppercase tracking-wide",
                          STATUS_LABEL_COLOR[item.status]
                        )}
                      >
                        {STAGE_STATUS_LABELS[item.status]}
                      </span>
                    </button>

                    {expanded && (
                      <div className="px-3.5 pb-3">
                        <div className="flex overflow-hidden rounded border border-line">
                          {STATUS_OPTIONS.map((status) => {
                            const active = item.status === status;
                            return (
                              <button
                                key={status}
                                type="button"
                                disabled={isPending && active}
                                onClick={() => setStatus(item, status)}
                                className={cn(
                                  "flex-1 py-3 text-center text-xs transition-colors",
                                  active
                                    ? "bg-gold font-semibold text-white"
                                    : status === "bloque"
                                      ? "bg-white text-danger hover:bg-danger/5"
                                      : "bg-white text-paper/50 hover:text-paper/80"
                                )}
                              >
                                {STAGE_STATUS_LABELS[status]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
