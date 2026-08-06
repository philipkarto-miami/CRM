import type { OrderStatus, PaymentStatus, StagePhase, StageStatus, UserRole } from "@/types/database";

export const PHASE_LABELS: Record<StagePhase, string> = {
  reception: "Reception",
  disassembly: "A desassembler",
  stock_propre: "Stock propre (en attente d'un SKU)",
  manufacturing: "A fabriquer",
  quality_control: "A controler",
  wrapping: "A emballer",
  shipping: "A expedier",
  accounting: "Comptabilite",
};

// Ordre du pipeline. stock_propre est une phase d'attente (pas d'etapes a
// cocher) : le sac y reste jusqu'a ce qu'un SKU lui soit attribue, qui le
// fait automatiquement repartir en fabrication.
export const PHASE_ORDER: StagePhase[] = [
  "reception",
  "disassembly",
  "stock_propre",
  "manufacturing",
  "quality_control",
  "wrapping",
  "shipping",
  "accounting",
];

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  a_faire: "A faire",
  en_cours: "En cours",
  termine: "Termine",
  bloque: "Bloque",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  sac_a_commander: "Sac a commander",
  recu: "Recu",
  en_traitement: "En traitement",
  expedie: "Expedie",
  livre: "Livre",
  annule: "Annule",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  en_attente: "En attente",
  partiel: "Partiel",
  paye: "Paye",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  atelier: "Atelier",
  commercial: "Commercial",
  comptabilite: "Comptabilite",
};

export const SALE_TYPE_LABELS = {
  assemble: "Produit fini (SKU a attribuer)",
  disassemble: "Pieces detachees (en attente)",
};

// Colonnes du catalogue SKU (fichier maitre de l'atelier), dans l'ordre du
// fichier source (AS a BE). Une case vide = etape ignoree pour ce SKU ; un
// nombre = position dans la sequence de fabrication ; du texte (ex "3 & 6")
// = etape sous-traitee.
export const SKU_STEP_COLUMNS: { code: string; label: string }[] = [
  { code: "RECEPTION", label: "Reception" },
  { code: "DISASSEMBLING", label: "Desassemblage / nettoyage / fermeture eclair" },
  { code: "EMBROIDERY_SIDE", label: "Broderie cote" },
  { code: "BANDS", label: "Pose des bandes" },
  { code: "EMBROIDERY", label: "Broderie" },
  { code: "HANDLES", label: "Pose des anses" },
  { code: "LINING", label: "Doublure" },
  { code: "CLOSING", label: "Fermeture" },
  { code: "PAINTING", label: "Peinture" },
  { code: "SHOULDER_STRAP", label: "Bandouliere" },
  { code: "PATCH", label: "Patch" },
  { code: "SUBCONTRACT_1", label: "Sous-traitance (1)" },
  { code: "SUBCONTRACT_2", label: "Sous-traitance (2)" },
];
