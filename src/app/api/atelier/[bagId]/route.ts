import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  atelierUser,
  buildBagView,
  buildStageDetail,
  loadBagContext,
  loadEvents,
  serverNow,
} from "@/lib/atelier/server";

export const dynamic = "force-dynamic";

// GET — vue "live" d'un sac (toutes ses etapes), ou d'une etape si ?stage=<id>.
// Les tablettes l'interrogent toutes les quelques secondes : plusieurs
// tablettes sur le meme sac restent synchronisees.
export async function GET(req: NextRequest, { params }: { params: { bagId: string } }) {
  const user = await atelierUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const supabase = createClient();
  // Pas de photos ici : l'ecran garde celles chargees a l'ouverture.
  const { ctx, error } = await loadBagContext(supabase, params.bagId, false);
  if (error) return NextResponse.json({ error }, { status: 500 });
  if (!ctx) return NextResponse.json({ error: "Sac introuvable" }, { status: 404 });

  const now = serverNow();
  const stageId = req.nextUrl.searchParams.get("stage");
  if (stageId) {
    const events = await loadEvents(supabase, params.bagId, stageId);
    const detail = buildStageDetail(ctx, stageId, events, now);
    if (!detail) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });
    return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(buildBagView(ctx, now), { headers: { "Cache-Control": "no-store" } });
}
