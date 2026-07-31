"use client";

import { useTransition } from "react";
import { toggleStageActive, deleteStage } from "@/app/(app)/settings/actions";

export function StageToggle({ stageId, isActive }: { stageId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-xs text-paper/60">
        <input
          type="checkbox"
          className="accent-gold"
          defaultChecked={isActive}
          disabled={isPending}
          onChange={(e) => startTransition(() => toggleStageActive(stageId, e.target.checked))}
        />
        Active
      </label>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => deleteStage(stageId))}
        className="text-xs text-red-400 hover:underline"
      >
        Supprimer
      </button>
    </div>
  );
}
