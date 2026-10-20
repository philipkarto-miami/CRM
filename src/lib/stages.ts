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

export type RecipeStepOption = { code: string; name: string; phase: StagePhase };

// Etapes proposees dans l'editeur de recette d'un SKU : une entree par colonne
// de catalogue. Les etapes qui partagent une colonne (les 4 etapes de
// desassemblage) sont regroupees en une seule ligne de recette.
// `stages` doit arriver trie par phase puis order_index.
export function toRecipeSteps(
  stages: { name: string; catalog_column: string | null; phase: StagePhase }[]
): RecipeStepOption[] {
  const byCode = new Map<string, RecipeStepOption>();
  for (const s of stages) {
    if (!s.catalog_column) continue;
    const existing = byCode.get(s.catalog_column);
    if (existing) existing.name = `${existing.name} - ${s.name}`;
    else byCode.set(s.catalog_column, { code: s.catalog_column, name: s.name, phase: s.phase });
  }
  return [...byCode.values()].map((s) =>
    s.code === "BANDS" ? { ...s, name: `${s.name} (Speedy 35+ / Keepall)` } : s
  );
}
