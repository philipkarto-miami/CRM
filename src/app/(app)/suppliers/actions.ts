"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

export async function createSupplier(formData: FormData) {
  const supabase = createClient();
  await supabase.from("suppliers").insert({
    name: str(formData, "name"),
    contact_name: str(formData, "contact_name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    notes: str(formData, "notes"),
  });
  revalidatePath("/suppliers");
}

export async function deleteSupplier(supplierId: string) {
  const supabase = createClient();
  await supabase.from("suppliers").delete().eq("id", supplierId);
  revalidatePath("/suppliers");
}
