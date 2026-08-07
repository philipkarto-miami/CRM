"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StagePhase } from "@/types/database";

export type ProductionCard = {
  id: string;
  phase: StagePhase;
  serial_number: string;
  model_label: string;
  sku: string | null;
  isBlocked: boolean;
  isLate: boolean;
  daysLate: number;
  deliveryShort: string | null;
  doneInPhase: number;
  totalInPhase: number;
  nextStepName: string | null;
  blockedStepName: string | null;
  blockedSubcontractNote: string | null;
};

export type ProductionColumn = {
  phase: StagePhase;
  label: string;
  bags: ProductionCard[];
};

// Colonnes du kanban de production : les phases vides se replient en rail
// fin (34px) pour supprimer le scroll horizontal, et se redeploient au clic
// (ou automatiquement si un sac y arrive, puisque l'etat initial derive du
// nombre de sacs a chaque chargement).
export function ProductionColumns({ columns }: { columns: ProductionColumn[] }) {
  const [expanded, setExpanded] = useState<Set<StagePhase>>(
    () => new Set(columns.filter((c) => c.bags.length > 0).map((c) => c.phase))
  );

  function toggle(phase: StagePhase) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  }

  return (
    <div className="flex items-start gap-3">
      {columns.map((col) => {
        const isExpanded = expanded.has(col.phase);

        if (!isExpanded) {
          return (
            <button
              key={col.phase}
              type="button"
              id={`phase-${col.phase}`}
              onClick={() => toggle(col.phase)}
              className="flex min-h-[180px] w-[34px] shrink-0 scroll-mt-4 flex-col items-center gap-2.5 rounded-sm border border-line bg-[#eee9db] py-2.5"
            >
              <span className="rounded-full bg-black/[0.08] px-2 py-0.5 text-[11px] text-paper/70">
                {col.bags.length}
              </span>
              <span
                className="rotate-180 whitespace-nowrap text-[9px] uppercase tracking-wide text-paper/45"
                style={{ writingMode: "vertical-rl" }}
              >
                {col.label}
              </span>
            </button>
          );
        }

        return (
          <div key={col.phase} id={`phase-${col.phase}`} className="w-[250px] shrink-0 scroll-mt-4">
            <button
              type="button"
              onClick={() => toggle(col.phase)}
              className="card mb-3 flex w-full items-center justify-between rounded-sm px-3 py-2 text-left"
            >
              <p className="eyebrow truncate">{col.label}</p>
              <span className="ml-2 shrink-0 rounded-full bg-black/[0.08] px-2 py-0.5 text-[11px] text-paper">
                {col.bags.length}
              </span>
            </button>

            <div className="space-y-3">
              {col.bags.map((bag) => {
                const pct = bag.totalInPhase > 0 ? Math.round((bag.doneInPhase / bag.totalInPhase) * 100) : 0;
                const flagged = bag.isBlocked || bag.isLate;
                return (
                  <Link
                    key={bag.id}
                    href={`/bags/${bag.id}?from=production`}
                    className={cn(
                      "block rounded-sm border bg-white p-3 hover:border-gold",
                      flagged ? "border-danger" : "border-line"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-gold">{bag.serial_number}</p>
                      {bag.isBlocked ? (
                        <span className="rounded-full border border-danger px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-danger">
                          Bloqué
                        </span>
                      ) : bag.isLate ? (
                        <span className="text-[10px] text-danger">
                          retard {bag.daysLate} j
                        </span>
                      ) : bag.deliveryShort ? (
                        <span className="text-[10px] text-paper/50">livr. {bag.deliveryShort}</span>
                      ) : null}
                    </div>

                    <p className="mt-1 truncate text-[13px] text-paper/85">
                      {bag.model_label}{" "}
                      {bag.sku ? (
                        <span className="text-[11px] text-gold">· {bag.sku}</span>
                      ) : (
                        <span className="text-[11px] text-paper/45">· sans SKU</span>
                      )}
                    </p>

                    {col.phase === "stock_propre" ? (
                      <p className="mt-2 rounded-sm border border-gold/35 bg-gold/[0.06] py-1.5 text-center text-[11px] text-gold">
                        Attribuer un SKU pour relancer
                      </p>
                    ) : (
                      <>
                        <div className="mt-2 h-[3px] w-full rounded-full bg-black/[0.08]">
                          <div className="h-[3px] rounded-full bg-gold" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1.5 text-[11px] text-paper/60">
                          {bag.isBlocked ? (
                            <>
                              {bag.doneInPhase}/{bag.totalInPhase} dans cette phase ·{" "}
                              <span className="text-danger">
                                {bag.blockedStepName} bloquée
                                {bag.blockedSubcontractNote ? ` (${bag.blockedSubcontractNote})` : ""}
                              </span>
                            </>
                          ) : bag.nextStepName ? (
                            <>
                              Prochaine : <span className="text-paper/85">{bag.nextStepName}</span>
                            </>
                          ) : (
                            `${bag.doneInPhase}/${bag.totalInPhase} etapes`
                          )}
                        </p>
                      </>
                    )}
                  </Link>
                );
              })}
              {col.bags.length === 0 && <p className="text-xs text-paper/30">Aucun sac</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
