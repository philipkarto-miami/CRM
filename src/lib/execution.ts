// Execution d'un sac (vocabulaire du line sheet 2027) et recette type associee.
//
// L'execution dit COMMENT le sac est decore : peint a la main, peint + brode,
// patch / mixed media, artwork, collector Hermes, capsule. Elle sert a :
//   - pre-remplir la recette (les etapes de fabrication) d'un nouveau code ;
//   - prevenir quand la recette d'un code ne correspond pas a son execution
//     (ex : "Peint a la main" mais une etape Broderie dans la recette) ;
//   - deduire la matiere (toile huilee ou cuir).
// Aucun import serveur : utilisable dans les composants client.

export type ExecutionKey =
  | "hand_painted"
  | "hand_painted_embroidered"
  | "patch_mixed_media"
  | "artwork"
  | "collector_hermes"
  | "limited_edition";

export type Material = "canvas" | "leather";

export type ExecutionInfo = {
  key: ExecutionKey;
  label: string;
  // Phrase courte pour l'atelier.
  hint: string;
  material: Material;
  // Recette type : codes d'etapes (catalog_column) dans l'ordre de fabrication.
  steps: string[];
  // Etapes que cette execution suppose / exclut. Une recette qui s'en ecarte
  // n'est jamais bloquee : l'ecran affiche un avertissement.
  required: string[];
  forbidden: string[];
};

export const EXECUTIONS: ExecutionInfo[] = [
  {
    key: "hand_painted",
    label: "Peint à la main",
    hint: "Peinture, anses, doublure, fermeture, bandoulière.",
    material: "canvas",
    steps: ["PAINTING", "HANDLES", "LINING", "CLOSING", "SHOULDER_STRAP"],
    required: ["PAINTING"],
    forbidden: ["EMBROIDERY", "PATCH"],
  },
  {
    key: "hand_painted_embroidered",
    label: "Peint + brodé",
    hint: "Broderie puis peinture, puis finitions.",
    material: "canvas",
    steps: ["EMBROIDERY", "PAINTING", "HANDLES", "LINING", "CLOSING", "SHOULDER_STRAP"],
    required: ["EMBROIDERY", "PAINTING"],
    forbidden: ["PATCH"],
  },
  {
    key: "patch_mixed_media",
    label: "Patch / mixed media",
    hint: "Patchs posés sur la toile, pas de peinture d'ensemble.",
    material: "canvas",
    steps: ["PATCH", "HANDLES", "LINING", "CLOSING", "SHOULDER_STRAP"],
    required: ["PATCH"],
    forbidden: [],
  },
  {
    key: "artwork",
    label: "Artwork",
    hint: "Pièce d'artiste peinte à la main (collection PK03).",
    material: "canvas",
    steps: ["PAINTING", "HANDLES", "LINING", "CLOSING", "SHOULDER_STRAP"],
    required: ["PAINTING"],
    forbidden: ["EMBROIDERY", "PATCH"],
  },
  {
    key: "collector_hermes",
    label: "Collector Hermès",
    hint: "Peinture à l'atelier, le reste en sous-traitance.",
    material: "leather",
    steps: ["PAINTING", "SUBCONTRACT_1", "SUBCONTRACT_2"],
    required: ["PAINTING"],
    forbidden: ["EMBROIDERY", "PATCH"],
  },
  {
    key: "limited_edition",
    label: "Édition limitée (capsule)",
    hint: "Brodé + peint, cuir, quantité plafonnée.",
    material: "leather",
    steps: ["EMBROIDERY", "PAINTING", "HANDLES", "LINING", "CLOSING", "SHOULDER_STRAP"],
    required: ["EMBROIDERY", "PAINTING"],
    forbidden: ["PATCH"],
  },
];

const BY_KEY = new Map(EXECUTIONS.map((e) => [e.key, e]));

export function isExecutionKey(value: unknown): value is ExecutionKey {
  return typeof value === "string" && BY_KEY.has(value as ExecutionKey);
}

export function executionInfo(key: string | null | undefined): ExecutionInfo | null {
  return key && isExecutionKey(key) ? BY_KEY.get(key) ?? null : null;
}

export const executionLabel = (key: string | null | undefined) => executionInfo(key)?.label ?? null;

export const MATERIAL_LABEL: Record<Material, string> = { canvas: "Toile huilée", leather: "Cuir" };

export function materialOf(key: string | null | undefined): Material | null {
  return executionInfo(key)?.material ?? null;
}

// Recette type au format du catalogue : { CODE: position } (1, 2, 3...).
export function templateSteps(key: string | null | undefined): Record<string, number> {
  const info = executionInfo(key);
  const out: Record<string, number> = {};
  info?.steps.forEach((code, i) => {
    out[code] = i + 1;
  });
  return out;
}

export type RecipeCheck = { missing: string[]; unexpected: string[] };

// Ecarts entre une recette (codes d'etapes actives) et son execution.
export function checkRecipe(key: string | null | undefined, stepCodes: string[]): RecipeCheck {
  const info = executionInfo(key);
  if (!info) return { missing: [], unexpected: [] };
  const present = new Set(stepCodes);
  return {
    missing: info.required.filter((c) => !present.has(c)),
    unexpected: info.forbidden.filter((c) => present.has(c)),
  };
}

// Noms lisibles (Etape de fabrication) pour les avertissements.
export const STEP_CODE_LABEL: Record<string, string> = {
  PAINTING: "Peinture",
  EMBROIDERY: "Broderie",
  PATCH: "Patch",
  HANDLES: "Anses",
  LINING: "Doublure",
  CLOSING: "Fermeture",
  SHOULDER_STRAP: "Bandoulière",
  SUBCONTRACT_1: "Sous-traitance 1",
  SUBCONTRACT_2: "Sous-traitance 2",
};

export const stepCodeLabel = (code: string) => STEP_CODE_LABEL[code] ?? code;

// Phrases d'avertissement (vide = recette coherente).
export function recipeWarnings(
  key: string | null | undefined,
  stepCodes: string[],
  nameOf: (code: string) => string = stepCodeLabel
): string[] {
  const info = executionInfo(key);
  if (!info) return [];
  const { missing, unexpected } = checkRecipe(key, stepCodes);
  const warnings: string[] = [];
  if (missing.length) warnings.push(`« ${info.label} » suppose : ${missing.map(nameOf).join(", ")}.`);
  if (unexpected.length) warnings.push(`« ${info.label} » n'a normalement pas : ${unexpected.map(nameOf).join(", ")}.`);
  return warnings;
}

// ── Edition commerciale (vocabulaire du line sheet) ──────────────────────────
// A cote de l'edition d'atelier (PK.01, PK.02, THE ARCHIVE...) : c'est le nom que
// voit l'acheteur. Les deux coexistent ; aucun n'en remplace un autre.
export const COMMERCIAL_EDITIONS = [
  "PK01 Essentials",
  "PK02 Signature",
  "PK03 Artwork",
  "PK04 Collector",
  "Capsule NFE",
] as const;

// Nom commercial deduit de l'edition d'atelier (PK.02 -> PK02 Signature), quand
// la colonne commerciale n'est pas renseignee. Null si l'edition est inconnue.
export function commercialEditionFor(
  commercial: string | null | undefined,
  atelierEdition: string | null | undefined
): string | null {
  if (commercial) return commercial;
  const m = /^PK\.?0?([1-4])\b/i.exec((atelierEdition ?? "").trim());
  return m ? COMMERCIAL_EDITIONS[Number(m[1]) - 1] : null;
}
