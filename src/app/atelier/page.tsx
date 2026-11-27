import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/atelier/server";
import { ATELIER_PHASES, ATELIER_PHASE_SHORT } from "@/lib/atelier/program";
import { Badge, Bar, Icon } from "./ui";
import LiveRefresh from "./LiveRefresh";

export const dynamic = "force-dynamic";

// Accueil atelier — les sacs en cours de travail (desassemblage -> emballage).
export default async function AtelierHome({ searchParams }: { searchParams: { phase?: string } }) {
  const supabase = createClient();
  const { cards, error, runsError } = await loadHome(supabase);

  const phase = ATELIER_PHASES.find((p) => p === searchParams?.phase) ?? null;
  const shown = phase ? cards.filter((c) => c.phase === phase) : cards;

  return (
    <>
      <LiveRefresh />
      <div>
        <p className="af-eyebrow">Atelier</p>
        <h1 className="af-h1">Quel sac as-tu entre les mains ?</h1>
        <p className="af-sub">Choisis le sac pour voir ses étapes et lancer le chrono.</p>
      </div>

      {error && (
        <div role="alert" className="af-feedback" style={{ background: "var(--err-light)", color: "var(--err)" }}>
          {error}
        </div>
      )}
      {runsError && !error && (
        <div role="alert" className="af-feedback" style={{ background: "var(--warn-light)", color: "var(--warn)" }}>
          {runsError}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="/atelier" className={`af-chip${phase === null ? " af-chip--on" : ""}`}>
          Tous ({cards.length})
        </Link>
        {ATELIER_PHASES.map((p) => (
          <Link key={p} href={`/atelier?phase=${p}`} className={`af-chip${phase === p ? " af-chip--on" : ""}`}>
            {ATELIER_PHASE_SHORT[p]} ({cards.filter((c) => c.phase === p).length})
          </Link>
        ))}
      </div>

      {shown.length === 0 && !error && (
        <div className="af-card" style={{ textAlign: "center", padding: 40 }}>
          <p className="af-h2">Aucun sac à l&apos;atelier</p>
          <p className="af-sub">Les sacs apparaissent ici dès qu&apos;ils passent en désassemblage, fabrication, contrôle ou emballage.</p>
        </div>
      )}

      <div className="af-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 380px), 1fr))" }}>
        {shown.map((c) => (
          <Link key={c.id} href={`/atelier/${c.id}`} className="af-card af-bag" aria-label={`Ouvrir le sac ${c.serial}`}>
            <span className="af-thumb">
              {c.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo} alt="" />
              ) : (
                <Icon name="bag" size={36} stroke={1.4} />
              )}
            </span>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>{c.serial}</span>
                  {c.isPriority && <Badge variant="dark">Priorité</Badge>}
                  {c.isLate && <Badge variant="error">Retard {c.daysLate} j</Badge>}
                </div>
                <div className="af-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.modelLabel}
                  {c.sku ? ` · ${c.sku}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {c.done} / {c.total} étapes
                </span>
                <span className="af-meta">{ATELIER_PHASE_SHORT[c.phase]}</span>
              </div>
              <Bar value={c.total ? c.done / c.total : 0} height={6} label="Avancement du sac" />

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minHeight: 26 }}>
                {c.active.length > 0 ? (
                  c.active.map((a, i) => (
                    <Badge key={i} variant={a.status === "paused" ? "warning" : "accent"} dot>
                      {a.name}
                    </Badge>
                  ))
                ) : c.nextStep ? (
                  <span className="af-meta">Prochaine étape : {c.nextStep}</span>
                ) : (
                  <span className="af-meta">Personne dessus pour l&apos;instant</span>
                )}
                {c.deliveryShort && (
                  <span className="af-meta" style={{ marginLeft: "auto" }}>
                    Livraison {c.deliveryShort}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
