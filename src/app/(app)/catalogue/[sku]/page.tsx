import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateSkuCatalogEntry, deleteSkuCatalogEntry, uploadSkuPhoto } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { FormRow, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { SKU_STEP_COLUMNS } from "@/lib/constants";
import type { SkuCatalog } from "@/types/database";

export default async function SkuCatalogDetailPage({ params }: { params: { sku: string } }) {
  const supabase = createClient();
  const { data: entry } = await supabase.from("sku_catalog").select("*").eq("sku", params.sku).single();

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
              <FormRow label="Description">
                <Textarea
                  name="description"
                  rows={4}
                  defaultValue={typedEntry.description ?? ""}
                  placeholder="Description du produit (visible dans le catalogue)"
                />
              </FormRow>

              <p className="eyebrow pt-2">Etapes de fabrication pour ce SKU</p>
              <p className="text-xs text-paper/40">
                Laisse une case vide si l&apos;etape ne s&apos;applique pas a ce SKU. Sinon, indique sa
                position dans la sequence (1, 2, 3...) ou un texte pour une sous-traitance (ex "3 & 6").
              </p>
              <div className="grid grid-cols-2 gap-3">
                {SKU_STEP_COLUMNS.map(({ code, label }) => (
                  <FormRow key={code} label={label}>
                    <Input name={`step_${code}`} defaultValue={typedEntry.steps?.[code] ?? ""} placeholder="—" />
                  </FormRow>
                ))}
              </div>

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
