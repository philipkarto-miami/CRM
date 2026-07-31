"use client";

import { useTransition } from "react";
import { updateStageProgress } from "@/app/(app)/bags/actions";
import { PHASE_LABELS, PHASE_ORDER, STAGE_STATUS_LABELS } from "@/lib/constants";
import type { BagStageProgress, ProductionStage, StageStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type Progress = BagStageProgress & { production_stages: ProductionStage };

const STATUS_CYCLE: StageStatus[] = ["a_faire", "en_cours", "termine", "bloque"];

const STATUS_DOT: Record<StageStatus, string> = {
  a_faire: "bg-paper/20",
  en_cours: "bg-sky-500",
  termine: "bg-emerald-500",
  bloque: "bg-red-500",
};

export function StageChecklist({ bagId, progress }: { bagId: string; progress: Progress[] }) {
  const [isPending, startTransition] = useTransition();

  const grouped = PHASE_ORDER.map((phase) => ({
    phase,
    items: progress
      .filter((p) => p.production_stages.phase === phase)
      .sort((a, b) => a.production_stages.order_index - b.production_stages.order_index),
  })).filter((g) => g.items.length > 0);

  function cycleStatus(item: Progress) {
    const idx = STATUS_CYCLE.indexOf(item.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    startTransition(() => {
      updateStageProgress(bagId, item.stage_id, next, item.notes ?? null);
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
              <p className="text-xs text-paper/40">
                {done}/{group.items.length}
              </p>
            </div>
            <ul className="card divide-y divide-line/60 rounded-sm">
              {group.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-4 py-2.5">
                  <button
                    disabled={isPending}
                    onClick={() => cycleStatus(item)}
                    className="flex items-center gap-3 text-left text-sm text-paper/80 hover:text-paper"
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[item.status])} />
                    {item.production_stages.name}
                  </button>
                  <span className="text-xs uppercase tracking-wider text-paper/40">
                    {STAGE_STATUS_LABELS[item.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
