"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SKU_STEP_COLUMNS } from "@/lib/constants";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

// Lit les 13 champs d'etapes du formulaire et reconstruit l'objet steps du
// catalogue (case vide = etape ignoree, nombre = position, texte = note de
// sous-traitance).
function readSteps(formData: FormData): Record<string, number | string> {
  const steps: Record<string, number | string> = {};
  for (const { code } of SKU_STEP_COLUMNS) {
    const raw = str(formData, `step_${code}`);
    if (!raw) continue;
    const n = Number(raw);
    steps[code] = Number.isFinite(n) && raw.trim() === String(n) ? n : raw;
  }
  return steps;
}

export async function createSkuCatalogEntry(formData: FormData): Promise<void> {
  const supabase = createClient();
  const sku = str(formData, "sku")?.trim().toUpperCase();
  if (!sku) {
    redirect(`/catalogue/new?error=${encodeURIComponent("Le SKU est obligatoire")}`);
  }

  const payload = {
    sku,
    edition: str(formData, "edition"),
    description: str(formData, "description"),
    steps: readSteps(formData),
  };

  const { error } = await supabase.from("sku_catalog").insert(payload);
  if (error) {
    redirect(`/catalogue/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/catalogue");
  redirect(`/catalogue/${sku}`);
}

export async function updateSkuCatalogEntry(sku: string, formData: FormData) {
  const supabase = createClient();

  const payload = {
    edition: str(formData, "edition"),
    description: str(formData, "description"),
    steps: readSteps(formData),
  };

  await supabase.from("sku_catalog").update(payload).eq("sku", sku);
  revalidatePath("/catalogue");
  revalidatePath(`/catalogue/${sku}`);
}

export async function deleteSkuCatalogEntry(sku: string) {
  const supabase = createClient();
  await supabase.from("sku_catalog").delete().eq("sku", sku);
  revalidatePath("/catalogue");
  redirect("/catalogue");
}

export async function uploadSkuPhoto(sku: string, formData: FormData) {
  const supabase = createClient();
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return;

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${sku}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("sku-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });

  if (uploadError) throw new Error(uploadError.message);

  await supabase.from("sku_catalog").update({ photo_path: path }).eq("sku", sku);
  revalidatePath(`/catalogue/${sku}`);
}
