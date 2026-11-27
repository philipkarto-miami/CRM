// Matrice des editions : pour chaque design de la collection, l'edition
// commerciale (PK01..PK04), l'execution et les modeles / tailles vendus.
// Les donnees vivent en base (table collection_designs, editable dans
// Reglages > Collection) ; ce module ne contient que les regles de lecture et de
// comparaison, utilisables cote client comme cote serveur.

import type { ExecutionKey } from "./execution";
import { LINE_SHEET_BY_SKU, type LineSheetCode } from "./linesheet";

export const FAMILIES = [
  { key: "keepall", label: "Keepall", sizes: ["45", "50", "55"] },
  { key: "speedy", label: "Speedy", sizes: ["25", "30", "35", "40"] },
  { key: "neverfull", label: "Neverfull", sizes: ["PM", "MM", "GM"] },
  { key: "birkin", label: "Birkin", sizes: ["30", "35", "40"] },
] as const;

export type FamilyKey = (typeof FAMILIES)[number]["key"];
// { speedy: ["25", "30"], neverfull: ["PM"] } : ce que le design propose.
export type Availability = Partial<Record<FamilyKey, string[]>>;

export type CollectionDesign = {
  id: string;
  name: string;
  edition: string;
  execution: ExecutionKey | null;
  availability: Availability;
  sortOrder: number;
};

export type ModelRef = { name: string; baseSize: string | null };

const familyKeyOf = (name: string): FamilyKey | null => {
  const n = name.toLowerCase();
  return FAMILIES.find((f) => n.includes(f.key))?.key ?? null;
};

// Valeur de case a cocher : "speedy|25".
export const availabilityValue = (family: FamilyKey, size: string) => `${family}|${size}`;

// Nettoie le jsonb venu de la base (ou d'un formulaire) : familles et tailles
// connues uniquement, dans l'ordre d'affichage.
export function parseAvailability(raw: unknown): Availability {
  const out: Availability = {};
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const f of FAMILIES) {
    const list = obj[f.key];
    if (!Array.isArray(list)) continue;
    const sizes = f.sizes.filter((s) => list.map((x) => String(x).toUpperCase()).includes(s));
    if (sizes.length > 0) out[f.key] = [...sizes];
  }
  return out;
}

export function availabilityFromValues(values: string[]): Availability {
  const out: Record<string, string[]> = {};
  for (const v of values) {
    const [family, size] = v.split("|");
    if (!family || !size) continue;
    (out[family] ??= []).push(size);
  }
  return parseAvailability(out);
}

export function isAvailable(a: Availability, family: FamilyKey, size: string): boolean {
  return Boolean(a[family]?.includes(size));
}

// "Keepall 45/50/55 · Speedy 25/30/35/40"
export function describeAvailability(a: Availability): string {
  return FAMILIES.filter((f) => a[f.key]?.length)
    .map((f) => `${f.label} ${(a[f.key] as string[]).join("/")}`)
    .join(" · ");
}

// Identifiants des modeles de sac (bag_models) que le design propose.
export function availableModelIds(
  a: Availability,
  models: { id: string; name: string; baseSize: string | null }[]
): string[] {
  return models
    .filter((m) => {
      const family = familyKeyOf(m.name);
      return family !== null && isAvailable(a, family, (m.baseSize ?? "").toUpperCase());
    })
    .map((m) => m.id);
}

export type AvailabilityCheck = { missing: string[]; extra: string[] };

// Ecarts entre la gamme officielle d'un design et les modeles reellement
// presents (ou coches). Libelles : "Speedy 25". Modeles hors des 4 familles
// de la matrice ignores.
export function checkAvailability(a: Availability, present: ModelRef[]): AvailabilityCheck {
  const have = new Set<string>();
  const extra: string[] = [];
  for (const m of present) {
    const family = familyKeyOf(m.name);
    if (!family) continue;
    const size = (m.baseSize ?? "").toUpperCase();
    have.add(availabilityValue(family, size));
    if (!isAvailable(a, family, size)) extra.push(`${FAMILIES.find((f) => f.key === family)?.label} ${size}`.trim());
  }
  const missing: string[] = [];
  for (const f of FAMILIES) {
    for (const size of a[f.key] ?? []) {
      if (!have.has(availabilityValue(f.key, size))) missing.push(`${f.label} ${size}`);
    }
  }
  return { missing, extra: [...new Set(extra)] };
}

// Edition commerciale -> edition d'atelier (PK02 Signature -> PK.02).
export function atelierEditionFor(commercial: string | null | undefined): string | null {
  const m = /^PK0([1-4])\b/i.exec((commercial ?? "").trim());
  return m ? `PK.0${m[1]}` : null;
}

// Nom de design d'une ligne du line sheet. Le line sheet regroupe les deux
// Dragon sous « Dragon » ; la matrice les distingue par la couleur.
export function lineSheetDesignName(c: Pick<LineSheetCode, "model" | "color">): string {
  if (c.model === "Dragon") return /khaki|kaki/i.test(c.color) ? "Kaki Dragon" : "Black Dragon";
  return c.model;
}

// Nom lisible a afficher pour un code : celui de la base (migration 0036), sinon
// celui du line sheet, sinon rien (l'ecran retombe sur l'acronyme).
export function designNameFor(sku: string | null | undefined, dbName: string | null | undefined): string | null {
  if (dbName) return dbName;
  const sheet = sku ? LINE_SHEET_BY_SKU.get(sku) : undefined;
  return sheet ? lineSheetDesignName(sheet) : null;
}
