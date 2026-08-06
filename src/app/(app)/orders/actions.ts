"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

export async function createOrder(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bagId = str(formData, "bag_id") || null;
  const desiredModelId = str(formData, "desired_model_id") || null;

  // Une commande a soit un sac deja en stock, soit (si aucun sac disponible)
  // un modele souhaite : elle part alors dans la colonne "sac a commander"
  // en attendant qu'un sac correspondant arrive.
  if (!bagId && !desiredModelId) {
    redirect(`/orders/new?error=${encodeURIComponent("Choisis un sac en stock ou un modele souhaite")}`);
  }

  const payload = {
    order_name: str(formData, "order_name"),
    bag_id: bagId,
    desired_model_id: bagId ? null : desiredModelId,
    customer_id: str(formData, "customer_id") || null,
    sale_type: str(formData, "sale_type") || "assemble",
    sale_price: str(formData, "sale_price") ? Number(str(formData, "sale_price")) : null,
    order_date: str(formData, "order_date"),
    status: bagId ? "recu" : "sac_a_commander",
    notes: str(formData, "notes"),
    created_by: user?.id ?? null,
  };

  const { error } = await supabase.from("orders").insert(payload);

  if (error) {
    redirect(`/orders/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/orders");
  redirect("/orders");
}

// Rattache un sac disponible en stock a une commande qui attendait en "sac
// a commander" (suggere automatiquement, confirme manuellement par l'atelier).
export async function linkOrderToBag(orderId: string, bagId: string): Promise<{ error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("orders")
    .update({ bag_id: bagId, status: "recu" })
    .eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath("/orders");
  revalidatePath("/bags");
  return {};
}

export async function updateOrder(orderId: string, formData: FormData) {
  const supabase = createClient();

  const payload = {
    status: str(formData, "status"),
    payment_status: str(formData, "payment_status"),
    invoice_number: str(formData, "invoice_number"),
    shipping_carrier: str(formData, "shipping_carrier"),
    tracking_number: str(formData, "tracking_number"),
    shipped_at: str(formData, "shipped_at"),
    sale_price: str(formData, "sale_price") ? Number(str(formData, "sale_price")) : null,
    notes: str(formData, "notes"),
  };

  await supabase.from("orders").update(payload).eq("id", orderId);
  revalidatePath("/orders");
}

export async function deleteOrder(orderId: string) {
  const supabase = createClient();
  await supabase.from("orders").delete().eq("id", orderId);
  revalidatePath("/orders");
}
