import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PHASE_LABELS, PHASE_ORDER, SALE_TYPE_LABELS } from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import type { Bag, StagePhase } from "@/types/database";

const PAGE_SIZE = 50;

type SortKey = "serial" | "delivery";

const SORT_COLUMN: Record<SortKey, string> = {
  serial: "serial_number",
  delivery: "delivery_date",
};

export default async function BagsPage({
  searchParams,
}: {
  searchParams: { q?: string; phase?: string; late?: string; sort?: string; dir?: string; page?: string };
}) {
  const supabase = createClient();
  const q = searchParams?.q?.trim() ?? "";
  const late = searchParams?.late === "1";
  const activePhase = (searchParams?.phase as StagePhase | undefined) || null;
  const sort: SortKey = searchParams?.sort === "delivery" ? "delivery" : "serial";
  const dir: "asc" | "desc" = searchParams?.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);
  const today = new Date().toISOString().slice(0, 10);

  // Comptage par phase pour les chips (sensible a la recherche/au retard,
  // mais pas au filtre de phase lui-meme, pour rester coherent d'une chip a
  // l'autre).
  let countsQuery = supabase.from("bags").select("current_phase");
  let totalCountQuery = supabase.from("bags").select("id", { count: "exact", head: true });
  let lateCountQuery = supabase
    .from("bags")
    .select("id", { count: "exact", head: true })
    .lt("delivery_date", today)
    .neq("current_phase", "shipping");
  let mainQuery = supabase.from("bags").select("*", { count: "exact" });

  if (q) {
    const orFilter = `serial_number.ilike.%${q}%,model_label.ilike.%${q}%,sku.ilike.%${q}%`;
    countsQuery = countsQuery.or(orFilter);
    totalCountQuery = totalCountQuery.or(orFilter);
    lateCountQuery = lateCountQuery.or(orFilter);
    mainQuery = mainQuery.or(orFilter);
  }
  if (late) {
    countsQuery = countsQuery.lt("delivery_date", today).neq("current_phase", "shipping");
    totalCountQuery = totalCountQuery.lt("delivery_date", today).neq("current_phase", "shipping");
    mainQuery = mainQuery.lt("delivery_date", today).neq("current_phase", "shipping");
  }
  if (activePhase) {
    mainQuery = mainQuery.eq("current_phase", activePhase);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: countRows }, totalCountRes, lateCountRes, { data: bags, count: filteredCount }] = await Promise.all([
    countsQuery,
    totalCountQuery,
    lateCountQuery,
    mainQuery.order(SORT_COLUMN[sort], { ascending: dir === "asc" }).range(from, to),
  ]);

  const countsByPhase = new Map<string, number>();
  for (const row of (countRows as { current_phase: string }[] | null) ?? []) {
    countsByPhase.set(row.current_phase, (countsByPhase.get(row.current_phase) ?? 0) + 1);
  }
  const totalCount = totalCountRes.count ?? 0;
  const lateCount = lateCountRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil((filteredCount ?? 0) / PAGE_SIZE));

  function buildHref(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (activePhase) params.set("phase", activePhase);
    if (late) params.set("late", "1");
    params.set("sort", sort);
    params.set("dir", dir);
    if (page > 1) params.set("page", String(page));
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    if (!("page" in overrides)) params.delete("page");
    const qs = params.toString();
    return qs ? `/bags?${qs}` : "/bags";
  }

  function sortIndicator(key: SortKey) {
    if (sort !== key) return "↕";
    return dir === "asc" ? "↑" : "↓";
  }

  return (
    <div>
      <PageHeader
        eyebrow="Stock"
        title="Sacs en stock"
        action={<LinkButton href="/bags/new">+ Nouveau sac</LinkButton>}
      />

      <form className="mb-3.5 flex flex-wrap items-center gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="N° série, modèle, SKU…"
          className="input-base w-full px-3 py-2 text-sm sm:w-[300px]"
        />
        {activePhase && <input type="hidden" name="phase" value={activePhase} />}
        {late && <input type="hidden" name="late" value="1" />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={buildHref({ phase: null })}
          className={cn(
            "rounded-full border px-3 py-[5px] text-[11px]",
            !activePhase ? "border-gold bg-gold/10 text-gold" : "border-line text-paper/60"
          )}
        >
          Toutes · {totalCount}
        </Link>
        {PHASE_ORDER.filter((phase) => (countsByPhase.get(phase) ?? 0) > 0).map((phase) => (
          <Link
            key={phase}
            href={buildHref({ phase })}
            className={cn(
              "rounded-full border px-3 py-[5px] text-[11px]",
              activePhase === phase ? "border-gold bg-gold/10 text-gold" : "border-line text-paper/60"
            )}
          >
            {PHASE_LABELS[phase]} · {countsByPhase.get(phase) ?? 0}
          </Link>
        ))}
        {lateCount > 0 && (
          <Link
            href={buildHref({ late: late ? null : "1", phase: null })}
            className={cn(
              "rounded-full border px-3 py-[5px] text-[11px]",
              late ? "border-danger bg-danger/10 text-danger" : "border-danger/50 text-danger"
            )}
          >
            En retard · {lateCount}
          </Link>
        )}
      </div>

      <div className="card overflow-hidden rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-widest2 text-paper/60">
              <th className="px-4 py-3">
                <Link href={buildHref({ sort: "serial", dir: sort === "serial" && dir === "asc" ? "desc" : "asc" })}>
                  N° série {sortIndicator("serial")}
                </Link>
              </th>
              <th className="px-4 py-3">Modele</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Type de vente</th>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">
                <Link
                  href={buildHref({ sort: "delivery", dir: sort === "delivery" && dir === "asc" ? "desc" : "asc" })}
                >
                  Livraison {sortIndicator("delivery")}
                </Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {(bags as Bag[] | null)?.map((bag) => {
              const isLate = !!bag.delivery_date && bag.delivery_date < today && bag.current_phase !== "shipping";
              return (
                <tr key={bag.id} className="relative border-b border-line/60 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/bags/${bag.id}`} className="absolute inset-0" aria-label={bag.serial_number} />
                    <span className="text-gold">{bag.serial_number}</span>
                  </td>
                  <td className="px-4 py-3 text-paper/80">{bag.model_label}</td>
                  <td className="px-4 py-3 text-paper/60">{bag.sku ?? "-"}</td>
                  <td className="px-4 py-3 text-paper/60">{SALE_TYPE_LABELS[bag.sale_type]}</td>
                  <td className="px-4 py-3">
                    <Badge tone="gold">{PHASE_LABELS[bag.current_phase]}</Badge>
                  </td>
                  <td className={cn("px-4 py-3", isLate ? "text-danger" : "text-paper/60")}>
                    {isLate && "⚠ "}
                    {formatDate(bag.delivery_date)}
                  </td>
                </tr>
              );
            })}
            {(!bags || bags.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-paper/60">
                  Aucun sac ne correspond a ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-paper/60">
        <p>
          {filteredCount ?? 0} sac{(filteredCount ?? 0) > 1 ? "s" : ""} · page {page}/{totalPages}
        </p>
        <div className="flex gap-3">
          {page > 1 && (
            <Link href={buildHref({ page: String(page - 1) })} className="hover:text-gold">
              ← Precedente
            </Link>
          )}
          {page < totalPages && (
            <Link href={buildHref({ page: String(page + 1) })} className="hover:text-gold">
              Suivante →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
