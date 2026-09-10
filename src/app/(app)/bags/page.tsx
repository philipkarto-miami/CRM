import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import type { Bag, StagePhase } from "@/types/database";

const PAGE_SIZE = 50;

type SortKey = "serial" | "delivery";
// "Livre" = phase actuelle "Comptabilite" (derniere etape, apres expedition)
// prime sur le reste : un sac livre ne redevient jamais "attribue" ou "sans
// commande" meme si sa commande existe toujours. Les deux autres groupes se
// distinguent par la presence ou non d'une commande active (non annulee)
// rattachee.
type StockGroup = "sans_commande" | "attribue" | "livre";

const SORT_COLUMN: Record<SortKey, string> = {
  serial: "serial_number",
  delivery: "delivery_date",
};

const GROUP_LABELS: Record<StockGroup, string> = {
  sans_commande: "Sans commande",
  attribue: "Attribue a une commande",
  livre: "Livre",
};

export default async function BagsPage({
  searchParams,
}: {
  searchParams: { q?: string; phase?: string; late?: string; sort?: string; dir?: string; page?: string; group?: string };
}) {
  const supabase = createClient();
  const q = searchParams?.q?.trim() ?? "";
  const late = searchParams?.late === "1";
  const activePhase = (searchParams?.phase as StagePhase | undefined) || null;
  const activeGroup: StockGroup | null =
    searchParams?.group === "sans_commande" || searchParams?.group === "attribue" || searchParams?.group === "livre"
      ? searchParams.group
      : null;
  const sort: SortKey = searchParams?.sort === "delivery" ? "delivery" : "serial";
  const dir: "asc" | "desc" = searchParams?.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);
  const today = new Date().toISOString().slice(0, 10);
  const orFilter = q ? `serial_number.ilike.%${q}%,model_label.ilike.%${q}%,sku.ilike.%${q}%` : null;

  // Sacs rattaches a une commande active (non annulee) : sert a distinguer
  // "attribue" de "sans commande". Un sac livre (phase comptabilite) reste
  // dans le groupe "Livre" quoi qu'il arrive, voir plus bas.
  const { data: linkedBagIdRows } = await supabase
    .from("orders")
    .select("bag_id")
    .not("bag_id", "is", null)
    .neq("status", "annule");
  const linkedBagIds = Array.from(new Set((linkedBagIdRows ?? []).map((o) => o.bag_id as string)));
  const linkedSet = new Set(linkedBagIds);

  // Reference de commande visible directement dans le tableau (evite de
  // devoir ouvrir chaque sac pour savoir a quelle commande il est attribue).
  const { data: orderRefRows } = await supabase
    .from("orders")
    .select("id, bag_id, order_name")
    .not("bag_id", "is", null)
    .neq("status", "annule");
  const orderRefByBagId = new Map(
    ((orderRefRows ?? []) as { id: string; bag_id: string; order_name: string }[]).map((o) => [
      o.bag_id,
      { id: o.id, order_name: o.order_name },
    ])
  );

  // Compte des 3 groupes (respecte la recherche, comme les chips de phase,
  // mais pas le groupe actif lui-meme — comme "Toutes" pour les phases).
  let groupCountsQuery = supabase.from("bags").select("id, current_phase");
  if (orFilter) groupCountsQuery = groupCountsQuery.or(orFilter);
  const { data: groupCountRows } = await groupCountsQuery;
  let sansCommandeCount = 0;
  let attribueCount = 0;
  let livreCount = 0;
  for (const b of (groupCountRows as { id: string; current_phase: StagePhase }[] | null) ?? []) {
    if (b.current_phase === "accounting") livreCount++;
    else if (linkedSet.has(b.id)) attribueCount++;
    else sansCommandeCount++;
  }

  // Comptage par phase pour les chips (sensible a la recherche/au retard et
  // au groupe actif, mais pas au filtre de phase lui-meme, pour rester
  // coherent d'une chip a l'autre).
  let countsQuery = supabase.from("bags").select("id, current_phase");
  let totalCountQuery = supabase.from("bags").select("id", { count: "exact", head: true });
  let lateCountQuery = supabase
    .from("bags")
    .select("id", { count: "exact", head: true })
    .lt("delivery_date", today)
    .neq("current_phase", "shipping")
    .neq("current_phase", "accounting");
  let mainQuery = supabase.from("bags").select("*", { count: "exact" });

  if (orFilter) {
    countsQuery = countsQuery.or(orFilter);
    totalCountQuery = totalCountQuery.or(orFilter);
    lateCountQuery = lateCountQuery.or(orFilter);
    mainQuery = mainQuery.or(orFilter);
  }
  if (late) {
    countsQuery = countsQuery.lt("delivery_date", today).neq("current_phase", "shipping").neq("current_phase", "accounting");
    totalCountQuery = totalCountQuery.lt("delivery_date", today).neq("current_phase", "shipping").neq("current_phase", "accounting");
    mainQuery = mainQuery.lt("delivery_date", today).neq("current_phase", "shipping").neq("current_phase", "accounting");
  }
  if (activePhase) {
    mainQuery = mainQuery.eq("current_phase", activePhase);
  }

  function applyGroupFilter<T extends { eq: Function; neq: Function; in: Function; not: Function }>(query: T): T {
    if (activeGroup === "livre") {
      return query.eq("current_phase", "accounting");
    }
    if (activeGroup === "attribue") {
      if (linkedBagIds.length === 0) return query.eq("id", "00000000-0000-0000-0000-000000000000");
      return query.in("id", linkedBagIds).neq("current_phase", "accounting");
    }
    if (activeGroup === "sans_commande") {
      const withoutDelivered = query.neq("current_phase", "accounting");
      return linkedBagIds.length > 0 ? withoutDelivered.not("id", "in", `(${linkedBagIds.join(",")})`) : withoutDelivered;
    }
    return query;
  }

  countsQuery = applyGroupFilter(countsQuery);
  totalCountQuery = applyGroupFilter(totalCountQuery);
  lateCountQuery = applyGroupFilter(lateCountQuery);
  mainQuery = applyGroupFilter(mainQuery);

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
    if (activeGroup) params.set("group", activeGroup);
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

  // Changer de groupe reinitialise le filtre de phase (les phases utiles
  // different d'un groupe a l'autre) et la pagination.
  function groupHref(group: StockGroup | null) {
    return buildHref({ group, phase: null, page: null });
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

      <form className="mb-5 flex flex-wrap items-center gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="N° série, modèle, SKU…"
          className="input-base w-full px-3 py-2 text-sm sm:w-[300px]"
        />
        {activePhase && <input type="hidden" name="phase" value={activePhase} />}
        {activeGroup && <input type="hidden" name="group" value={activeGroup} />}
        {late && <input type="hidden" name="late" value="1" />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
      </form>

      {/*
        Niveau 1 : le statut commercial du sac (sans commande / attribue /
        livre). Style "onglet texte souligne", identique au niveau 1 de la
        page Commandes, pour bien le distinguer visuellement du niveau 2
        (chips de phase juste en dessous) — les deux etaient auparavant
        rendus avec le meme style de pastille, ce qui les faisait passer
        pour un seul et meme niveau de filtre.
      */}
      <div className="mb-4 flex flex-wrap gap-5 text-[13px]">
        <Link
          href={groupHref(null)}
          className={cn(
            !activeGroup ? "border-b-2 border-gold pb-0.5 font-semibold text-gold" : "text-paper/55 hover:text-gold"
          )}
        >
          Toutes · {sansCommandeCount + attribueCount + livreCount}
        </Link>
        <Link
          href={groupHref("sans_commande")}
          className={cn(
            activeGroup === "sans_commande"
              ? "border-b-2 border-gold pb-0.5 font-semibold text-gold"
              : "text-paper/55 hover:text-gold"
          )}
        >
          {GROUP_LABELS.sans_commande} · {sansCommandeCount}
        </Link>
        <Link
          href={groupHref("attribue")}
          className={cn(
            activeGroup === "attribue"
              ? "border-b-2 border-gold pb-0.5 font-semibold text-gold"
              : "text-paper/55 hover:text-gold"
          )}
        >
          {GROUP_LABELS.attribue} · {attribueCount}
        </Link>
        <Link
          href={groupHref("livre")}
          className={cn(
            activeGroup === "livre"
              ? "border-b-2 border-gold pb-0.5 font-semibold text-gold"
              : "text-paper/55 hover:text-gold"
          )}
        >
          {GROUP_LABELS.livre} · {livreCount}
        </Link>
      </div>

      {/*
        Niveau 2 : la phase de fabrication, en pastilles (plus discret). Masque
        sur l'onglet "Livre" : une seule phase (Comptabilite) y est jamais
        possible, donc ces chips ne feraient que repeter le compteur de
        l'onglet juste au-dessus.
      */}
      {activeGroup !== "livre" && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={buildHref({ phase: null })}
            className={cn(
              "rounded-full border px-3 py-[5px] text-[11px]",
              !activePhase ? "border-gold bg-gold/10 text-gold" : "border-line text-paper/60"
            )}
          >
            Toutes les phases · {totalCount}
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
      )}

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
              <th className="px-4 py-3">Commande</th>
              <th className="px-4 py-3">Statut</th>
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
              const isLate =
                !!bag.delivery_date &&
                bag.delivery_date < today &&
                bag.current_phase !== "shipping" &&
                bag.current_phase !== "accounting";
              return (
                <tr key={bag.id} className="relative border-b border-line/60 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/bags/${bag.id}`} className="absolute inset-0" aria-label={bag.serial_number} />
                    <span className="text-gold">{bag.serial_number}</span>
                  </td>
                  <td className="px-4 py-3 text-paper/80">{bag.model_label}</td>
                  <td className="px-4 py-3 text-paper/60">{bag.sku ?? "-"}</td>
                  <td className="px-4 py-3">
                    {orderRefByBagId.has(bag.id) ? (
                      <Link
                        href={`/orders/${orderRefByBagId.get(bag.id)!.id}`}
                        className="relative z-10 text-gold hover:underline"
                      >
                        {orderRefByBagId.get(bag.id)!.order_name}
                      </Link>
                    ) : (
                      <span className="text-paper/35">-</span>
                    )}
                  </td>
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
