// ── Mode atelier (tablette) — logique commune client / serveur ───────────────
// Une "etape" du mode atelier = une ligne de bag_stage_progress (etapes fixes +
// recette du SKU). Le chrono (stage_runs) est pose par etape et par sac. Rien ici
// n'importe de code serveur : ce fichier est utilisable dans les composants client.

import type { StagePhase } from "@/types/database";

// Phases travaillees a l'atelier. "Pret a fabriquer" (stock propre) est une
// simple attente, "expedition" et "comptabilite" restent dans le CRM (regle de
// paiement).
export const ATELIER_PHASES: StagePhase[] = ["disassembly", "manufacturing", "quality_control", "wrapping"];

export const ATELIER_PHASE_SHORT: Record<string, string> = {
  disassembly: "Désassemblage",
  manufacturing: "Fabrication",
  quality_control: "Contrôle qualité",
  wrapping: "Emballage",
};

export const MIGRATION_0034_MESSAGE =
  "La migration 0034_chrono_atelier.sql n'est pas encore appliquée dans Supabase : lance-la dans l'éditeur SQL pour activer les chronos.";

export const PAUSE_REASONS = [
  { key: "pause", label: "Pause" },
  { key: "attente_matiere", label: "Attente de matière" },
  { key: "probleme_machine", label: "Problème machine" },
  { key: "aide_collegue", label: "Aide à un collègue" },
] as const;
export type PauseReason = (typeof PAUSE_REASONS)[number]["key"];
// Raison posee automatiquement quand on bloque une etape (sous-traitance, attente
// externe) : le chrono est mis en pause, l'etape devient "bloquee" dans le CRM.
export const BLOCK_REASON = "sous_traitance";

export const isPauseReason = (v: unknown): v is PauseReason => PAUSE_REASONS.some((r) => r.key === v);
export const pauseLabel = (key: string | null | undefined) =>
  key === BLOCK_REASON ? "Bloquée · sous-traitance" : PAUSE_REASONS.find((r) => r.key === key)?.label ?? "Pause";

// ── Statut d'une etape ───────────────────────────────────────────────────────
// waiting : phase pas encore atteinte par le sac
// ready   : peut etre demarree
// blocked : marquee "bloquee" dans le CRM (ex. sous-traitance)
// running / paused / done : pilotes par le chrono
export type StageViewStatus = "waiting" | "ready" | "blocked" | "running" | "paused" | "done";

export interface RunView {
  status: "running" | "paused" | "done";
  startedAt: string;
  finishedAt: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  pauseCount: number;
  pausedSeconds: number;
  activeSeconds: number | null;
  note: string | null;
}

export interface StageView {
  id: string; // production_stages.id
  name: string;
  phase: StagePhase;
  icon: string;
  index: number; // position dans la phase (1..count)
  count: number; // nombre d'etapes dans la phase
  status: StageViewStatus;
  targetSec: number | null;
  run: RunView | null;
  subcontractNote: string | null;
  crmNote: string | null;
  // Etape marquee "bloquee" dans le CRM (sous-traitance, attente externe).
  crmBlocked: boolean;
  // Prochaine etape a faire dans la phase en cours du sac.
  suggested: boolean;
}

export interface BagInfo {
  id: string;
  serial: string;
  modelLabel: string;
  sku: string | null;
  edition: string | null;
  // Nom lisible du design (Square Painted), null si inconnu.
  designName: string | null;
  // Fiche technique (line sheet 2027) : edition commerciale, execution, matiere,
  // dimensions de reference. Null quand l'information n'est pas connue.
  commercialEdition: string | null;
  executionLabel: string | null;
  materialLabel: string | null;
  dimensions: string | null;
  phase: StagePhase;
  isPriority: boolean;
  deliveryShort: string | null;
  isLate: boolean;
  daysLate: number;
  photoFront: string | null;
  photoBack: string | null;
}

export interface BagView {
  serverNow: number;
  bag: BagInfo;
  stages: StageView[];
  totals: { done: number; total: number; targetSec: number };
}

export interface ActivityItem {
  at: string;
  text: string;
  tone: "ok" | "warn" | "default";
}

export interface StageDetailView extends BagView {
  stage: StageView;
  activity: ActivityItem[];
}

// ── Chrono ───────────────────────────────────────────────────────────────────

type TimedRun = Pick<
  RunView,
  "status" | "startedAt" | "finishedAt" | "pausedAt" | "pausedSeconds" | "activeSeconds"
>;

/** Temps actif d'un chrono en secondes, pauses exclues. */
export function activeSeconds(run: TimedRun, nowMs: number): number {
  if (run.status === "done" && run.activeSeconds != null) return run.activeSeconds;
  const end = run.finishedAt ? Date.parse(run.finishedAt) : nowMs;
  const openPause = run.pausedAt ? Math.max(0, end - Date.parse(run.pausedAt)) : 0;
  return Math.max(0, Math.floor((end - Date.parse(run.startedAt) - openPause) / 1000) - (run.pausedSeconds ?? 0));
}

/** Secondes a afficher pour une etape (0 si jamais chronometree). */
export function stageSeconds(stage: Pick<StageView, "run">, nowMs: number): number {
  return stage.run ? activeSeconds(stage.run, nowMs) : 0;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** "1h05", "45 min", "0 min" */
export function fmtHm(sec: number): string {
  const m = Math.round(Math.max(0, sec) / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

// ── Icone d'une etape (d'apres son nom) ──────────────────────────────────────

export function stageIcon(name: string): string {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/broder|monogram|marquage/.test(n)) return "sparkles";
  if (/bande/.test(n)) return "layers";
  if (/desassembl|demont/.test(n)) return "wrench";
  if (/peintur|paint|teinte|couleur/.test(n)) return "brush";
  if (/controle|qualite|verif/.test(n)) return "shield";
  if (/embal|emball|packag/.test(n)) return "package";
  if (/expedi/.test(n)) return "archive";
  if (/serie|numero|etiquet|document|facture/.test(n)) return "file";
  if (/sous-trait|soustrait|atelier ext/.test(n)) return "arrowRight";
  if (/couture|assembl|montage|finition/.test(n)) return "cog";
  return "clipboard";
}

/** "Peint + brodé · Toile huilée · 30 × 21 × 17 cm" (vide si rien n'est connu). */
export function specLine(bag: Pick<BagInfo, "executionLabel" | "materialLabel" | "dimensions">): string {
  return [bag.executionLabel, bag.materialLabel, bag.dimensions].filter(Boolean).join(" · ");
}
