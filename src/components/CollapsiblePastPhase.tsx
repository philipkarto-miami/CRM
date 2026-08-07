"use client";

import { useState } from "react";
import { StageChecklist } from "@/components/StageChecklist";
import { PHASE_LABELS } from "@/lib/constants";
import type { BagStageProgress, ProductionStage, StagePhase } from "@/types/database";

type Progress = BagStageProgress & { production_stages: ProductionStage };

// Une phase deja terminee se replie en une seule ligne "Termine" ; on peut la
// redeplier pour la consulter (ou corriger une case cochee par erreur) sans
// encombrer l'ecran par defaut.
export function CollapsiblePastPhase({
  bagId,
  phase,
  progress,
}: {
  bagId: string;
  phase: StagePhase;
  progress: Progress[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card rounded-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-success"
      >
        <span>✓ {PHASE_LABELS[phase]} — Termine</span>
        <span className="text-paper/30">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-line/60 p-3">
          <StageChecklist bagId={bagId} progress={progress} />
        </div>
      )}
    </div>
  );
}
