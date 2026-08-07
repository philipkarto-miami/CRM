import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateSkuCatalogEntry, deleteSkuCatalogEntry } from "../actions";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { PhotoDropzone } from "@/components/PhotoDropzone";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Card, CardTitle } from "@/components/ui/Card";
import { SkuStepsEditor } from "@/components/SkuStepsEditor";
import type { BagModel, SkuCatalog } from "@/types/database";

export default async function SkuCatalogDetailPage({ params }: { params: { sku: string } }) {
  const supabase = createClient();
  const [{ data: entry }, { data: stages }, { data: models }, { count: bagsInUse }] = await Promise.all([
    supabase.from("sku_catalog").select("*").eq("sku", params.sku).single(),
    supabase
      .from("production_stages")
      .select("name, catalog_column, phase, order_index")
      .not("catalog_column", "is", null)
      .eq("is_active", true)
      .order("phase")
      .order("order_index"),
    supabase.from("bag_models").select("*, brands(name)").order("sort_order"),
    supabase.from("bags").select("id", { count: "exact", head: true }).eq("sku", params.sku),
  ]);

  if (!entry) notFound();

  const typedEntry = entry as SkuCatalog;
  let photoUrl: string | null = null;
  if (typedEntry.photo_path) {
    const { data } = await supabase.storage.from("sku-photos").createSignedUrl(typedEntry.photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }
  let photoBackUrl: string | null = null;
  if (typedEntry.photo_path_back) {
    const { data } = await supabase.storage.from("sku-photos").createSignedUrl(typedEntry.photo_path_back, 3600);
    photoBackUrl = data?.signedUrl ?? null;
  }

  const updateWithSku = updateSkuCatalogEntry.bind(null, typedEntry.sku);
  const deleteWithSku = deleteSkuCatalogEntry.bind(null, typedEntry.sku);

  return (
    <form action={updateWithSku} className="pb-20">
      <p className="text-xs uppercase tracking-widest2 text-gold">
        <span className="text-paper/45">Catalogue /</span> {typedEntry.sku}
      </p>
      <div className="mt-0.5 flex items-baseline gap-3">
        <h2 className="font-serif text-2xl text-paper">{typedEntry.sku}</h2>
        {(bagsInUse ?? 0) > 0 && (
          <Link href={`/bags?q=${typedEntry.sku}`} className="text-xs text-gold underline">
            utilise par {bagsInUse} sac{(bagsInUse ?? 0) > 1 ? "s" : ""} en cours
          </Link>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="card rounded-sm p-5">
            <h3 className="mb-3.5 font-serif text-[17px] text-paper">Identite produit</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="SKU">
                <Input value={typedEntry.sku} disabled />
              </FormRow>
              <FormRow label="Edition">
                <Input name="edition" defaultValue={typedEntry.edition ?? ""} placeholder="PK.03" />
              </FormRow>
            </div>

            <div className="mt-3.5">
              <FormRow label="Modele fournisseur transforme">
                <Select name="bag_model_id" required defaultValue={typedEntry.bag_model_id ?? ""}>
                  <option value="">—</option>
                  {(models as (BagModel & { brands: { name: string } | null })[] | null)?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.brands?.name} {m.name} {m.base_size}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <p className="mt-1 text-[11px] text-paper/50">Un SKU = un seul modele / taille</p>
            </div>

            <div className="mt-3.5">
              <p className="mb-1.5 text-xs text-paper/55">Photos (au moins recto + verso)</p>
              <div className="flex gap-3">
                <PhotoDropzone name="photo" label="Recto" existingUrl={photoUrl} />
                <PhotoDropzone name="photo_back" label="Verso" existingUrl={photoBackUrl} />
              </div>
            </div>

            <div className="mt-3.5">
              <FormRow label="Description">
                <Textarea
                  name="description"
                  rows={3}
                  defaultValue={typedEntry.description ?? ""}
                  placeholder="Visible dans le catalogue…"
                  className="min-h-[64px]"
                />
              </FormRow>
            </div>
          </div>
        </div>

        <div>
          <div className="card rounded-sm p-5">
            <SkuStepsEditor
              availableSteps={(stages ?? []).map((s) => ({
                code: s.catalog_column as string,
                name: s.name,
                phase: s.phase,
              }))}
              initialSteps={typedEntry.steps ?? {}}
            />
          </div>
        </div>
      </div>

      <Card className="mt-8">
        <CardTitle>Supprimer ce code PK</CardTitle>
        <p className="mb-4 text-xs text-paper/60">
          Supprime definitivement ce code du catalogue. Sans effet sur les sacs deja fabriques avec ce SKU.
        </p>
        <ConfirmSubmitButton
          confirmMessage={`Supprimer le code PK "${typedEntry.sku}" du catalogue ? Cette action est definitive.`}
          formAction={deleteWithSku}
        >
          Supprimer le code PK
        </ConfirmSubmitButton>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-end gap-2.5 border-t border-line bg-bone px-4 py-3.5 md:left-64 md:px-8">
        <Link href="/catalogue" className="rounded-sm border border-line px-4 py-2 text-sm text-paper/70 hover:border-gold">
          Annuler
        </Link>
        <button type="submit" className="rounded-sm bg-gold px-4 py-2 text-sm text-ink">
          Enregistrer
        </button>
      </div>
    </form>
  );
}
