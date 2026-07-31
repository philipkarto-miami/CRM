"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StagePhase, StageStatus } from "@/types/database";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

export async function createBag(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    sku: str(formData, "sku"),
    serial_number: str(formData, "serial_number"),
    model_id: str(formData, "model_id") || null,
    model_label: str(formData, "model_label"),
    brand_id: str(formData, "brand_id") || null,
    size: str(formData, "size"),
    supplier_id: str(formData, "supplier_id") || null,
    auth_number_supplier: str(formData, "auth_number_supplier"),
    purchase_price: str(formData, "purchase_price") ? Number(str(formData, "purchase_price")) : null,
    purchase_date: str(formData, "purchase_date"),
    factory_date: str(formData, "factory_date"),
    photos_link: str(formData, "photos_link"),
    sale_type: str(formData, "sale_type") || "disassemble",
    notes: str(formData, "notes"),
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.from("bags").insert(payload).select("id").single();

  if (error) {
    redirect(`/bags/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/bags");
  redirect(`/bags/${data!.id}`);
}

export async function updateBag(bagId: string, formData: FormData) {
  const supabase = createClient();

  const payload = {
    model_label: str(formData, "model_label"),
    size: str(formData, "size"),
    size_verified: formData.get("size_verified") === "on",
    canvas_verified: formData.get("canvas_verified") === "on",
    canvas_notes: str(formData, "canvas_notes"),
    supplier_id: str(formData, "supplier_id") || null,
    auth_number_supplier: str(formData, "auth_number_supplier"),
    purchase_price: str(formData, "purchase_price") ? Number(str(formData, "purchase_price")) : null,
    purchase_date: str(formData, "purchase_date"),
    factory_date: str(formData, "factory_date"),
    photos_link: str(formData, "photos_link"),
    sale_type: str(formData, "sale_type") || "disassemble",
    invoice_number: str(formData, "invoice_number"),
    delivery_date: str(formData, "delivery_date"),
    current_phase: str(formData, "current_phase") as StagePhase,
    notes: str(formData, "notes"),
  };

  const { error } = await supabase.from("bags").update(payload).eq("id", bagId);

  if (error) {
    redirect(`/bags/${bagId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/bags/${bagId}`);
  revalidatePath("/bags");
}

export async function updateStageProgress(
  bagId: string,
  stageId: string,
  status: StageStatus,
  notes: string | null
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("bag_stage_progress")
    .update({
      status,
      notes,
      completed_at: status === "termine" ? new Date().toISOString() : null,
      assigned_to: user?.id ?? null,
    })
    .eq("bag_id", bagId)
    .eq("stage_id", stageId);

  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    bag_id: bagId,
    user_id: user?.id ?? null,
    action: `Etape mise a jour: ${status}`,
  });

  revalidatePath(`/bags/${bagId}`);
  revalidatePath("/production");
}

export async function deleteBag(bagId: string) {
  const supabase = createClient();
  await supabase.from("bags").delete().eq("id", bagId);
  revalidatePath("/bags");
  redirect("/bags");
}
