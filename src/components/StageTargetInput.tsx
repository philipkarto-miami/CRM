"use client";

import { useState, useTransition } from "react";
import { updateStageTarget } from "@/app/(app)/settings/actions";

// Objectif de temps d'une etape (minutes), enregistre quand on quitte le champ.
export function StageTargetInput({ stageId, minutes }: { stageId: string; minutes: number | null }) {
  const [value, setValue] = useState(minutes ? String(minutes) : "");
  const [saved, setSaved] = useState(minutes ? String(minutes) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (value === saved) return;
    setError(null);
    startTransition(async () => {
      const result = await updateStageTarget(stageId, value.trim() ? Number(value) : null);
      if (result.error) setError(result.error);
      else setSaved(value);
    });
  }

  return (
    <label className="flex items-center gap-2 text-xs text-paper/60" title={error ?? undefined}>
      Objectif
      <input
        type="number"
        min={1}
        inputMode="numeric"
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="—"
        className={`input-base w-16 px-2 py-1 text-right text-xs ${error ? "border-danger" : ""}`}
      />
      min
    </label>
  );
}
