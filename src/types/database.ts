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
// Conditions de paiement d'un client pro : pilotent la regle d'expedition
// (total = paye a 100% requis, partiel = un acompte suffit, consignement =
// aucune avance requise avant expedition).
export type PaymentTerms = "total" | "partiel" | "consignement";
// Un particulier n'a pas de fiche dans le carnet clients pro : son nom est
// saisi librement sur la commande (individual_customer_name).
export type CustomerType = "particulier" | "professionnel";

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
  // Adresse structuree, generique (valable pour n'importe quel pays) :
  // region couvre etat/province selon le pays, en texte libre.
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  payment_terms: PaymentTerms;
  payment_terms_percent: number | null;
  // Personne a contacter chez ce client pro (peut differer du nom de la
  // societe saisi dans full_name).
  contact_name: string | null;
  // Identifiant fiscal generique (ex: EIN aux USA) — pas de format impose.
  tax_id: string | null;
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
  photo_path_back: string | null;
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
  // Recopie depuis orders.is_priority quand ce sac est rattache a une
  // commande prioritaire : passe devant les autres dans le kanban de
  // production independamment de delivery_date.
  is_priority: boolean;
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
  blocked_at: string | null;
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
  // "professionnel" => customer_id renvoie vers le carnet clients pro.
  // "particulier" => customer_id est nul, le nom est saisi librement.
  customer_type: CustomerType;
  individual_customer_name: string | null;
  sale_type: SaleType;
  sale_price: number | null;
  order_date: string;
  // Saisie a la commande, recopiee automatiquement dans bags.delivery_date
  // du sac rattache (voir orders/actions.ts) pour piloter les calculs de
  // retard existants sans dupliquer la logique.
  expected_shipping_date: string | null;
  // Bascule un sac devant les autres dans le kanban de production, quelle
  // que soit sa date d'expedition prevue. Voir bags.is_priority.
  is_priority: boolean;
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
  // Historique cote commande (creation, rattachement de sac, annulation,
  // changement de statut de paiement) : voir orders/actions.ts.
  order_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
