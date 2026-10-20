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
    const size = sizeCode(model.baseSize);
    if (!size) continue;
    const marker = familyMarker(model.name);
    for (const color of colorChoices) {
      variants.push({
        sku: `PK${cleanDesign}${marker}${color?.code ?? ""}${size}`,
        modelId: model.id,
        modelLabel: model.label,
        colorCode: color?.code ?? null,
        colorLabel: color?.label ?? null,
      });
    }
  }
  return variants;
}
