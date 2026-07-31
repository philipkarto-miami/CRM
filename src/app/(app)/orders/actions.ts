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

  const payload = {
    order_name: str(formData, "order_name"),
    bag_id: str(formData, "bag_id") || null,
    customer_id: str(formData, "customer_id") || null,
    sale_type: str(formData, "sale_type") || "assemble",
    sale_price: str(formData, "sale_price") ? Number(str(formData, "sale_price")) : null,
    order_date: str(formData, "order_date"),
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
