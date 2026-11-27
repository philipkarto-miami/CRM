import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildStageDetail, loadBagContext, loadEvents, serverNow } from "@/lib/atelier/server";
import StageScreen from "./StageScreen";

export const dynamic = "force-dynamic";

// Ecran 2 — une etape : chrono, photos du modele, note, activite.
export default async function AtelierStagePage({ params }: { params: { bagId: string; stageId: string } }) {
  const supabase = createClient();
  const { ctx, error } = await loadBagContext(supabase, params.bagId);
  const events = ctx ? await loadEvents(supabase, params.bagId, params.stageId) : [];
  const detail = ctx ? buildStageDetail(ctx, params.stageId, events, serverNow()) : null;

  if (!detail) {
    return (
      <div className="af-card" style={{ textAlign: "center", padding: 40 }}>
        <p className="af-h2">{error ? "Impossible d'ouvrir cette étape" : "Étape introuvable"}</p>
        <p className="af-sub">{error ?? "Cette étape n'existe pas pour ce sac."}</p>
        <Link href={ctx ? `/atelier/${params.bagId}` : "/production"} className="af-btn af-btn--primary" style={{ marginTop: 16 }}>
          Retour
        </Link>
      </div>
    );
  }

  return <StageScreen initial={detail} />;
}
