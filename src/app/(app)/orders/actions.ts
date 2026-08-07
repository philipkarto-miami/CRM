"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assignSku } from "../bags/actions";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return v ? String(v) : null;
}

export async function createOrder(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bagId = str(formData, "bag_id") || null;
  const desiredSku = str(formData, "desired_sku") || null;

  // Une commande a soit un sac deja en stock, soit (si aucun sac disponible)
  // un modele PK (SKU) souhaite : elle part alors dans la colonne "sac a
  // commander" en attendant qu'un sac correspondant arrive. Le modele
  // fournisseur souhaite est derive du SKU (un SKU = un seul modele).
  if (!bagId && !desiredSku) {
    redirect(`/orders/new?error=${encodeURIComponent("Choisis un sac en stock ou un modele PK souhaite")}`);
  }

  let desiredModelId: string | null = null;
  if (!bagId && desiredSku) {
    const { data: skuEntry } = await supabase
      .from("sku_catalog")
      .select("bag_model_id")
      .eq("sku", desiredSku)
      .maybeSingle();
    desiredModelId = skuEntry?.bag_model_id ?? null;

    // F3 : sans modele fournisseur renseigne sur ce SKU, desired_model_id
    // resterait nul et la commande ne pourrait jamais etre proposee a un
    // sac en stock ni apparaitre correctement dans la vue "A sourcer".
    if (!desiredModelId) {
      redirect(
        `/orders/new?error=${encodeURIComponent(
          "Ce modele PK n'a pas de modele fournisseur renseigne — complete-le dans le catalogue avant de l'utiliser dans une commande."
        )}`
      );
    }
  }

  const payload = {
    order_name: str(formData, "order_name"),
    bag_id: bagId,
    desired_model_id: bagId ? null : desiredModelId,
    desired_sku: bagId ? null : desiredSku,
    customer_id: str(formData, "customer_id") || null,
    sale_type: str(formData, "sale_type") || "assemble",
    sale_price: str(formData, "sale_price") ? Number(str(formData, "sale_price")) : null,
    order_date: str(formData, "order_date"),
    status: bagId ? "recu" : "sac_a_commander",
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

// Rattache un sac disponible en stock a une commande qui attendait en "sac
// a commander" (suggere automatiquement, confirme manuellement par l'atelier).
export async function linkOrderToBag(orderId: string, bagId: string): Promise<{ error?: string }> {
  const supabase = createClient();

  // F4 : garde-fou anti double-lien. Un sac ne doit etre engage que sur une
  // seule commande active a la fois (les commandes annulees ne comptent
  // pas : leur sac redevient disponible).
  const { data: alreadyLinked } = await supabase
    .from("orders")
    .select("id")
    .eq("bag_id", bagId)
    .neq("status", "annule")
    .maybeSingle();
  if (alreadyLinked && alreadyLinked.id !== orderId) {
    return { error: "Ce sac vient d'etre rattache a une autre commande." };
  }

  const [{ data: order }, { data: bag }] = await Promise.all([
    supabase.from("orders").select("desired_sku, bag_id").eq("id", orderId).maybeSingle(),
    supabase.from("bags").select("sku").eq("id", bagId).maybeSingle(),
  ]);

  if (!order) return { error: "Commande introuvable." };
  if (order.bag_id) return { error: "Cette commande a deja un sac rattache." };

  // F1 : si la commande visait un SKU precis (modele PK), l'attribuer au
  // sac (memes etapes de fabrication que via la fiche sac) plutot que de se
  // contenter de le relier tel quel.
  if (order.desired_sku && bag?.sku !== order.desired_sku) {
    if (bag?.sku) {
      return {
        error: `Ce sac porte deja le SKU ${bag.sku}, different du SKU souhaite par la commande (${order.desired_sku}).`,
      };
    }
    const assignResult = await assignSku(bagId, order.desired_sku);
    if (assignResult.error) return assignResult;
  }

  // Mise a jour conditionnelle (bag_id encore nul) pour eviter qu'un
  // deuxieme clic concurrent ne rattache la meme commande deux fois.
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ bag_id: bagId, status: "recu" })
    .eq("id", orderId)
    .is("bag_id", null)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) return { error: "Cette commande a deja ete rattachee entre-temps." };

  revalidatePath("/orders");
  revalidatePath("/orders/sourcing");
  revalidatePath("/bags");
  revalidatePath(`/bags/${bagId}`);
  return {};
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
