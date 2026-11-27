"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ATELIER_PHASES,
  ATELIER_PHASE_SHORT,
  fmtClock,
  fmtHm,
  stageSeconds,
  type BagView,
  type StageView,
  type StageViewStatus,
} from "@/lib/atelier/program";
import { Badge, Bar, Icon, StatusBadge, headBg } from "../ui";
import { useLiveView } from "../useLive";
import ModelPhotos from "../ModelPhotos";

const FILTERS: { key: "todo" | "done" | "all"; label: string; match: (s: StageViewStatus) => boolean }[] = [
  { key: "todo", label: "À traiter", match: (s) => s !== "done" },
  { key: "done", label: "Terminées", match: (s) => s === "done" },
  { key: "all", label: "Toutes", match: () => true },
];

export default function StagesScreen({ initial }: { initial: BagView }) {
  const bagId = initial.bag.id;
  const { view, now } = useLiveView(initial, `/api/atelier/${bagId}`);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("todo");

  // Les photos sont chargées à l'ouverture (le rafraîchissement ne les renvoie pas).
  const bag = { ...view.bag, photoFront: initial.bag.photoFront, photoBack: initial.bag.photoBack };
  const t = view.totals;
  const pct = t.total ? t.done / t.total : 0;
  const logged = useMemo(() => view.stages.reduce((n, s) => n + stageSeconds(s, now), 0), [view.stages, now]);
  const allDone = view.stages.length > 0 && view.stages.every((s) => s.status === "done");
  const active = FILTERS.find((f) => f.key === filter)!;

  return (
    <>
      <nav className="af-crumb" aria-label="Fil d'Ariane">
        <Link href="/atelier">
          <Icon name="arrowLeft" size={18} /> Sacs à l&apos;atelier
        </Link>
        <span>/</span>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{bag.serial}</span>
      </nav>

      {/* A. En-tête du sac : photo du modèle + identité + avancement */}
      <section className="af-card" style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "999 1 480px", minWidth: 0, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            <ModelPhotos front={bag.photoFront} back={bag.photoBack} compact />
          </div>
          <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <p className="af-eyebrow">Sac</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 className="af-h1">{bag.serial}</h1>
              <Badge variant="dark">{ATELIER_PHASE_SHORT[bag.phase] ?? bag.phase}</Badge>
              {bag.isPriority && <Badge variant="accent">Priorité</Badge>}
              {bag.isLate && <Badge variant="error">Retard {bag.daysLate} j</Badge>}
            </div>
            <div className="af-meta" style={{ fontSize: 15 }}>
              {bag.modelLabel}
              {bag.sku ? ` · ${bag.sku}` : " · Aucun code attribué"}
              {bag.edition ? ` · ${bag.edition}` : ""}
            </div>
            {bag.deliveryShort && <div className="af-meta">Livraison prévue le {bag.deliveryShort}</div>}
          </div>
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="af-eyebrow">Avancement</span>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 26, fontWeight: 700 }}>
              {t.done} / {t.total} <span style={{ fontSize: 15, fontWeight: 400, color: "var(--body)" }}>étapes</span>
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)" }}>{Math.round(pct * 100)}%</span>
          </div>
          <Bar value={pct} height={10} label="Avancement du sac" />
          <span className="af-meta">
            {fmtHm(logged)} chronométrés{t.targetSec ? ` · objectif ${fmtHm(t.targetSec)}` : ""}
          </span>
        </div>
      </section>

      {/* Tout est fini : le sac part en expédition */}
      {allDone && (
        <section className="af-card af-card--brand" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ color: "var(--gold-bright)" }}>
            <Icon name="shield" size={32} />
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>Toutes les étapes de l&apos;atelier sont terminées</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)" }}>Le sac passe à l&apos;expédition dans le CRM.</div>
          </div>
          <Link href="/atelier" className="af-btn af-btn--white af-btn--lg">
            Retour aux sacs
          </Link>
        </section>
      )}

      {/* B. Étapes */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <h2 className="af-h2">Choisis une étape</h2>
          <p className="af-sub">Appuie sur une étape pour ouvrir son chrono. Les étapes suivent l&apos;ordre de la recette du modèle.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button key={f.key} className="af-chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} ({view.stages.filter((s) => f.match(s.status)).length})
            </button>
          ))}
        </div>

        {ATELIER_PHASES.map((phase) => {
          const inPhase = view.stages.filter((s) => s.phase === phase);
          const shown = inPhase.filter((s) => active.match(s.status));
          if (shown.length === 0) return null;
          const done = inPhase.filter((s) => s.status === "done").length;
          return (
            <div key={phase} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span className="af-eyebrow">{ATELIER_PHASE_SHORT[phase]}</span>
                <span className="af-meta">
                  {done} / {inPhase.length} terminées
                </span>
              </div>
              <div className="af-grid">
                {shown.map((s) => (
                  <StageCard key={s.id} s={s} bagId={bagId} now={now} />
                ))}
              </div>
            </div>
          );
        })}

        {view.stages.length === 0 && (
          <div className="af-card" style={{ textAlign: "center", padding: 32 }}>
            <p className="af-h2">Aucune étape pour ce sac</p>
            <p className="af-sub">Attribue d&apos;abord un code PK au sac dans le CRM : ses étapes de fabrication s&apos;affichent ensuite ici.</p>
          </div>
        )}
        {view.stages.length > 0 && !view.stages.some((s) => active.match(s.status)) && (
          <div className="af-card" style={{ textAlign: "center", padding: 28 }}>
            <p className="af-sub">Rien dans cette liste.</p>
          </div>
        )}
      </section>
    </>
  );
}

function StageCard({ s, bagId, now }: { s: StageView; bagId: string; now: number }) {
  const sec = stageSeconds(s, now);
  const live = s.status === "running" || s.status === "paused";
  const over = s.targetSec != null && sec > s.targetSec;

  let foot: React.ReactNode;
  if (s.status === "done") {
    foot = (
      <>
        <span>
          {s.run ? (
            <>
              {fmtHm(sec)}
              {s.targetSec ? ` / ${fmtHm(s.targetSec)}` : ""}
              {over && <span style={{ color: "var(--warn)", fontWeight: 600 }}> ↑{fmtHm(sec - (s.targetSec as number))}</span>}
            </>
          ) : (
            "Fait hors chrono"
          )}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ok)", fontWeight: 600 }}>
          <Icon name="check" size={16} stroke={3} /> Validée
        </span>
      </>
    );
  } else if (live) {
    foot = (
      <>
        <span>{s.status === "paused" ? "En pause" : "En cours"}</span>
        <span style={{ fontWeight: 700, color: over ? "var(--warn)" : "var(--gold)" }}>
          {fmtClock(sec)}
          {s.targetSec ? ` / ${fmtHm(s.targetSec)}` : ""}
        </span>
      </>
    );
  } else if (s.status === "waiting") {
    foot = (
      <>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Icon name="lock" size={15} /> Phase suivante
        </span>
        <span>{s.targetSec ? `Objectif ${fmtHm(s.targetSec)}` : ""}</span>
      </>
    );
  } else {
    foot = (
      <>
        <span>
          {s.status === "blocked" ? "Bloquée" : s.targetSec ? `Objectif ${fmtHm(s.targetSec)}` : "Sans objectif"}
          {s.status === "ready" && s.run ? ` · ${fmtHm(sec)} déjà` : ""}
        </span>
        <span style={{ fontWeight: 700, color: "var(--gold)" }}>{s.status === "blocked" ? "Ouvrir →" : "Démarrer →"}</span>
      </>
    );
  }

  const cls = `af-stage${live ? " af-stage--live" : ""}${s.suggested && !live ? " af-stage--suggested" : ""}${
    s.status === "waiting" ? " af-stage--waiting" : ""
  }`;

  return (
    <Link href={`/atelier/${bagId}/${s.id}`} className={cls} aria-label={`${s.name} — ${s.status}`}>
      <div className="af-stage__head" style={{ background: headBg(s.status) }}>
        <span className="af-stage__code">
          {String(s.index).padStart(2, "0")} / {String(s.count).padStart(2, "0")}
        </span>
        <span className="af-stage__badge">
          <StatusBadge status={s.status} />
        </span>
        <span style={{ color: s.status === "waiting" ? "var(--muted)" : "var(--gold)" }}>
          <Icon name={s.icon} size={44} stroke={1.3} />
        </span>
      </div>
      <div className="af-stage__body">
        <h3 className="af-stage__name">{s.name}</h3>
        {s.suggested && !live && <span className="af-eyebrow">Prochaine étape</span>}
        {s.subcontractNote && <span className="af-meta">Sous-traitance : {s.subcontractNote}</span>}
        <div className="af-stage__foot">{foot}</div>
      </div>
    </Link>
  );
}
