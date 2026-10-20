import type { StagePhase } from "@/types/database";

type SortableProgress = {
  sequence_override: number | null;
  production_stages: { order_index: number };
};

// Ordre d'affichage des etapes d'une meme phase.
//
// - Une etape pilotee par le SKU (sequence_override renseigne) est positionnee
//   selon la recette du SKU.
// - Une etape toujours applicable (sans sequence_override, ex. "Ajout du
//   numero de serie") garde sa place par defaut (order_index).
//
// On conserve donc les emplacements par defaut des etapes sans override et on
// redistribue les etapes de la recette dans les emplacements restants, selon
// leur position dans la recette (puis order_index pour departager les etapes
// qui partagent la meme position, ex. les 4 etapes de desassemblage).
export function sortPhaseStages<T extends SortableProgress>(items: T[]): T[] {
  const byDefault = [...items].sort(
    (a, b) => a.production_stages.order_index - b.production_stages.order_index
  );
  const driven = byDefault
    .filter((i) => i.sequence_override !== null)
    .sort(
      (a, b) =>
        (a.sequence_override as number) - (b.sequence_override as number) ||
        a.production_stages.order_index - b.production_stages.order_index
    );

  let next = 0;
  return byDefault.map((item) => (item.sequence_override === null ? item : driven[next++]));
}

// "Ajout des bandes" : possible uniquement sur les Speedy 35 et plus, et sur
// les Keepall (toutes tailles). Meme regle que bands_allowed() cote base.
export function bandsAllowed(modelName: string | null | undefined, baseSize: string | null | undefined): boolean {
  const name = (modelName ?? "").toLowerCase();
  if (name.includes("keepall")) return true;
  if (name.includes("speedy")) {
    const match = `${baseSize ?? ""} ${modelName ?? ""}`.match(/\d+/);
    return match ? parseInt(match[0], 10) >= 35 : false;
  }
  return false;
}

// Etape "fixe" = appliquee d'office a tous les sacs, sans passer par la recette
// du SKU : toutes les etapes des phases autres que la fabrication, ainsi que
// les etapes de fabrication sans colonne de catalogue (ex. "Demarrage
// fabrication"). Seule exception : "Ajout des bandes" (colonne BANDS), fixe
// mais reservee aux Speedy 35+ et Keepall (voir bandsAllowed).
export function isFixedStage(stage: { phase: StagePhase; catalog_column: string | null }): boolean {
  return stage.phase !== "manufacturing" || !stage.catalog_column;
}

// Rang d'une phase dans le parcours d'un sac ("stock propre" = entre le
// desassemblage et la fabrication). Sert a ne pas recreer d'etapes dans une
// phase deja passee.
const PHASE_RANK: Record<StagePhase, number> = {
  reception: 0,
  disassembly: 1,
  stock_propre: 2,
  manufacturing: 3,
  quality_control: 4,
  wrapping: 5,
  shipping: 6,
  accounting: 7,
};

export function phaseRank(phase: StagePhase): number {
  return PHASE_RANK[phase] ?? 99;
}

export type RecipeStepOption = { code: string; name: string; phase: StagePhase };

// Etapes proposees dans l'editeur de recette d'un SKU : uniquement celles de la
// phase Fabrication. Les autres phases sont fixes (voir isFixedStage).
export function toRecipeSteps(
  stages: { name: string; catalog_column: string | null; phase: StagePhase }[]
): RecipeStepOption[] {
  return stages
    .filter((s) => s.catalog_column && s.phase === "manufacturing")
    .map((s) => ({ code: s.catalog_column as string, name: s.name, phase: s.phase }));
}
