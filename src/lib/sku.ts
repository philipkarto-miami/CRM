// Generation des codes PK (SKU) a partir d'un design, de couleurs et de modeles.
//
// Forme d'un code : "PK" + acronyme du design + marqueur de famille + lettre(s)
// couleur + taille
//   - marqueur de famille : "NF" pour Neverfull, "H" pour Birkin, rien pour
//     Speedy et Keepall (voir FAMILY_MARKERS)
//   - taille = nombre pour Speedy / Keepall / Birkin (25, 30, 35, 40, 45...)
//   - taille = les deux lettres pour Neverfull (PM, MM, GM)
//   ex : design POP, orange : Speedy 35 -> PKPOPO35 ; Neverfull MM -> PKPOPNFOMM ;
//        Birkin 30 -> PKPOPHO30
//
// Ce module est partage entre le formulaire (apercu en direct) et l'action
// serveur (creation reelle) pour que les deux calculent toujours les memes codes.

export const SKU_COLORS = [
  { code: "O", label: "Orange", swatch: "#E8832A" },
  { code: "G", label: "Vert", swatch: "#3E8E5B" },
  { code: "BL", label: "Bleu", swatch: "#2F6FB5" },
  { code: "B", label: "Beige", swatch: "#D9C6A3" },
  { code: "P", label: "Rose", swatch: "#E8A0B8" },
  { code: "BLK", label: "Noir", swatch: "#1A1A1A" },
  { code: "K", label: "Kaki", swatch: "#7A7A4A" },
  { code: "Y", label: "Jaune", swatch: "#E8C93A" },
  {
    code: "RB",
    label: "Rainbow",
    swatch: "linear-gradient(90deg,#e5484d,#f5a524,#f5d90a,#3e8e5b,#2f6fb5,#8e4ec6)",
  },
  { code: "GR", label: "Gris", swatch: "#9A9A9A" },
] as const;

export type SkuColorCode = (typeof SKU_COLORS)[number]["code"];

export function isSkuColorCode(value: string): value is SkuColorCode {
  return SKU_COLORS.some((c) => c.code === value);
}

// Acronyme du design : majuscules et chiffres uniquement.
export function normalizeDesign(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Taille telle qu'elle apparait dans le code : "35", "MM"... ("" si inconnue).
export function sizeCode(baseSize: string | null | undefined): string {
  return (baseSize ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Lettres ajoutees entre le design et la couleur selon la famille du modele
// (cherchees dans le nom du modele, sans tenir compte de la casse).
const FAMILY_MARKERS: { match: string; marker: string }[] = [
  { match: "neverfull", marker: "NF" },
  { match: "birkin", marker: "H" },
];

export function familyMarker(modelName: string | null | undefined): string {
  const name = (modelName ?? "").toLowerCase();
  return FAMILY_MARKERS.find((f) => name.includes(f.match))?.marker ?? "";
}

export type SkuModelInput = { id: string; name: string; label: string; baseSize: string | null };

export type SkuVariant = {
  sku: string;
  modelId: string;
  modelLabel: string;
  colorCode: SkuColorCode | null;
  colorLabel: string | null;
};

// Toutes les variantes : une par (modele coche x couleur cochee). Sans couleur
// cochee, un seul code par modele (sans lettre couleur). Les modeles sans
// taille exploitable sont ignores (voir sizeCode).
export function generateSkuVariants(
  design: string,
  colorCodes: string[],
  models: SkuModelInput[]
): SkuVariant[] {
  const cleanDesign = normalizeDesign(design);
  if (!cleanDesign) return [];

  const colors = SKU_COLORS.filter((c) => colorCodes.includes(c.code));
  const colorChoices: ({ code: SkuColorCode; label: string } | null)[] = colors.length > 0 ? [...colors] : [null];

  const variants: SkuVariant[] = [];
  for (const model of models) {
    for (const color of colorChoices) {
      const sku = buildSkuCode(cleanDesign, model.name, model.baseSize, color?.code ?? null);
      if (!sku) continue;
      variants.push({
        sku,
        modelId: model.id,
        modelLabel: model.label,
        colorCode: color?.code ?? null,
        colorLabel: color?.label ?? null,
      });
    }
  }
  return variants;
}

// Code PK d'une combinaison design + modele + couleur (null si le modele n'a
// pas de taille exploitable).
export function buildSkuCode(
  design: string,
  modelName: string | null | undefined,
  baseSize: string | null | undefined,
  colorCode: string | null
): string | null {
  const size = sizeCode(baseSize);
  if (!design || !size) return null;
  return `PK${design}${familyMarker(modelName)}${colorCode ?? ""}${size}`;
}

// ---------------------------------------------------------------------------
// Fiche d'un design existant : on coche des modeles et des couleurs, et on
// compare avec les codes deja au catalogue. Meme calcul cote ecran (apercu) et
// cote serveur (enregistrement).
// ---------------------------------------------------------------------------

// Valeur de case a cocher pour "sans lettre couleur" (anciens codes).
export const COLOR_NONE = "NONE";

export type DesignRow = { sku: string; modelId: string | null; colorCode: string | null };
export type DesignModel = { id: string; name: string; label: string; baseSize: string | null };
export type DesignCreate = { sku: string; modelId: string; modelLabel: string; colorCode: string | null };
export type DesignPlan = {
  keep: DesignRow[];
  create: DesignCreate[];
  // Codes qu'on voudrait creer mais qui existent deja ailleurs dans le catalogue.
  conflicts: { sku: string; modelLabel: string; colorCode: string | null }[];
  remove: DesignRow[];
  // Codes de la fiche sans modele rattache : jamais modifies ni supprimes ici.
  orphans: DesignRow[];
};

// Un code existant compte pour sa combinaison (modele, couleur), pas pour son
// libelle : un ancien code (PKNSQPM) n'est donc jamais "recree" au nouveau
// format (PKNSQNFPM) ni supprime.
export function planDesignChanges(args: {
  design: string;
  rows: DesignRow[];
  models: DesignModel[];
  selectedModelIds: string[];
  selectedColorKeys: string[];
  allSkus: Set<string>;
}): DesignPlan {
  const { design, rows, models, allSkus } = args;
  const modelById = new Map(models.map((m) => [m.id, m]));
  const keyOf = (modelId: string, color: string | null) => `${modelId}|${color ?? ""}`;

  const orphans = rows.filter((r) => !r.modelId || !modelById.has(r.modelId));
  const managed = rows.filter((r) => r.modelId && modelById.has(r.modelId));
  const existingKeys = new Set(managed.map((r) => keyOf(r.modelId as string, r.colorCode)));

  const colorChoices: (string | null)[] = [];
  if (args.selectedColorKeys.includes(COLOR_NONE)) colorChoices.push(null);
  for (const c of SKU_COLORS) if (args.selectedColorKeys.includes(c.code)) colorChoices.push(c.code);

  const desired = new Set<string>();
  const create: DesignCreate[] = [];
  const conflicts: DesignPlan["conflicts"] = [];
  const createdCodes = new Set<string>();

  for (const model of models) {
    if (!args.selectedModelIds.includes(model.id)) continue;
    for (const color of colorChoices) {
      const key = keyOf(model.id, color);
      desired.add(key);
      if (existingKeys.has(key)) continue;
      const sku = buildSkuCode(design, model.name, model.baseSize, color);
      if (!sku) continue;
      if (allSkus.has(sku) || createdCodes.has(sku)) {
        conflicts.push({ sku, modelLabel: model.label, colorCode: color });
        continue;
      }
      createdCodes.add(sku);
      create.push({ sku, modelId: model.id, modelLabel: model.label, colorCode: color });
    }
  }

  const bySku = (a: DesignRow, b: DesignRow) => a.sku.localeCompare(b.sku);
  const keep = managed.filter((r) => desired.has(keyOf(r.modelId as string, r.colorCode))).sort(bySku);
  const remove = managed.filter((r) => !desired.has(keyOf(r.modelId as string, r.colorCode))).sort(bySku);

  return { keep, create, conflicts, remove, orphans: [...orphans].sort(bySku) };
}
