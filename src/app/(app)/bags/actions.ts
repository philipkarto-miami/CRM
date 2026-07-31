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

  const modelId = str(formData, "model_id");
  if (!modelId) {
    redirect(`/bags/new?error=${encodeURIComponent("Choisis un modele")}`);
  }

  // Le libelle affiche du sac est derive automatiquement du modele choisi
  // (ex: "Louis Vuitton Speedy 35") — plus besoin de le saisir a la main.
  const { data: model } = await supabase
    .from("bag_models")
    .select("*, brands(name)")
    .eq("id", modelId)
    .single();

  const modelLabel = model
    ? [model.brands?.name, model.name, model.base_size].filter(Boolean).join(" ")
    : "";

  const payload = {
    // sku et serial_number ne sont pas saisis a la creation : le sku reste
    // vide (modifiable plus tard sur la fiche du sac), le serial_number est
    // genere automatiquement cote base de donnees (format PKAAMMNNN).
    model_id: modelId,
    model_label: modelLabel,
    brand_id: model?.brand_id ?? null,
    size_verified: formData.get("size_verified") === "on",
    canvas_verified: formData.get("canvas_verified") === "on",
    supplier_id: str(formData, "supplier_id") || null,
    auth_number_supplier: str(formData, "auth_number_supplier"),
    factory_date: str(formData, "factory_date"),
    delivery_date: str(formData, "delivery_date"),
    invoice_number: str(formData, "invoice_number"),
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
    sku: str(formData, "sku"),
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

export async function uploadBagPhoto(bagId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return;

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${bagId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("bag-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  await supabase.from("bag_photos").insert({
    bag_id: bagId,
    storage_path: path,
    uploaded_by: user?.id ?? null,
  });

  revalidatePath(`/bags/${bagId}`);
}

export async function deleteBagPhoto(photoId: string, storagePath: string, bagId: string) {
  const supabase = createClient();
  await supabase.storage.from("bag-photos").remove([storagePath]);
  await supabase.from("bag_photos").delete().eq("id", photoId);
  revalidatePath(`/bags/${bagId}`);
}
