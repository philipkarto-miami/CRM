"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ATELIER_PHASE_SHORT,
  PAUSE_REASONS,
  fmtClock,
  fmtHm,
  pauseLabel,
  specLine,
  stageSeconds,
  type BagView,
  type PauseReason,
  type StageDetailView,
} from "@/lib/atelier/program";
import { Bar, Icon, StatusBadge } from "../../ui";
import { useLiveView, post } from "../../useLive";
import ModelPhotos from "../../ModelPhotos";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });

export default function StageScreen({ initial }: { initial: StageDetailView }) {
  const router = useRouter();
  const bagId = initial.bag.id;
  const stageId = initial.stage.id;
  const { view, refresh, now } = useLiveView(initial, `/api/atelier/${bagId}?stage=${stageId}`, 6000);
  const s = view.stage;
  // Les photos sont chargées à l'ouverture (le rafraîchissement ne les renvoie pas).
  const bag = { ...view.bag, photoFront: initial.bag.photoFront, photoBack: initial.bag.photoBack };

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(s.run?.note ?? "");
  const [noteSaved, setNoteSaved] = useState(false);

  // La note suit les changements faits depuis une autre tablette (sauf si on est en train de l'écrire).
  const serverNote = s.run?.note ?? "";
  useEffect(() => {
    setNote((n) => (document.activeElement?.id === "af-note" ? n : serverNote));
  }, [serverNote]);

  const sec = stageSeconds(s, now);
  const target = s.targetSec;
  const over = target != null && sec > target;
  const live = s.status === "running" || s.status === "paused";
  const samePhase = view.stages.filter((x) => x.phase === s.phase);

  async function timer(action: string, reason?: PauseReason) {
    setBusy(true);
    setError(null);
    const r = await post(`/api/atelier/${bagId}/timer`, { stageId, action, reason });
    if (!r.ok) setError(String(r.data.error ?? "Une erreur est survenue."));
    // Étape terminée : on enchaîne sur la suivante (sans lancer son chrono).
    if (r.ok && action === "finish") {
      await goNext();
      return;
    }
    await refresh();
    setBusy(false);
  }

  /** Prochaine étape prête après celle-ci (puis avant) ; aucune → retour aux étapes du sac. */
  async function goNext() {
    const res = await fetch(`/api/atelier/${bagId}`, { cache: "no-store" }).catch(() => null);
    const bv = res?.ok ? ((await res.json().catch(() => null)) as BagView | null) : null;
    const stages = bv?.stages ?? [];
    const i = stages.findIndex((x) => x.id === stageId);
    const next = [...stages.slice(i + 1), ...stages.slice(0, Math.max(i, 0))].find((x) => x.status === "ready");
    router.push(next ? `/atelier/${bagId}/${next.id}` : `/atelier/${bagId}`);
    router.refresh();
    setBusy(false);
  }

  async function saveNote() {
    const r = await post(`/api/atelier/${bagId}/note`, { stageId, note });
    if (!r.ok) {
      setError(String(r.data.error ?? "Impossible d'enregistrer la note."));
      return;
    }
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  }

  return (
    <>
      <nav className="af-crumb" aria-label="Fil d'Ariane">
        <Link href={`/atelier/${bagId}`}>
          <Icon name="arrowLeft" size={18} /> Étapes du sac
        </Link>
        <span>/</span>
        <span>{bag.serial}</span>
        <span>/</span>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{s.name}</span>
      </nav>

      {/* A. En-tête */}
      <section style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span
          style={{
            width: 72,
            height: 72,
            background: "var(--black)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--gold-bright)",
          }}
        >
          <Icon name={s.icon} size={36} stroke={1.4} />
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="af-eyebrow">
            Étape {String(s.index).padStart(2, "0")} sur {String(s.count).padStart(2, "0")} · {ATELIER_PHASE_SHORT[s.phase]}
          </div>
          <h1 className="af-h1">{s.name}</h1>
          <div className="af-meta" style={{ fontSize: 15 }}>
            {bag.serial} · {bag.designName ? `${bag.designName} · ` : ""}{bag.modelLabel}
            {bag.sku ? ` · ${bag.sku}` : ""}
          </div>
        </div>
        <StatusBadge status={s.status} />
      </section>

      {error && (
        <div role="alert" className="af-feedback" style={{ background: "var(--err-light)", color: "var(--err)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button className="af-btn af-btn--ghost" onClick={() => setError(null)} aria-label="Fermer">
            <Icon name="x" />
          </button>
        </div>
      )}

      <div className="af-row">
        <div className="af-col-main">
          {/* B. Chrono */}
          <section className="af-card af-card--brand" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: "999 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="af-eyebrow" style={{ color: "var(--gold-bright)" }}>
                Temps sur cette étape
              </span>
              <span role="timer" aria-live="off" style={{ fontSize: 60, fontWeight: 700, lineHeight: 1 }}>
                {fmtClock(sec)}
              </span>
              <span style={{ fontSize: 15, color: "rgba(255,255,255,0.7)" }}>
                {target != null ? (
                  <>
                    objectif {fmtClock(target)} ·{" "}
                    {over ? (
                      <strong style={{ color: "#f5b971" }}>{fmtClock(sec - target)} de dépassement</strong>
                    ) : (
                      `${fmtClock(target - sec)} restantes`
                    )}
                  </>
                ) : (
                  "Pas d'objectif pour cette étape"
                )}
              </span>
              {target != null && (
                <Bar
                  value={sec / target}
                  height={8}
                  label="Temps utilisé"
                  color={over ? "#f5b971" : "var(--gold-bright)"}
                  track="rgba(255,255,255,.18)"
                />
              )}
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                {s.status === "ready" && "Pas encore démarrée — lance le chrono pour commencer."}
                {s.status === "blocked" && "Étape bloquée dans le CRM (ex. sous-traitance). Démarrer la remet en cours."}
                {s.status === "waiting" && `Disponible quand le sac arrive en « ${ATELIER_PHASE_SHORT[s.phase]} ».`}
                {s.run && live && (
                  <>
                    Démarrée à {timeOf(s.run.startedAt)}
                    {s.run.pauseCount ? ` · en pause ${s.run.pauseCount}×` : ""}
                  </>
                )}
                {s.status === "paused" && (
                  <>
                    {" "}
                    · <strong style={{ color: "#f5b971" }}>En pause — {pauseLabel(s.run?.pauseReason)}</strong>
                  </>
                )}
                {s.status === "done" && (s.run?.finishedAt ? `Terminée à ${timeOf(s.run.finishedAt)}` : "Faite avant le mode atelier")}
              </span>
            </div>

            <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
              {(s.status === "ready" || s.status === "blocked") && (
                <button className="af-btn af-btn--gold-bright af-btn--lg af-btn--block" disabled={busy} onClick={() => timer("start")}>
                  <Icon name="play" size={18} /> Démarrer l&apos;étape
                </button>
              )}
              {s.status === "waiting" && (
                <button className="af-btn af-btn--outline-white af-btn--lg af-btn--block" disabled>
                  <Icon name="lock" size={18} /> Pas encore disponible
                </button>
              )}
              {s.status === "running" && (
                <button className="af-btn af-btn--outline-white af-btn--lg af-btn--block" disabled={busy} onClick={() => timer("pause", "pause")}>
                  <Icon name="pause" size={18} /> Mettre en pause
                </button>
              )}
              {s.status === "paused" && (
                <button className="af-btn af-btn--white af-btn--lg af-btn--block" disabled={busy} onClick={() => timer("resume")}>
                  <Icon name="play" size={18} /> Reprendre
                </button>
              )}
              {live && (
                <button className="af-btn af-btn--gold-bright af-btn--lg af-btn--block" disabled={busy} onClick={() => timer("finish")}>
                  <Icon name="check" size={18} stroke={3} /> Terminer l&apos;étape
                </button>
              )}
              {!s.crmBlocked && (s.status === "ready" || live) && (
                <button className="af-btn af-btn--outline-white af-btn--block" disabled={busy} onClick={() => timer("block")}>
                  <Icon name="lock" size={16} /> Bloquer · sous-traitance
                </button>
              )}
              {s.status === "done" && (
                <button className="af-btn af-btn--outline-white af-btn--lg af-btn--block" disabled={busy} onClick={() => timer("reopen")}>
                  <Icon name="refresh" size={18} /> Rouvrir
                </button>
              )}
            </div>

            {s.status === "paused" && (
              <div
                style={{
                  flexBasis: "100%",
                  borderTop: "1px solid rgba(255,255,255,.2)",
                  paddingTop: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>Pourquoi cette pause ?</span>
                {PAUSE_REASONS.map((r) => {
                  const on = (s.run?.pauseReason ?? "pause") === r.key;
                  return (
                    <button
                      key={r.key}
                      className="af-chip"
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => !on && timer("reason", r.key)}
                      style={
                        on
                          ? { background: "#fff", color: "var(--black)", borderColor: "#fff" }
                          : { background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.5)" }
                      }
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* C. Modèle à réaliser */}
          <section className="af-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <h2 className="af-h2">Modèle à réaliser</h2>
              <p className="af-sub" style={{ marginTop: 2 }}>
                {bag.sku ? (
                  <>
                    {bag.sku}
                    {bag.edition ? ` · ${bag.edition}` : ""}
                    {specLine(bag) ? ` · ${specLine(bag)}` : ""} — appuie sur une photo pour l&apos;agrandir.
                  </>
                ) : (
                  "Aucun code PK attribué à ce sac pour l'instant."
                )}
              </p>
            </div>
            {s.subcontractNote && (
              <div className="af-callout">
                <strong>Sous-traitance :</strong> {s.subcontractNote}
              </div>
            )}
            {s.crmNote && (
              <div className="af-callout">
                <strong>Note de l&apos;étape :</strong> {s.crmNote}
              </div>
            )}
            <ModelPhotos front={bag.photoFront} back={bag.photoBack} />
          </section>
        </div>

        {/* D. Colonne latérale */}
        <aside className="af-col-side">
          <section className="af-card">
            <h2 className="af-h2" style={{ fontSize: 18, marginBottom: 6 }}>
              {ATELIER_PHASE_SHORT[s.phase]}
            </h2>
            {samePhase.map((x) => {
              const here = x.id === stageId;
              const xs = stageSeconds(x, now);
              return (
                <Link
                  key={x.id}
                  href={`/atelier/${bagId}/${x.id}`}
                  className="af-mini"
                  style={{ fontWeight: here ? 700 : 400, color: here ? "var(--ink)" : "var(--body)" }}
                >
                  <span className={`af-dot af-dot--${x.status}`} aria-hidden />
                  <span style={{ flex: 1, minWidth: 0 }}>{x.name}</span>
                  {(x.status === "running" || x.status === "paused") && (
                    <span style={{ fontWeight: 700, color: x.status === "paused" ? "var(--warn)" : "var(--gold)" }}>{fmtClock(xs)}</span>
                  )}
                  {x.status === "done" && x.run && <span className="af-meta">{fmtHm(xs)}</span>}
                </Link>
              );
            })}
            <Link href={`/atelier/${bagId}`} className="af-btn af-btn--ghost" style={{ marginTop: 8, paddingLeft: 0 }}>
              Toutes les étapes du sac
            </Link>
          </section>

          <section className="af-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="af-h2" style={{ fontSize: 18 }}>
              Note
            </h2>
            <label htmlFor="af-note" className="af-meta">
              Pour la personne qui reprend cette étape
            </label>
            <textarea
              id="af-note"
              className="af-textarea"
              value={note}
              disabled={!s.run}
              placeholder={s.run ? "Tout ce qu'il faut savoir pour la suite" : "Démarre l'étape pour ajouter une note"}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== serverNote && saveNote()}
            />
            {noteSaved && (
              <span className="af-meta" style={{ color: "var(--ok)" }}>
                Enregistrée
              </span>
            )}
          </section>

          <section className="af-card">
            <h2 className="af-h2" style={{ fontSize: 18, marginBottom: 8 }}>
              Activité
            </h2>
            {view.activity.length === 0 && <p className="af-meta">Rien pour l&apos;instant.</p>}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {view.activity.map((a, i) => (
                <li key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 14 }}>
                  <span className="af-meta" style={{ width: 52, flexShrink: 0 }}>
                    {timeOf(a.at)}
                  </span>
                  <span style={{ color: a.tone === "ok" ? "var(--ok)" : a.tone === "warn" ? "var(--warn)" : "var(--ink)" }}>{a.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {target != null && (
            <p className="af-meta" style={{ margin: 0 }}>
              Objectif de l&apos;étape : {fmtHm(target)}. Les pauses ne sont pas comptées.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
