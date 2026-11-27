import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { atelierUser, friendlyError, loadBagContext, stageStatus, type RunRow } from "@/lib/atelier/server";
import { ATELIER_PHASE_SHORT, activeSeconds, fmtHm, isPauseReason, type PauseReason } from "@/lib/atelier/program";

// POST — chrono d'une etape. Le serveur fait foi : chaque action est un
// evenement horodate, la tablette n'affiche que le temps qui en decoule.
//   start   etape prete -> en cours (marque l'etape "en cours" dans le CRM)
//   pause   en cours -> en pause (raison, "Pause" par defaut)
//   reason  change la raison de la pause en cours
//   resume  en pause -> en cours
//   finish  termine l'etape (chrono fige + etape "terminee" dans le CRM, le sac
//           avance tout seul de phase quand la phase est complete)
//   reopen  etape terminee -> en cours (le temps entre la fin et la reouverture
//           n'est pas compte)
type Action = "start" | "pause" | "reason" | "resume" | "finish" | "reopen";
const CHANGED = "Modifié sur une autre tablette — la page se met à jour.";

const fail = (error: string, status = 409) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest, { params }: { params: { bagId: string } }) {
  const user = await atelierUser();
  if (!user) return fail("Non autorisé", 403);

  const body = (await req.json().catch(() => ({}))) as { stageId?: string; action?: Action; reason?: string };
  const bagId = params.bagId;
  const supabase = createClient();

  const { ctx, error: loadError } = await loadBagContext(supabase, bagId, false);
  if (loadError) return fail(loadError, 500);
  if (!ctx) return fail("Sac introuvable", 404);

  const prog = ctx.progress.find((p) => p.stage_id === body.stageId);
  if (!prog) return fail("Étape introuvable pour ce sac.", 404);
  const stageId = prog.stage_id;
  const stageName = prog.production_stages.name;
  const phase = prog.production_stages.phase;

  const run: RunRow | null = ctx.runs.find((r) => r.stage_id === stageId) ?? null;
  const status = stageStatus(prog, run, phase, ctx.bag.current_phase);
  const now = new Date();
  const nowIso = now.toISOString();
  const reason: PauseReason = isPauseReason(body.reason) ? body.reason : "pause";

  const event = (runId: string, type: string, pauseReason: string | null = null) =>
    supabase.from("stage_time_events").insert({
      run_id: runId,
      bag_id: bagId,
      stage_id: stageId,
      type,
      pause_reason: pauseReason,
      actor: user.id,
      at: nowIso,
    });

  const setProgress = (patch: Record<string, unknown>) =>
    supabase.from("bag_stage_progress").update(patch).eq("bag_id", bagId).eq("stage_id", stageId);

  // Reprend un chrono deja clos : le temps entre la fin et maintenant n'est pas compte.
  async function reopenClosedRun(closed: RunRow): Promise<string | null> {
    const gap = closed.finished_at
      ? Math.max(0, Math.floor((now.getTime() - Date.parse(closed.finished_at)) / 1000))
      : 0;
    const { data } = await supabase
      .from("stage_runs")
      .update({
        status: "running",
        finished_at: null,
        active_seconds: null,
        paused_seconds: closed.paused_seconds + gap,
        updated_at: nowIso,
      })
      .eq("id", closed.id)
      .eq("status", "done")
      .select("id");
    return data?.length ? closed.id : null;
  }

  async function insertRun(): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await supabase
      .from("stage_runs")
      .insert({ bag_id: bagId, stage_id: stageId, status: "running", started_at: nowIso })
      .select("id")
      .single();
    if (error || !data) return { id: null, error: error?.code === "23505" ? CHANGED : friendlyError(error?.message ?? "Impossible de démarrer.") };
    return { id: data.id as string, error: null };
  }

  switch (body.action) {
    case "start": {
      if (run && run.status !== "done") return fail("Cette étape est déjà démarrée.");
      if (status === "done") return fail("Cette étape est déjà terminée.");
      if (status === "waiting") {
        return fail(`Cette étape s'ouvre quand le sac arrive en « ${ATELIER_PHASE_SHORT[phase] ?? phase} ».`);
      }
      let runId: string | null;
      if (run) {
        // Chrono deja clos puis decoche dans le CRM : on le reprend.
        runId = await reopenClosedRun(run);
        if (!runId) return fail(CHANGED);
        await event(runId, "reopen");
      } else {
        const inserted = await insertRun();
        if (!inserted.id) return fail(inserted.error ?? CHANGED);
        runId = inserted.id;
        await event(runId, "start");
      }
      await setProgress({ status: "en_cours", completed_at: null, blocked_at: null, assigned_to: user.id });
      break;
    }

    case "pause": {
      if (run?.status !== "running") return fail("Le chrono n'est pas en cours.");
      const { data } = await supabase
        .from("stage_runs")
        .update({
          status: "paused",
          paused_at: nowIso,
          pause_reason: reason,
          pause_count: run.pause_count + 1,
          updated_at: nowIso,
        })
        .eq("id", run.id)
        .eq("status", "running")
        .select("id");
      if (!data?.length) return fail(CHANGED);
      await event(run.id, "pause", reason);
      break;
    }

    case "reason": {
      if (run?.status !== "paused") return fail("Le chrono n'est pas en pause.");
      await supabase
        .from("stage_runs")
        .update({ pause_reason: reason, updated_at: nowIso })
        .eq("id", run.id)
        .eq("status", "paused");
      const { data: last } = await supabase
        .from("stage_time_events")
        .select("id")
        .eq("run_id", run.id)
        .eq("type", "pause")
        .order("at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last) await supabase.from("stage_time_events").update({ pause_reason: reason }).eq("id", last.id);
      break;
    }

    case "resume": {
      if (run?.status !== "paused" || !run.paused_at) return fail("Le chrono n'est pas en pause.");
      const add = Math.max(0, Math.floor((now.getTime() - Date.parse(run.paused_at)) / 1000));
      const { data } = await supabase
        .from("stage_runs")
        .update({
          status: "running",
          paused_at: null,
          pause_reason: null,
          paused_seconds: run.paused_seconds + add,
          updated_at: nowIso,
        })
        .eq("id", run.id)
        .eq("status", "paused")
        .select("id");
      if (!data?.length) return fail(CHANGED);
      await event(run.id, "resume");
      break;
    }

    case "finish": {
      if (!run || run.status === "done") return fail("Le chrono n'est pas démarré.");
      // Une fin pendant une pause ferme d'abord la pause.
      const add = run.paused_at
        ? Math.max(0, Math.floor((now.getTime() - Date.parse(run.paused_at)) / 1000))
        : 0;
      const pausedSeconds = run.paused_seconds + add;
      const active = activeSeconds(
        { status: "running", startedAt: run.started_at, finishedAt: nowIso, pausedAt: null, pausedSeconds, activeSeconds: null },
        now.getTime()
      );
      const { data } = await supabase
        .from("stage_runs")
        .update({
          status: "done",
          finished_at: nowIso,
          paused_at: null,
          pause_reason: null,
          paused_seconds: pausedSeconds,
          active_seconds: active,
          updated_at: nowIso,
        })
        .eq("id", run.id)
        .eq("status", run.status)
        .select("id");
      if (!data?.length) return fail(CHANGED);

      const { error: progressError } = await setProgress({
        status: "termine",
        completed_at: nowIso,
        blocked_at: null,
        assigned_to: user.id,
      });
      if (progressError) {
        // On annule la cloture du chrono pour ne pas laisser les deux desynchronises.
        await supabase
          .from("stage_runs")
          .update({
            status: run.status,
            finished_at: null,
            active_seconds: null,
            paused_at: run.paused_at,
            pause_reason: run.pause_reason,
            paused_seconds: run.paused_seconds,
          })
          .eq("id", run.id);
        return fail(friendlyError(progressError.message), 500);
      }
      await event(run.id, "finish");
      await supabase.from("activity_log").insert({
        bag_id: bagId,
        user_id: user.id,
        action: `Etape terminee (atelier) : ${stageName} - ${fmtHm(active)}`,
      });
      break;
    }

    case "reopen": {
      let runId: string | null;
      if (run) {
        if (run.status !== "done" || !run.finished_at) return fail("Cette étape n'est pas terminée.");
        runId = await reopenClosedRun(run);
        if (!runId) return fail(CHANGED);
      } else {
        // Terminee avant le mode atelier (pas de chrono) : la rouvrir lance un chrono.
        if (status !== "done") return fail("Cette étape n'est pas terminée.");
        const inserted = await insertRun();
        if (!inserted.id) return fail(inserted.error ?? CHANGED);
        runId = inserted.id;
      }
      await event(runId, "reopen");
      await setProgress({ status: "en_cours", completed_at: null, blocked_at: null, assigned_to: user.id });
      await supabase.from("activity_log").insert({
        bag_id: bagId,
        user_id: user.id,
        action: `Etape rouverte (atelier) : ${stageName}`,
      });
      break;
    }

    default:
      return fail("Action inconnue", 400);
  }

  revalidatePath("/production");
  revalidatePath(`/bags/${bagId}`);
  return NextResponse.json({ ok: true });
}
