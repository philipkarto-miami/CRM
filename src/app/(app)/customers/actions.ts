"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

export async function createCustomer(formData: FormData) {
  const supabase = createClient();
  await supabase.from("customers").insert({
    full_name: str(formData, "full_name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    address: str(formData, "address"),
    notes: str(formData, "notes"),
  });
  revalidatePath("/customers");
}

export async function deleteCustomer(customerId: string) {
  const supabase = createClient();
  await supabase.from("customers").delete().eq("id", customerId);
  revalidatePath("/customers");
}
