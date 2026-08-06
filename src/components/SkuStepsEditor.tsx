"use client";

import { useMemo, useState, useTransition } from "react";
import { createCustomStep } from "@/app/(app)/catalogue/actions";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import type { StagePhase } from "@/types/database";

type StepOption = { code: string; name: string };

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
  // numeriques triees ; les notes de sous-traitance restent a leur place).
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
  const [newStepName, setNewStepName] = useState("");
  const [newStepPhase, setNewStepPhase] = useState<StagePhase>("manufacturing");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stepByCode = useMemo(() => new Map(steps.map((s) => [s.code, s])), [steps]);
  const availablePool = steps.filter((s) => !orderedCodes.includes(s.code));

  function addToOrder(code: string) {
    setOrderedCodes((prev) => [...prev, code]);
  }

  function removeFromOrder(code: string) {
    setOrderedCodes((prev) => prev.filter((c) => c !== code));
  }

  function reorder(from: number, to: number) {
    setOrderedCodes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleAddStep() {
    if (!newStepName.trim() || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await createCustomStep(newStepName, newStepPhase);
      if (result.error || !result.code) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      setSteps((prev) => [...prev, { code: result.code!, name: newStepName.trim() }]);
      setOrderedCodes((prev) => [...prev, result.code!]);
      setNewStepName("");
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs uppercase tracking-widest2 text-paper/50">
          Etapes de ce SKU, dans l&apos;ordre de fabrication
        </p>
        {orderedCodes.length === 0 && (
          <p className="text-xs text-paper/40">Aucune etape selectionnee — ajoute-en depuis la liste ci-dessous.</p>
        )}
        <ul className="space-y-1.5">
          {orderedCodes.map((code, index) => {
            const step = stepByCode.get(code);
            return (
              <li
                key={code}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) reorder(dragIndex, index);
                  setDragIndex(null);
                }}
                className="flex items-center gap-3 rounded-sm border border-line/60 bg-white/[0.02] px-3 py-2"
              >
                <span className="cursor-grab text-paper/30" aria-hidden="true">
                  ⠿
                </span>
                <span className="w-6 text-xs text-paper/40">{index + 1}</span>
                <span className="flex-1 text-sm text-paper/80">{step?.name ?? code}</span>
                <Input
                  value={notes[code] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [code]: e.target.value }))}
                  placeholder="Note (ex: sous-traite, 3 & 6)"
                  className="w-56 py-1 text-xs"
                />
                <input type="hidden" name={`step_${code}`} value={notes[code]?.trim() || index + 1} />
                <button
                  type="button"
                  onClick={() => removeFromOrder(code)}
                  className="text-xs text-paper/40 hover:text-red-400"
                >
                  Retirer
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {availablePool.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest2 text-paper/50">Etapes disponibles</p>
          <div className="flex flex-wrap gap-2">
            {availablePool.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => addToOrder(s.code)}
                className="rounded-sm border border-line/60 px-2.5 py-1 text-xs text-paper/60 hover:border-gold/50 hover:text-gold"
              >
                + {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-sm border border-line/40 p-3">
        <p className="mb-2 text-xs uppercase tracking-widest2 text-paper/50">
          Cette etape n&apos;existe pas encore ?
        </p>
        <div className="flex items-end gap-2">
          <Input
            value={newStepName}
            onChange={(e) => setNewStepName(e.target.value)}
            placeholder="Nom de la nouvelle etape"
            className="flex-1"
          />
          <Select
            value={newStepPhase}
            onChange={(e) => setNewStepPhase(e.target.value as StagePhase)}
            className="w-40"
          >
            {PHASE_ORDER.map((phase) => (
              <option key={phase} value={phase}>
                {PHASE_LABELS[phase]}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" disabled={isPending || !newStepName.trim()} onClick={handleAddStep}>
            {isPending ? "Ajout…" : "+ Nouvelle etape"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-paper/40">
          Cette etape devient disponible pour tous les SKU (et apparait dans le suivi de fabrication).
        </p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
