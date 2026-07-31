import type { OrderStatus, PaymentStatus, StagePhase, StageStatus, UserRole } from "@/types/database";

export const PHASE_LABELS: Record<StagePhase, string> = {
  reception: "Reception",
  disassembly: "Desassemblage",
  manufacturing: "Fabrication",
  quality_control: "Controle qualite",
  wrapping: "Emballage",
  shipping: "Expedition",
  accounting: "Comptabilite",
};

export const PHASE_ORDER: StagePhase[] = [
  "reception",
  "disassembly",
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
  assemble: "Assemble",
  disassemble: "Desassemble",
};
