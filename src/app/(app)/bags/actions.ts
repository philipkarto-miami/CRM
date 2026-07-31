"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StagePhase, StageStatus } from "@/types/database";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

export async function createBag(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const modelId = str(formData, "model_id");
  const supplierId = str(formData, "supplier_id");
  const authNumber = str(formData, "auth_number_supplier");
  const deliveryDate = str(formData, "delivery_date");
  const factoryDate = str(formData, "factory_date");
  const invoiceNumber = str(formData, "invoice_number");
  const sizeVerified = formData.get("size_verified") === "on";
  const canvasVerified = formData.get("canvas_verified") === "on";

  // Tous les champs du formulaire de creation sont obligatoires (verification
  // cote serveur en complement du bouton grise cote client).
  if (
    !modelId ||
    !supplierId ||
    !authNumber ||
    !deliveryDate ||
    !factoryDate ||
    !invoiceNumber ||
    !sizeVerified ||
    !canvasVerified
  ) {
    return { error: "Merci de renseigner tous les champs" };
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
    size_verified: sizeVerified,
    canvas_verified: canvasVerified,
    supplier_id: supplierId,
    auth_number_supplier: authNumber,
    factory_date: factoryDate,
    delivery_date: deliveryDate,
    invoice_number: invoiceNumber,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.from("bags").insert(payload).select("id").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/bags");
  return { id: data.id };
}

export async function updateBag(bagId: string, formData: FormData) {
  const supabase = createClient();

  const payload = {
    // Le sku n'est plus modifiable ici : voir assignSku() (attribution depuis
    // le catalogue, qui pilote aussi les etapes de fabrication).
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

// Attribution d'un SKU depuis le stock : le SKU determine, via le catalogue
// (table sku_catalog, importee du fichier maitre de l'atelier), quelles
// etapes de fabrication s'appliquent a ce sac precis et dans quel ordre.
// On ne touche pas aux etapes "toujours applicables" (reception generale,
// controle qualite, emballage, expedition, comptabilite...), on ne fait que :
//   - supprimer les etapes pilotees par le SKU qui ne s'appliquent plus
//   - creer les etapes pilotees par le SKU qui s'appliquent et n'existent
//     pas encore (statut initial "a faire")
//   - mettre a jour l'ordre (sequence_override) / la note de sous-traitance
//     des etapes deja presentes, sans reinitialiser leur avancement
export async function assignSku(
  bagId: string,
  sku: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const cleanSku = sku.trim();
  if (!cleanSku) return { error: "SKU vide" };

  const { data: catalogEntry, error: catalogError } = await supabase
    .from("sku_catalog")
    .select("*")
    .ilike("sku", cleanSku)
    .maybeSingle();

  if (catalogError) return { error: catalogError.message };
  if (!catalogEntry) {
    return { error: `SKU "${cleanSku}" introuvable dans le catalogue.` };
  }

  const steps = (catalogEntry.steps ?? {}) as Record<string, number | string>;

  const [{ data: stages }, { data: existingProgress }] = await Promise.all([
    supabase.from("production_stages").select("*").eq("is_active", true),
    supabase.from("bag_stage_progress").select("*").eq("bag_id", bagId),
  ]);

  const existingByStage = new Map((existingProgress ?? []).map((p) => [p.stage_id, p]));

  const toDelete: string[] = [];
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; sequence_override: number | null; subcontract_note: string | null }[] = [];

  for (const stage of stages ?? []) {
    const existing = existingByStage.get(stage.id);

    // Etape toujours applicable (pas pilotee par le SKU) : on n'y touche pas.
    if (!stage.catalog_column) continue;

    const raw = steps[stage.catalog_column];
    // 0 est traite exactement comme une case vide : l'etape ne s'applique
    // pas a ce SKU (confirme sur le fichier maitre de l'atelier).
    const applicable = raw !== undefined && raw !== null && raw !== "" && raw !== 0 && raw !== "0";

    if (!applicable) {
      if (existing) toDelete.push(existing.id);
      continue;
    }

    const numeric = typeof raw === "number" ? raw : Number(raw);
    const sequence_override = Number.isFinite(numeric) ? numeric : null;
    const subcontract_note = typeof raw === "string" && !Number.isFinite(Number(raw)) ? raw : null;

    if (existing) {
      toUpdate.push({ id: existing.id, sequence_override, subcontract_note });
    } else {
      toInsert.push({
        bag_id: bagId,
        stage_id: stage.id,
        status: "a_faire",
        sequence_override,
        subcontract_note,
      });
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase.from("bag_stage_progress").delete().in("id", toDelete);
    if (error) return { error: error.message };
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("bag_stage_progress").insert(toInsert);
    if (error) return { error: error.message };
  }

  for (const u of toUpdate) {
    const { error } = await supabase
      .from("bag_stage_progress")
      .update({ sequence_override: u.sequence_override, subcontract_note: u.subcontract_note })
      .eq("id", u.id);
    if (error) return { error: error.message };
  }

  const { error: bagError } = await supabase
    .from("bags")
    .update({ sku: catalogEntry.sku, sku_edition: catalogEntry.edition })
    .eq("id", bagId);

  if (bagError) return { error: bagError.message };

  revalidatePath(`/bags/${bagId}`);
  revalidatePath("/bags");
  revalidatePath("/production");
  return {};
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
