"use server";

import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { availabilityFromValues } from "@/lib/collection";
import { COMMERCIAL_EDITIONS, isExecutionKey } from "@/lib/execution";
import type { StagePhase, UserRole } from "@/types/database";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

export async function createStage(formData: FormData) {
  const supabase = createClient();
  const phase = str(formData, "phase") as StagePhase;
  const name = str(formData, "name");
  const orderIndex = Number(str(formData, "order_index") || "1");

  await supabase.from("production_stages").insert({
    phase,
    name,
    order_index: orderIndex,
  });

  revalidatePath("/settings/stages");
  redirect(`/settings/stages?saved=${encodeURIComponent("Etape creee")}`);
}

export async function toggleStageActive(stageId: string, isActive: boolean) {
  const supabase = createClient();
  await supabase.from("production_stages").update({ is_active: isActive }).eq("id", stageId);
  revalidatePath("/settings/stages");
}

// Objectif de temps d'une etape (mode atelier). Vide ou 0 = pas d'objectif.
export async function updateStageTarget(stageId: string, minutes: number | null): Promise<{ error?: string }> {
  const supabase = createClient();
  const value = minutes && minutes > 0 ? Math.round(minutes) : null;
  const { error } = await supabase.from("production_stages").update({ target_minutes: value }).eq("id", stageId);
  if (error) {
    return {
      error: /target_minutes/.test(error.message)
        ? "La migration 0034_chrono_atelier.sql n'est pas encore appliquee dans Supabase."
        : error.message,
    };
  }
  revalidatePath("/settings/stages");
  return {};
}

export async function deleteStage(stageId: string) {
  const supabase = createClient();
  await supabase.from("production_stages").delete().eq("id", stageId);
  revalidatePath("/settings/stages");
}

export async function updateUserRole(profileId: string, role: UserRole) {
  const supabase = createClient();
  await supabase.from("profiles").update({ role }).eq("id", profileId);
  revalidatePath("/settings/users");
}

// ── Matrice de la collection (Reglages > Collection) ─────────────────────────

const COLLECTION_URL = "/settings/collection";
const MIGRATION_0036_MESSAGE =
  "La migration 0036_matrice_collection.sql n'est pas encore appliquee dans Supabase : lance-la dans l'editeur SQL, puis reessaie.";

// Ajoute (sans id) ou modifie (avec id) un design de la matrice : nom, edition
// commerciale, execution, modeles / tailles vendus. Renommer un design renomme
// aussi les codes qui le portent ; changer d'edition met a jour l'edition
// commerciale de ses codes.
export async function saveCollectionDesign(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/dashboard");
  const supabase = createClient();

  const fail = (message: string): never => redirect(`${COLLECTION_URL}?error=${encodeURIComponent(message)}`);

  const id = str(formData, "id");
  const name = (str(formData, "name") ?? "").trim().slice(0, 80);
  const edition = str(formData, "edition") ?? "";
  const executionRaw = str(formData, "execution") ?? "";
  if (!name) fail("Le nom du design est obligatoire.");
  if (!(COMMERCIAL_EDITIONS as readonly string[]).includes(edition)) fail("Choisis une edition.");
  const execution = isExecutionKey(executionRaw) ? executionRaw : null;
  const availability = availabilityFromValues(formData.getAll("avail").map(String));
  if (Object.keys(availability).length === 0) fail("Coche au moins un modele (ex : Speedy 30).");

  let oldName: string | null = null;
  if (id) {
    const { data: current, error } = await supabase.from("collection_designs").select("name").eq("id", id).maybeSingle();
    if (error) fail(error.message.includes("collection_designs") ? MIGRATION_0036_MESSAGE : error.message);
    oldName = (current?.name as string | undefined) ?? null;
  }

  if (id) {
    const { error } = await supabase.from("collection_designs").update({ name, edition, execution, availability }).eq("id", id);
    if (error) fail(error.code === "23505" ? `Le design « ${name} » existe deja.` : error.message);
  } else {
    const { data: last } = await supabase
      .from("collection_designs")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("collection_designs")
      .insert({ name, edition, execution, availability, sort_order: ((last?.sort_order as number | undefined) ?? 0) + 1 });
    if (error) {
      fail(
        error.code === "23505"
          ? `Le design « ${name} » existe deja.`
          : /collection_designs/.test(error.message) && /exist/.test(error.message)
            ? MIGRATION_0036_MESSAGE
            : error.message
      );
    }
  }

  // Les codes suivent : nom (si renomme) et edition commerciale. Erreurs ignorees
  // si la colonne design_name n'existe pas encore (migration 0036 absente).
  if (oldName && oldName !== name) await supabase.from("sku_catalog").update({ design_name: name }).eq("design_name", oldName);
  await supabase.from("sku_catalog").update({ commercial_edition: edition }).eq("design_name", name);

  revalidatePath(COLLECTION_URL);
  revalidatePath("/catalogue");
  redirect(`${COLLECTION_URL}?saved=${encodeURIComponent(id ? "Design enregistre" : "Design ajoute")}`);
}

// Retire un design de la matrice. Les codes gardent leur nom (simple etiquette).
export async function deleteCollectionDesign(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/dashboard");
  const id = str(formData, "id");
  if (id) await createClient().from("collection_designs").delete().eq("id", id);
  revalidatePath(COLLECTION_URL);
  redirect(`${COLLECTION_URL}?saved=${encodeURIComponent("Design retire de la matrice")}`);
}
