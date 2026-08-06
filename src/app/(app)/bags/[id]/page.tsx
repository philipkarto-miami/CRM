import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateBag, deleteBag } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { StageChecklist } from "@/components/StageChecklist";
import { PhotoCapture } from "@/components/PhotoCapture";
import { PhotoGallery } from "@/components/PhotoGallery";
import { AssignSkuForm } from "@/components/AssignSkuForm";
import { PHASE_LABELS } from "@/lib/constants";
import type { Bag, BagPhoto, BagStageProgress, ProductionStage, Supplier } from "@/types/database";

export default async function BagDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();

  const [{ data: bag }, { data: suppliers }, { data: progress }, { data: photoRows }, { data: skuOptions }] =
    await Promise.all([
      supabase.from("bags").select("*").eq("id", params.id).single(),
      supabase.from("suppliers").select("*").order("name"),
      supabase
        .from("bag_stage_progress")
        .select("*, production_stages(*)")
        .eq("bag_id", params.id),
      supabase
        .from("bag_photos")
        .select("*")
        .eq("bag_id", params.id)
        .order("created_at", { ascending: false }),
      supabase.from("sku_catalog").select("sku, edition").order("sku"),
    ]);

  if (!bag) notFound();

  const typedBag = bag as Bag;
  const updateBagWithId = updateBag.bind(null, typedBag.id);
  const deleteBagWithId = deleteBag.bind(null, typedBag.id);

  const photos = await Promise.all(
    ((photoRows as BagPhoto[] | null) ?? []).map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from("bag-photos")
        .createSignedUrl(photo.storage_path, 3600);
      return { id: photo.id, storage_path: photo.storage_path, url: signed?.signedUrl ?? null };
    })
  );

  return (
    <div>
      <PageHeader
        eyebrow={typedBag.serial_number}
        title={typedBag.model_label}
        action={
          <form action={deleteBagWithId}>
            <Button variant="danger" type="submit">
              Supprimer
            </Button>
          </form>
        }
      />

      {searchParams?.error && (
        <p className="mb-4 text-sm text-red-400">Erreur : {searchParams.error}</p>
      )}

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2">
          <Card>
            <CardTitle>Informations du sac</CardTitle>
            <form action={updateBagWithId} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="N° de série (auto-généré)">
                  <Input value={typedBag.serial_number} disabled />
                </FormRow>
                <FormRow label="SKU (voir carte « Attribution du SKU » ci-dessous)">
                  <Input value={typedBag.sku ?? "Non attribué"} disabled />
                </FormRow>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Libelle du modele">
                  <Input name="model_label" defaultValue={typedBag.model_label} required />
                </FormRow>
                <FormRow label="Taille">
                  <Input name="size" defaultValue={typedBag.size ?? ""} />
                </FormRow>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm text-paper/70">
                  <input
                    type="checkbox"
                    name="size_verified"
                    defaultChecked={typedBag.size_verified}
                    className="accent-gold"
                  />
                  Taille verifiee (OK)
                </label>
                <label className="flex items-center gap-2 text-sm text-paper/70">
                  <input
                    type="checkbox"
                    name="canvas_verified"
                    defaultChecked={typedBag.canvas_verified}
                    className="accent-gold"
                  />
                  Toile verifiee (OK)
                </label>
              </div>

              <FormRow label="Notes toile">
                <Input name="canvas_notes" defaultValue={typedBag.canvas_notes ?? ""} />
              </FormRow>

              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Fournisseur">
                  <Select name="supplier_id" defaultValue={typedBag.supplier_id ?? ""}>
                    <option value="">—</option>
                    {(suppliers as Supplier[] | null)?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                <FormRow label="N° authentification fournisseur">
                  <Input
                    name="auth_number_supplier"
                    defaultValue={typedBag.auth_number_supplier ?? ""}
                  />
                </FormRow>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormRow label="Prix d'achat (€)">
                  <Input
                    type="number"
                    step="0.01"
                    name="purchase_price"
                    defaultValue={typedBag.purchase_price ?? ""}
                  />
                </FormRow>
                <FormRow label="Date d'achat">
                  <Input type="date" name="purchase_date" defaultValue={typedBag.purchase_date ?? ""} />
                </FormRow>
                <FormRow label="Date fabrication LV/Hermes">
                  <Input type="date" name="factory_date" defaultValue={typedBag.factory_date ?? ""} />
                </FormRow>
              </div>

              <FormRow label="Lien photos">
                <Input name="photos_link" defaultValue={typedBag.photos_link ?? ""} />
              </FormRow>

              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Type de vente">
                  <Select name="sale_type" defaultValue={typedBag.sale_type}>
                    <option value="disassemble">Desassemble</option>
                    <option value="assemble">Assemble</option>
                  </Select>
                </FormRow>
                <FormRow label="Phase actuelle (automatique)">
                  <Input value={PHASE_LABELS[typedBag.current_phase]} disabled />
                </FormRow>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormRow label="N° de facture">
                  <Input name="invoice_number" defaultValue={typedBag.invoice_number ?? ""} />
                </FormRow>
                <FormRow label="Date de livraison prevue">
                  <Input type="date" name="delivery_date" defaultValue={typedBag.delivery_date ?? ""} />
                </FormRow>
              </div>

              <FormRow label="Notes">
                <Textarea name="notes" rows={3} defaultValue={typedBag.notes ?? ""} />
              </FormRow>

              <Button type="submit">Enregistrer</Button>
            </form>
          </Card>

          <Card className="mt-8">
            <CardTitle>Attribution du SKU</CardTitle>
            <p className="mb-4 text-xs text-paper/40">
              Le SKU définit la transformation à réaliser sur ce sac : il détermine
              automatiquement, depuis le catalogue, quelles étapes de fabrication
              s&apos;appliquent (et dans quel ordre) dans le suivi ci-contre.
            </p>
            <AssignSkuForm
              bagId={typedBag.id}
              currentSku={typedBag.sku}
              currentEdition={typedBag.sku_edition}
              skuOptions={(skuOptions as { sku: string; edition: string | null }[] | null) ?? []}
            />
          </Card>

          <Card className="mt-8">
            <CardTitle>Photos</CardTitle>
            <div className="mb-4">
              <PhotoGallery bagId={typedBag.id} photos={photos} />
            </div>
            <PhotoCapture bagId={typedBag.id} />
          </Card>
        </div>

        <div>
          <p className="eyebrow mb-3">Suivi de fabrication</p>
          <StageChecklist
            bagId={typedBag.id}
            progress={(progress as (BagStageProgress & { production_stages: ProductionStage })[]) || []}
          />
        </div>
      </div>
    </div>
  );
}
