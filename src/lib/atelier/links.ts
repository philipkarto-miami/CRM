// Ou ouvrir un sac : un sac en cours de travail (desassemblage -> emballage)
// s'ouvre dans la vue atelier (tablette, chrono) pour l'admin et le compte
// atelier. Les autres phases (reception, pret a fabriquer, expedition,
// comptabilite) et les autres roles gardent la fiche du sac du CRM.

import type { StagePhase, UserRole } from "@/types/database";
import { ATELIER_PHASES } from "./program";

export function usesAtelierView(phase: StagePhase, role: UserRole | null | undefined): boolean {
  return (role === "admin" || role === "atelier") && ATELIER_PHASES.includes(phase);
}

export function bagHref(
  bagId: string,
  phase: StagePhase | null | undefined,
  role: UserRole | null | undefined,
  from?: "production"
): string {
  if (phase && usesAtelierView(phase, role)) return `/atelier/${bagId}`;
  return `/bags/${bagId}${from ? `?from=${from}` : ""}`;
}
