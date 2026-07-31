import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import type { Bag, BagStageProgress } from "@/types/database";

type BagWithProgress = Bag & { bag_stage_progress: BagStageProgress[] };

export default async function ProductionPage() {
  const supabase = createClient();
  const { data: bags } = await supabase
    .from("bags")
    .select("*, bag_stage_progress(status)")
    .order("created_at", { ascending: false });

  const typedBags = (bags as BagWithProgress[] | null) || [];

  const columns = PHASE_ORDER.map((phase) => ({
    phase,
    bags: typedBags.filter((b) => b.current_phase === phase),
  }));

  return (
    <div>
      <PageHeader eyebrow="Fabrication" title="Suivi de production" />

      <div className="grid grid-cols-7 gap-4">
        {columns.map((col) => (
          <div key={col.phase}>
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">{PHASE_LABELS[col.phase]}</p>
              <span className="text-xs text-paper/40">{col.bags.length}</span>
            </div>
            <div className="space-y-3">
              {col.bags.map((bag) => {
                const total = bag.bag_stage_progress?.length ?? 0;
                const done = bag.bag_stage_progress?.filter((p) => p.status === "termine").length ?? 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <Link
                    key={bag.id}
                    href={`/bags/${bag.id}`}
                    className="card block rounded-sm p-3 hover:border-gold"
                  >
                    <p className="text-xs text-gold">{bag.sku}</p>
                    <p className="mb-2 truncate text-sm text-paper/80">{bag.model_label}</p>
                    <div className="h-1 w-full rounded-full bg-white/10">
                      <div
                        className="h-1 rounded-full bg-gold"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-paper/40">
                      {done}/{total} etapes
                    </p>
                  </Link>
                );
              })}
              {col.bags.length === 0 && (
                <p className="text-xs text-paper/30">Aucun sac</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
