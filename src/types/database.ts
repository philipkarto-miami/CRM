// Types minimalistes pour les tables utilisees par l'application.
// Une fois ton projet Supabase cree et les migrations appliquees, tu peux
// generer les types exacts avec :
//   npx supabase gen types typescript --project-id <ton-project-id> > src/types/database.ts
// En attendant, ces types "a la main" permettent au projet de compiler
// et donnent l'autocompletion de base.

export type UserRole = "admin" | "atelier" | "commercial" | "comptabilite";
export type SaleType = "assemble" | "disassemble";
export type StagePhase =
  | "reception"
  | "disassembly"
  | "stock_propre"
  | "manufacturing"
  | "quality_control"
  | "wrapping"
  | "shipping"
  | "accounting";
export type StageStatus = "a_faire" | "en_cours" | "termine" | "bloque";
export type PaymentStatus = "en_attente" | "partiel" | "paye";
export type OrderStatus = "recu" | "en_traitement" | "expedie" | "livre" | "annule" | "sac_a_commander";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface BagModel {
  id: string;
  brand_id: string | null;
  name: string;
  base_size: string | null;
  sort_order: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProductionStage {
  id: string;
  phase: StagePhase;
  name: string;
  order_index: number;
  is_active: boolean;
  // Colonne du catalogue SKU qui pilote cette etape (RECEPTION, EMBROIDERY,
  // SUBCONTRACT_1...). Null = etape toujours applicable, independante du SKU.
  catalog_column: string | null;
  created_at: string;
}

// steps: cle = code catalog_column (ex "EMBROIDERY"), valeur = position dans
// la sequence de fabrication de ce SKU (number), une note de sous-traitance
// (string, ex "3 & 6"), ou absente si l'etape ne s'applique pas a ce SKU.
export type SkuCatalogSteps = Record<string, number | string>;

export interface SkuCatalog {
  id: string;
  sku: string;
  edition: string | null;
  description: string | null;
  photo_path: string | null;
  // Modele/taille fournisseur exact que ce SKU (modele PK) transforme —
  // un SKU ne correspond toujours qu'a un seul modele fournisseur.
  bag_model_id: string | null;
  steps: SkuCatalogSteps;
  created_at: string;
  updated_at: string;
}

export interface Bag {
  id: string;
  sku: string | null;
  sku_edition: string | null;
  serial_number: string;
  model_id: string | null;
  model_label: string;
  brand_id: string | null;
  size: string | null;
  size_verified: boolean;
  canvas_verified: boolean;
  canvas_notes: string | null;
  supplier_id: string | null;
  auth_number_supplier: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  factory_date: string | null;
  photos_link: string | null;
  sale_type: SaleType;
  current_phase: StagePhase;
  invoice_number: string | null;
  delivery_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BagPhoto {
  id: string;
  bag_id: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface BagStageProgress {
  id: string;
  bag_id: string;
  stage_id: string;
  status: StageStatus;
  assigned_to: string | null;
  completed_at: string | null;
  notes: string | null;
  sequence_override: number | null;
  subcontract_note: string | null;
}

export interface Order {
  id: string;
  order_name: string;
  bag_id: string | null;
  // Modele souhaite quand la commande n'a pas encore de sac lie (statut
  // "sac_a_commander") : permet de suggerer un rattachement quand un sac de
  // ce modele arrive en stock.
  desired_model_id: string | null;
  // SKU (modele PK) precis vise quand la commande n'a pas encore de sac.
  desired_sku: string | null;
  customer_id: string | null;
  sale_type: SaleType;
  sale_price: number | null;
  order_date: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  invoice_number: string | null;
  shipping_carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  bag_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
