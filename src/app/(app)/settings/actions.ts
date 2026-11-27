"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
