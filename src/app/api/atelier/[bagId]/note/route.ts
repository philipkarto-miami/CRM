import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { atelierUser, friendlyError } from "@/lib/atelier/server";

// POST — note d'une etape (transmise a la personne suivante). Elle vit sur le
// chrono : il faut donc avoir demarre l'etape.
export async function POST(req: NextRequest, { params }: { params: { bagId: string } }) {
  const user = await atelierUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { stageId?: string; note?: string };
  if (!body.stageId) return NextResponse.json({ error: "Étape manquante" }, { status: 400 });
  const note = (body.note ?? "").trim().slice(0, 2000);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("stage_runs")
    .update({ note: note || null, updated_at: new Date().toISOString() })
    .eq("bag_id", params.bagId)
    .eq("stage_id", body.stageId)
    .select("id");
  if (error) return NextResponse.json({ error: friendlyError(error.message) }, { status: 500 });
  if (!data?.length) {
    return NextResponse.json({ error: "Démarre l'étape pour ajouter une note." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
