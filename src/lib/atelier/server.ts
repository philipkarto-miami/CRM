// ── Mode atelier — chargement des donnees (cote serveur uniquement) ──────────
// Source de verite : la base. Les ecrans recoivent des "vues" deja calculees
// (statut de chaque etape, temps, photos) et ne font qu'afficher.

import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { phaseRank, sortPhaseStages } from "@/lib/stages";
import { MATERIAL_LABEL, commercialEditionFor, executionInfo } from "@/lib/execution";
import { LINE_SHEET_BY_SKU } from "@/lib/linesheet";
import { designNameFor } from "@/lib/collection";
import { dimensionsFromLabel, formatDimensions, referenceDimensions } from "@/lib/dimensions";
import {
  ATELIER_PHASES,
  MIGRATION_0034_MESSAGE,
  pauseLabel,
  stageIcon,
  type ActivityItem,
  type BagInfo,
  type BagView,
  type RunView,
  type StageDetailView,
  type StageView,
  type StageViewStatus,
} from "./program";
import type { StagePhase, UserRole } from "@/types/database";

type Sb = ReturnType<typeof createClient>;

export const serverNow = () => Date.now();

// Photos du catalogue : l'ecran reste ouvert toute la journee sur la tablette.
const PHOTO_TTL = 60 * 60 * 24;

// Seuls l'admin et le compte atelier utilisent le mode atelier.
export async function atelierUser(): Promise<{ id: string; role: UserRole; name: string } | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.role !== "admin" && profile.role !== "atelier") return null;
  return { id: profile.id as string, role: profile.role as UserRole, name: (profile.full_name || profile.email) as string };
}

// Erreur de base lisible : si une migration manque, on le dit en clair.
export function friendlyError(message: string): string {
  return /stage_runs|stage_time_events|target_minutes/i.test(message) ? MIGRATION_0034_MESSAGE : message;
}

export interface BagRow {
  id: string;
  serial_number: string;
  model_label: string;
  sku: string | null;
  current_phase: StagePhase;
  is_priority: boolean;
  delivery_date: string | null;
}

export interface ProgressRow {
  stage_id: string;
  status: "a_faire" | "en_cours" | "termine" | "bloque";
  notes: string | null;
  subcontract_note: string | null;
  sequence_override: number | null;
  production_stages: {
    id: string;
    phase: StagePhase;
    name: string;
    order_index: number;
    target_minutes: number | null;
  };
}

export interface RunRow {
  id: string;
  stage_id: string;
  status: "running" | "paused" | "done";
  started_at: string;
  finished_at: string | null;
  paused_at: string | null;
  pause_reason: string | null;
  pause_count: number;
  paused_seconds: number;
  active_seconds: number | null;
  note: string | null;
}

export interface BagContext {
  bag: BagRow;
  progress: ProgressRow[];
  runs: RunRow[];
  edition: string | null;
  // Execution et edition commerciale du code PK (migration 0035, null sinon).
  execution: string | null;
  commercialEdition: string | null;
  designName: string | null;
  photoFront: string | null;
  photoBack: string | null;
}

const RUN_COLUMNS =
  "id, stage_id, status, started_at, finished_at, paused_at, pause_reason, pause_count, paused_seconds, active_seconds, note";

async function signPaths(supabase: Sb, paths: (string | null)[]): Promise<(string | null)[]> {
  const real = paths.filter((p): p is string => Boolean(p));
  if (real.length === 0) return paths.map(() => null);
  const { data } = await supabase.storage.from("sku-photos").createSignedUrls(real, PHOTO_TTL);
  const byPath = new Map<string, string>();
  for (const item of (data ?? []) as { path: string | null; signedUrl: string | null }[]) {
    if (item.path && item.signedUrl) byPath.set(item.path, item.signedUrl);
  }
  return paths.map((p) => (p ? byPath.get(p) ?? null : null));
}

export async function loadBagContext(
  supabase: Sb,
  bagId: string,
  withPhotos = true
): Promise<{ ctx: BagContext | null; error: string | null }> {
  const { data: bag, error: bagError } = await supabase
    .from("bags")
    .select("id, serial_number, model_label, sku, current_phase, is_priority, delivery_date")
    .eq("id", bagId)
    .maybeSingle();
  if (bagError) return { ctx: null, error: friendlyError(bagError.message) };
  if (!bag) return { ctx: null, error: null };

  const [progressRes, runsRes] = await Promise.all([
    supabase
      .from("bag_stage_progress")
      .select(
        "stage_id, status, notes, subcontract_note, sequence_override, production_stages(id, phase, name, order_index, target_minutes)"
      )
      .eq("bag_id", bagId),
    supabase.from("stage_runs").select(RUN_COLUMNS).eq("bag_id", bagId),
  ]);
  if (progressRes.error) return { ctx: null, error: friendlyError(progressRes.error.message) };
  if (runsRes.error) return { ctx: null, error: friendlyError(runsRes.error.message) };

  let edition: string | null = null;
  let execution: string | null = null;
  let commercialEdition: string | null = null;
  let designName: string | null = null;
  let photoFront: string | null = null;
  let photoBack: string | null = null;
  if (bag.sku) {
    const { data: entry } = await supabase
      .from("sku_catalog")
      .select("edition, photo_path, photo_path_back")
      .eq("sku", bag.sku)
      .maybeSingle();
    if (entry) {
      edition = (entry.edition as string | null) ?? null;
      if (withPhotos) {
        [photoFront, photoBack] = await signPaths(supabase, [
          (entry.photo_path as string | null) ?? null,
          (entry.photo_path_back as string | null) ?? null,
        ]);
      }
    }
  }

  // Colonnes de la migration 0035 : lues a part, l'erreur (migration absente) est
  // ignoree et le line sheet prend le relais pour l'execution.
  if (bag.sku) {
    const { data: line } = await supabase
      .from("sku_catalog")
      .select("execution, commercial_edition")
      .eq("sku", bag.sku)
      .maybeSingle();
    execution = (line?.execution as string | null | undefined) ?? null;
    commercialEdition = (line?.commercial_edition as string | null | undefined) ?? null;
  }
  if (bag.sku) {
    // Migration 0036 : colonne lue a part (absente = on retombe sur le line sheet).
    const { data: named } = await supabase.from("sku_catalog").select("design_name").eq("sku", bag.sku).maybeSingle();
    designName = designNameFor(bag.sku as string, (named?.design_name as string | null | undefined) ?? null);
  }
  const sheet = bag.sku ? LINE_SHEET_BY_SKU.get(bag.sku as string) : undefined;
  execution = execution ?? sheet?.execution ?? null;
  commercialEdition = commercialEdition ?? sheet?.edition ?? null;

  return {
    ctx: {
      bag: bag as BagRow,
      progress: ((progressRes.data ?? []) as unknown as ProgressRow[]).filter((p) => p.production_stages),
      runs: (runsRes.data ?? []) as RunRow[],
      edition,
      execution,
      commercialEdition,
      designName,
      photoFront,
      photoBack,
    },
    error: null,
  };
}

export async function loadEvents(supabase: Sb, bagId: string, stageId: string) {
  const { data } = await supabase
    .from("stage_time_events")
    .select("type, pause_reason, at")
    .eq("bag_id", bagId)
    .eq("stage_id", stageId)
    .order("at", { ascending: false })
    .limit(30);
  return (data ?? []) as { type: string; pause_reason: string | null; at: string }[];
}

// ── Vues ─────────────────────────────────────────────────────────────────────

function toRunView(r: RunRow): RunView {
  return {
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    pausedAt: r.paused_at,
    pauseReason: r.pause_reason,
    pauseCount: r.pause_count,
    pausedSeconds: r.paused_seconds,
    activeSeconds: r.active_seconds,
    note: r.note,
  };
}

/**
 * Statut d'une etape :
 * - un chrono en cours / en pause decide ;
 * - sinon, etape terminee dans le CRM = terminee (fait avant le mode atelier ou
 *   coche a la main) ;
 * - sinon bloquee (CRM), ou chrono deja clos puis decoche dans le CRM = prete ;
 * - sinon prete si la phase est atteinte par le sac, en attente sinon.
 */
export function stageStatus(
  progress: Pick<ProgressRow, "status">,
  run: Pick<RunRow, "status"> | null,
  phase: StagePhase,
  bagPhase: StagePhase
): StageViewStatus {
  if (run && run.status !== "done") return run.status;
  if (progress.status === "termine") return "done";
  if (progress.status === "bloque") return "blocked";
  if (run) return "ready";
  return phaseRank(phase) > phaseRank(bagPhase) ? "waiting" : "ready";
}

export function buildStages(ctx: BagContext): StageView[] {
  const runBy = new Map(ctx.runs.map((r) => [r.stage_id, r]));
  const stages: StageView[] = [];

  for (const phase of ATELIER_PHASES) {
    const items = sortPhaseStages(ctx.progress.filter((p) => p.production_stages.phase === phase));
    items.forEach((p, i) => {
      const run = runBy.get(p.stage_id) ?? null;
      const target = p.production_stages.target_minutes;
      stages.push({
        id: p.stage_id,
        name: p.production_stages.name,
        phase,
        icon: stageIcon(p.production_stages.name),
        index: i + 1,
        count: items.length,
        status: stageStatus(p, run, phase, ctx.bag.current_phase),
        targetSec: target ? target * 60 : null,
        run: run ? toRunView(run) : null,
        subcontractNote: p.subcontract_note,
        crmNote: p.notes,
        crmBlocked: p.status === "bloque",
        suggested: false,
      });
    });
  }

  const next = stages.find((s) => s.phase === ctx.bag.current_phase && s.status === "ready");
  if (next) next.suggested = true;
  return stages;
}

function buildBagInfo(ctx: BagContext): BagInfo {
  const { bag } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  const isLate =
    Boolean(bag.delivery_date) &&
    (bag.delivery_date as string) < today &&
    bag.current_phase !== "shipping" &&
    bag.current_phase !== "accounting";
  const daysLate = isLate
    ? Math.round((Date.parse(today) - Date.parse(bag.delivery_date as string)) / 86_400_000)
    : 0;
  const info = executionInfo(ctx.execution);
  const sheet = bag.sku ? LINE_SHEET_BY_SKU.get(bag.sku) : undefined;
  const dims =
    dimensionsFromLabel(bag.model_label) ?? (sheet ? referenceDimensions(sheet.silhouette, sheet.size) : null);
  return {
    id: bag.id,
    serial: bag.serial_number,
    modelLabel: bag.model_label,
    sku: bag.sku,
    edition: ctx.edition,
    designName: ctx.designName,
    commercialEdition: commercialEditionFor(ctx.commercialEdition, ctx.edition),
    executionLabel: info?.label ?? null,
    materialLabel: info ? MATERIAL_LABEL[info.material] : null,
    dimensions: dims ? formatDimensions(dims) : null,
    phase: bag.current_phase,
    isPriority: bag.is_priority,
    deliveryShort: bag.delivery_date
      ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
          new Date(bag.delivery_date)
        )
      : null,
    isLate,
    daysLate,
    photoFront: ctx.photoFront,
    photoBack: ctx.photoBack,
  };
}

export function buildBagView(ctx: BagContext, now: number): BagView {
  const stages = buildStages(ctx);
  return {
    serverNow: now,
    bag: buildBagInfo(ctx),
    stages,
    totals: {
      done: stages.filter((s) => s.status === "done").length,
      total: stages.length,
      targetSec: stages.reduce((n, s) => n + (s.targetSec ?? 0), 0),
    },
  };
}

function toActivity(events: { type: string; pause_reason: string | null; at: string }[]): ActivityItem[] {
  return events.map((e) => {
    switch (e.type) {
      case "start":
        return { at: e.at, text: "Chrono démarré", tone: "ok" as const };
      case "pause":
        return { at: e.at, text: `Mis en pause — ${pauseLabel(e.pause_reason)}`, tone: "warn" as const };
      case "resume":
        return { at: e.at, text: "Reprise du chrono", tone: "default" as const };
      case "finish":
        return { at: e.at, text: "Étape terminée", tone: "ok" as const };
      default:
        return { at: e.at, text: "Étape rouverte", tone: "warn" as const };
    }
  });
}

export function buildStageDetail(
  ctx: BagContext,
  stageId: string,
  events: { type: string; pause_reason: string | null; at: string }[],
  now: number
): StageDetailView | null {
  const view = buildBagView(ctx, now);
  const stage = view.stages.find((s) => s.id === stageId);
  if (!stage) return null;
  return { ...view, stage, activity: toActivity(events) };
}
