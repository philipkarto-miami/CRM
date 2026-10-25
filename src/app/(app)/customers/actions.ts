"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

export async function createCustomer(formData: FormData) {
  const supabase = createClient();
  const paymentTerms = str(formData, "payment_terms") || "total";
  const paymentTermsPercent =
    paymentTerms === "partiel" && str(formData, "payment_terms_percent")
      ? Number(str(formData, "payment_terms_percent"))
      : null;

  const { error } = await supabase.from("customers").insert({
    full_name: str(formData, "full_name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    address_line1: str(formData, "address_line1"),
    address_line2: str(formData, "address_line2"),
    city: str(formData, "city"),
    region: str(formData, "region"),
    postal_code: str(formData, "postal_code"),
    country: str(formData, "country"),
    contact_name: str(formData, "contact_name"),
    tax_id: str(formData, "tax_id"),
    notes: str(formData, "notes"),
    payment_terms: paymentTerms,
    payment_terms_percent: paymentTermsPercent,
  });

  if (error) {
    redirect(`/customers/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/customers");
  redirect(`/customers?saved=${encodeURIComponent("Client cree")}`);
}

// Modification de la fiche d'un client pro (memes champs qu'a la creation).
export async function updateCustomer(customerId: string, formData: FormData) {
  const supabase = createClient();
  const ficheUrl = `/customers/${customerId}`;

  const fullName = str(formData, "full_name")?.trim();
  if (!fullName) {
    redirect(`${ficheUrl}?error=${encodeURIComponent("Le nom de la societe est obligatoire.")}`);
  }

  const paymentTerms = str(formData, "payment_terms") || "total";
  const percentRaw = str(formData, "payment_terms_percent");
  const paymentTermsPercent = paymentTerms === "partiel" && percentRaw ? Number(percentRaw) : null;
  if (paymentTerms === "partiel" && (!paymentTermsPercent || paymentTermsPercent < 1 || paymentTermsPercent > 100)) {
    redirect(`${ficheUrl}?error=${encodeURIComponent("Indique un pourcentage d'acompte entre 1 et 100.")}`);
  }

  const { error } = await supabase
    .from("customers")
    .update({
      full_name: fullName,
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      address_line1: str(formData, "address_line1"),
      address_line2: str(formData, "address_line2"),
      city: str(formData, "city"),
      region: str(formData, "region"),
      postal_code: str(formData, "postal_code"),
      country: str(formData, "country"),
      contact_name: str(formData, "contact_name"),
      tax_id: str(formData, "tax_id"),
      notes: str(formData, "notes"),
      payment_terms: paymentTerms,
      payment_terms_percent: paymentTermsPercent,
    })
    .eq("id", customerId);

  if (error) {
    redirect(`${ficheUrl}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/customers");
  revalidatePath(ficheUrl);
  redirect(`${ficheUrl}?saved=${encodeURIComponent("Fiche client enregistree")}`);
}

export async function deleteCustomer(customerId: string) {
  const supabase = createClient();
  await supabase.from("customers").delete().eq("id", customerId);
  revalidatePath("/customers");
}
