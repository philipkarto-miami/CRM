import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PHASE_LABELS } from "@/lib/constants";
import type { Bag, Customer, Order, StagePhase } from "@/types/database";

type OrderWithRelations = Order & {
  bags: (Bag & { current_phase: StagePhase }) | null;
  customers: Customer | null;
  bag_models: { name: string; base_size: string | null; brands: { name: string } | null } | null;
};

// Echappe un champ pour du CSV (guillemets doubles si la valeur contient une
// virgule, un guillemet ou un retour a la ligne).
function csvField(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Export CSV du tableau complet des commandes (independant des filtres
// appliques a l'affichage), pour reporting externe (Excel/Sheets).
export async function GET() {
  const supabase = createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "*, bags(serial_number, model_label, current_phase), customers(full_name), bag_models(name, base_size, brands(name))"
    )
    .order("order_date", { ascending: false });

  const rows = (orders as OrderWithRelations[] | null) ?? [];

  const header = [
    "Commande",
    "Sac (n° série)",
    "Modèle",
    "SKU",
    "Client",
    "Statut commande",
    "Statut sac",
    "Paiement",
    "Prix de vente",
    "Date",
  ];

  const lines = [header.map(csvField).join(",")];

  for (const o of rows) {
    const desiredLabel = o.bag_models
      ? [o.bag_models.brands?.name, o.bag_models.name, o.bag_models.base_size].filter(Boolean).join(" ")
      : null;
    const modele = o.bags ? o.bags.model_label : (desiredLabel ?? "");
    const sku = o.bags?.serial_number ? "" : (o.desired_sku ?? "");
    lines.push(
      [
        csvField(o.order_name),
        csvField(o.bags?.serial_number ?? ""),
        csvField(modele),
        csvField(o.desired_sku ?? sku),
        csvField(o.customers?.full_name ?? ""),
        csvField(ORDER_STATUS_LABELS[o.status] ?? o.status),
        csvField(o.bags ? PHASE_LABELS[o.bags.current_phase] : ""),
        csvField(PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status),
        csvField(o.sale_price ?? ""),
        csvField(o.order_date),
      ].join(",")
    );
  }

  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  const csv = "﻿" + lines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="commandes-philip-karto.csv"`,
    },
  });
}
