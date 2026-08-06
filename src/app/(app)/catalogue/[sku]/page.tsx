import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateSkuCatalogEntry, deleteSkuCatalogEntry, uploadSkuPhoto } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { SkuStepsEditor } from "@/components/SkuStepsEditor";
import type { BagModel, SkuCatalog } from "@/types/database";

export default async function SkuCatalogDetailPage({ params }: { params: { sku: string } }) {
  const supabase = createClient();
  const [{ data: entry }, { data: stages }, { data: models }] = await Promise.all([
    supabase.from("sku_catalog").select("*").eq("sku", params.sku).single(),
    supabase
      .from("production_stages")
      .select("name, catalog_column, phase, order_index")
      .not("catalog_column", "is", null)
      .eq("is_active", true)
      .order("phase")
      .order("order_index"),
    supabase.from("bag_models").select("*, brands(name)").order("sort_order"),
  ]);

  if (!entry) notFound();

  const typedEntry = entry as SkuCatalog;
  let photoUrl: string | null = null;
  if (typedEntry.photo_path) {
    const { data } = await supabase.storage.from("sku-photos").createSignedUrl(typedEntry.photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  const updateWithSku = updateSkuCatalogEntry.bind(null, typedEntry.sku);
  const deleteWithSku = deleteSkuCatalogEntry.bind(null, typedEntry.sku);
  const uploadWithSku = uploadSkuPhoto.bind(null, typedEntry.sku);

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title={typedEntry.sku}
        action={
          <form action={deleteWithSku}>
            <Button variant="danger" type="submit">
              Supprimer
            </Button>
          </form>
        }
      />

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <Card>
            <CardTitle>Informations produit</CardTitle>
            <form action={updateWithSku} className="space-y-4">
              <FormRow label="Edition">
                <Input name="edition" defaultValue={typedEntry.edition ?? ""} placeholder="PK.03" />
              </FormRow>
              <FormRow label="Modele fournisseur transforme (un SKU = un seul modele/taille)">
                <Select name="bag_model_id" required defaultValue={typedEntry.bag_model_id ?? ""}>
                  <option value="">—</option>
                  {(models as (BagModel & { brands: { name: string } | null })[] | null)?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.brands?.name} {m.name} {m.base_size}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Description">
                <Textarea
                  name="description"
                  rows={4}
                  defaultValue={typedEntry.description ?? ""}
                  placeholder="Description du produit (visible dans le catalogue)"
                />
              </FormRow>

              <p className="eyebrow pt-2">Etapes de fabrication pour ce SKU</p>
              <SkuStepsEditor
                availableSteps={(stages ?? []).map((s) => ({ code: s.catalog_column as string, name: s.name }))}
                initialSteps={typedEntry.steps ?? {}}
              />

              <Button type="submit">Enregistrer</Button>
            </form>
          </Card>
        </div>

        <div>
          <Card>
            <CardTitle>Photo</CardTitle>
            <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-sm bg-white/5">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-paper/30">Pas de photo</span>
              )}
            </div>
            <form action={uploadWithSku} className="space-y-2">
              <input type="file" name="photo" accept="image/*" required className="input-base w-full px-2 py-1.5 text-xs" />
              <Button type="submit" variant="secondary" className="w-full">
                {photoUrl ? "Remplacer la photo" : "Ajouter une photo"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
