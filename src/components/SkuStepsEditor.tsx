"use client";

import { useMemo, useState, useTransition } from "react";
import { createCustomStep } from "@/app/(app)/catalogue/actions";
import { Input } from "@/components/ui/Field";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { StagePhase } from "@/types/database";

type StepOption = { code: string; name: string; phase: StagePhase };

export function SkuStepsEditor({
  availableSteps,
  initialSteps,
}: {
  availableSteps: StepOption[];
  initialSteps: Record<string, number | string>;
}) {
  const [steps, setSteps] = useState<StepOption[]>(availableSteps);

  // Etapes cochees, dans l'ordre de fabrication (l'ordre de la liste = la
  // sequence). On part de l'ordre existant dans initialSteps (les positions
  // numeriques triees ; les notes restent a leur place).
  const [orderedCodes, setOrderedCodes] = useState<string[]>(() =>
    Object.keys(initialSteps).sort((a, b) => {
      const av = initialSteps[a];
      const bv = initialSteps[b];
      const an = typeof av === "number" ? av : Number.isFinite(Number(av)) ? Number(av) : Infinity;
      const bn = typeof bv === "number" ? bv : Number.isFinite(Number(bv)) ? Number(bv) : Infinity;
      return an - bn;
    })
  );
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [code, v] of Object.entries(initialSteps)) {
      if (typeof v === "string" && !Number.isFinite(Number(v))) initial[code] = v;
    }
    return initial;
  });

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [newStepPhase, setNewStepPhase] = useState<StagePhase>("manufacturing");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stepByCode = useMemo(() => new Map(steps.map((s) => [s.code, s])), [steps]);
  const subcontractedCount = orderedCodes.filter((c) => c.startsWith("SUBCONTRACT")).length;

  const pool = steps.filter((s) => !orderedCodes.includes(s.code));
  const matches = query.trim()
    ? pool.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    : pool;
  const matchesByPhase = PHASE_ORDER.map((phase) => ({
    phase,
    items: matches.filter((s) => s.phase === phase),
  })).filter((g) => g.items.length > 0);
  const exactMatch = pool.some((s) => s.name.toLowerCase() === query.trim().toLowerCase());

  function addToOrder(code: string) {
    setOrderedCodes((prev) => [...prev, code]);
    setQuery("");
  }

  function removeFromOrder(code: string) {
    setOrderedCodes((prev) => prev.filter((c) => c !== code));
    setNotes((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  }

  function reorder(from: number, to: number) {
    setOrderedCodes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleCreateStep(phase: StagePhase) {
    const name = query.trim();
    if (!name || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await createCustomStep(name, phase);
      if (result.error || !result.code) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      setSteps((prev) => [...prev, { code: result.code!, name, phase }]);
      setOrderedCodes((prev) => [...prev, result.code!]);
      setQuery("");
    });
  }

  function highlight(name: string) {
    const q = query.trim();
    if (!q) return name;
    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <strong>{name.slice(idx, idx + q.length)}</strong>
        {name.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h3 className="font-serif text-lg text-paper">Recette de fabrication</h3>
        <span className="text-xs text-paper/60">
          {orderedCodes.length} etape{orderedCodes.length > 1 ? "s" : ""}
          {subcontractedCount > 0 && ` · ${subcontractedCount} sous-traitee${subcontractedCount > 1 ? "s" : ""}`}
        </span>
      </div>
      <p className="mb-3.5 text-xs text-paper/60">
        L&apos;ordre ci-dessous est celui applique a chaque sac qui recoit ce SKU.
      </p>

      {orderedCodes.length === 0 && (
        <p className="mb-2 text-xs text-paper/40">Aucune etape selectionnee — ajoute-en depuis la recherche ci-dessous.</p>
      )}

      <div className="rounded-sm border border-line">
        {orderedCodes.map((code, index) => {
          const step = stepByCode.get(code);
          const isSubcontract = code.startsWith("SUBCONTRACT");
          const expanded = expandedCode === code;
          return (
            <div
              key={code}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) reorder(dragIndex, index);
                setDragIndex(null);
              }}
              className={cn(
                "border-b border-line/60 last:border-0",
                expanded && "bg-gold/[0.04]"
              )}
            >
              <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                <span className="cursor-grab text-paper/30" aria-hidden="true">
                  ⠿
                </span>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[11px] text-white">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedCode(expanded ? null : code)}
                  className="flex-1 text-left text-[13px] text-paper/85"
                >
                  {step?.name ?? code}
                  {notes[code] && <span className="ml-1.5 text-xs text-paper/45">· note : « {notes[code]} »</span>}
                  {isSubcontract && (
                    <span className="ml-1.5 rounded-full border border-gold/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold">
                      Sous-traitee
                    </span>
                  )}
                </button>
                <input type="hidden" name={`step_${code}`} value={notes[code]?.trim() || index + 1} />
                <button
                  type="button"
                  onClick={() => removeFromOrder(code)}
                  className="text-sm text-paper/35 hover:text-danger"
                >
                  ×
                </button>
              </div>
              {expanded && (
                <div className="px-3.5 pb-3">
                  <Input
                    value={notes[code] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [code]: e.target.value }))}
                    placeholder="Note (ex: motif Popeye babord, sous-traite 3 & 6)"
                    className="w-full text-xs"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative mt-3">
        <div className="flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-[13px] text-paper/45">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ajouter une etape — taper pour chercher…"
            className="flex-1 bg-transparent text-paper outline-none placeholder:text-paper/45"
          />
        </div>

        {query.trim() && (
          <div className="absolute z-10 mt-1.5 w-full rounded-sm border border-line bg-bone shadow-lg">
            {matchesByPhase.map((group) => (
              <div key={group.phase}>
                <div className="border-b border-line/60 px-3 py-1.5 text-[10px] uppercase tracking-widest2 text-paper/45">
                  {PHASE_LABELS[group.phase]}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => addToOrder(item.code)}
                    className="flex w-full items-center justify-between border-t border-line/60 px-3 py-2 text-left text-[13px] text-paper/80 first:border-t-0 hover:bg-gold/[0.06]"
                  >
                    <span>{highlight(item.name)}</span>
                    <span className="text-[11px] text-paper/45">↵ ajouter</span>
                  </button>
                ))}
              </div>
            ))}
            {!exactMatch && (
              <div className="flex items-center gap-2 border-t border-line px-3 py-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleCreateStep(newStepPhase)}
                  className="flex-1 text-left text-xs text-gold"
                >
                  {isPending ? "Creation…" : `+ Creer l'etape « ${query.trim()} » (disponible pour tous les SKU)`}
                </button>
                <select
                  value={newStepPhase}
                  onChange={(e) => setNewStepPhase(e.target.value as StagePhase)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-sm border border-line bg-bone px-1.5 py-1 text-[11px] text-paper/70"
                >
                  {PHASE_ORDER.map((phase) => (
                    <option key={phase} value={phase}>
                      {PHASE_LABELS[phase]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      <p className="mt-2.5 text-xs text-paper/55">
        Note et sous-traitance se regardent en depliant chaque ligne. La creation d&apos;une etape inedite passe par
        cette meme recherche.
      </p>
    </div>
  );
}
