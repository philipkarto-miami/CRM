// Dimensions de reference des sacs (largeur x hauteur x profondeur, en cm),
// d'apres le line sheet 2027. Elles servent de repere a l'atelier (controle
// qualite, emballage) : un sac mesure s'ecarte-t-il de ce qu'on attend ?
// Valeurs identiques pour toutes les couleurs et executions d'un meme modele.

export type Dimensions = { w: number; h: number; d: number };

const REFERENCE: Record<string, Dimensions> = {
  "speedy|25": { w: 25, h: 19, d: 15 },
  "speedy|30": { w: 30, h: 21, d: 17 },
  "speedy|35": { w: 35, h: 23, d: 18 },
  "speedy|40": { w: 40, h: 25, d: 19 },
  "keepall|45": { w: 45, h: 27, d: 20 },
  "keepall|50": { w: 50, h: 29, d: 23 },
  "keepall|55": { w: 55, h: 31, d: 24 },
  "neverfull|PM": { w: 29, h: 22, d: 13 },
  "neverfull|MM": { w: 31, h: 28, d: 14 },
  "neverfull|GM": { w: 39, h: 32, d: 20 },
  "birkin|30": { w: 30, h: 22, d: 16 },
  "birkin|35": { w: 35, h: 25, d: 18 },
  "birkin|40": { w: 40, h: 30, d: 21 },
};

const FAMILIES = ["speedy", "keepall", "neverfull", "birkin"];

export function referenceDimensions(
  family: string | null | undefined,
  size: string | null | undefined
): Dimensions | null {
  const f = (family ?? "").toLowerCase();
  const s = (size ?? "").trim().toUpperCase();
  return REFERENCE[`${f}|${s}`] ?? null;
}

// A partir d'un libelle libre ("Louis Vuitton Speedy 35", "Neverfull MM").
export function dimensionsFromLabel(label: string | null | undefined): Dimensions | null {
  const text = (label ?? "").toLowerCase();
  const family = FAMILIES.find((f) => text.includes(f));
  if (!family) return null;
  const sizes = text.toUpperCase().match(/\b(?:\d{2}|PM|MM|GM)\b/g);
  return sizes ? referenceDimensions(family, sizes[sizes.length - 1]) : null;
}

export const formatDimensions = (d: Dimensions) => `${d.w} × ${d.h} × ${d.d} cm`;
