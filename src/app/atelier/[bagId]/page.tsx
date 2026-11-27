import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildBagView, loadBagContext, serverNow } from "@/lib/atelier/server";
import StagesScreen from "./StagesScreen";

export const dynamic = "force-dynamic";

// Ecran 1 — les etapes d'un sac.
export default async function AtelierBagPage({ params }: { params: { bagId: string } }) {
  const supabase = createClient();
  const { ctx, error } = await loadBagContext(supabase, params.bagId);

  if (error || !ctx) {
    return (
      <div className="af-card" style={{ textAlign: "center", padding: 40 }}>
        <p className="af-h2">{error ? "Impossible d'ouvrir ce sac" : "Sac introuvable"}</p>
        <p className="af-sub">{error ?? "Ce sac n'existe plus ou n'est pas à l'atelier."}</p>
        <Link href="/atelier" className="af-btn af-btn--primary" style={{ marginTop: 16 }}>
          Tous les sacs
        </Link>
      </div>
    );
  }

  return <StagesScreen initial={buildBagView(ctx, serverNow())} />;
}
