import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createSkuCatalogEntry } from "../actions";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { PhotoDropzone } from "@/components/PhotoDropzone";
import { SkuStepsEditor } from "@/components/SkuStepsEditor";
import type { BagModel } from "@/types/database";

export default async function NewSkuCatalogPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const [{ data: stages }, { data: models }] = await Promise.all([
    supabase
      .from("production_stages")
      .select("name, catalog_column, phase, order_index")
      .not("catalog_column", "is", null)
      .eq("is_active", true)
      .order("phase")
      .order("order_index"),
    supabase.from("bag_models").select("*, brands(name)").order("sort_order"),
  ]);

  return (
    <form action={createSkuCatalogEntry} className="pb-20">
      <p className="text-xs uppercase tracking-widest2 text-gold">
        <span className="text-paper/45">Catalogue /</span> Nouveau code PK
      </p>
      <h2 className="mt-0.5 font-serif text-2xl text-paper">
        Nouveau code PK <span className="text-base text-paper/45">· brouillon</span>
      </h2>

      {searchParams?.error && <p className="mt-4 text-sm text-danger">Erreur : {searchParams.error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="card rounded-sm p-5">
            <h3 className="mb-3.5 font-serif text-[17px] text-paper">Identite produit</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="SKU">
                <Input name="sku" required placeholder="PKPOP35" />
              </FormRow>
              <FormRow label="Edition">
                <Input name="edition" placeholder="PK.03" />
              </FormRow>
            </div>

            <div className="mt-3.5">
              <FormRow label="Modele fournisseur transforme">
                <Select name="bag_model_id" required>
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
                <PhotoDropzone name="photo" label="Recto" />
                <PhotoDropzone name="photo_back" label="Verso" />
              </div>
            </div>

            <div className="mt-3.5">
              <FormRow label="Description">
                <Textarea name="description" rows={3} placeholder="Visible dans le catalogue…" className="min-h-[64px]" />
              </FormRow>
            </div>
          </div>
          <p className="mt-3 text-xs text-paper/55">
            La photo entre des la creation — c&apos;est elle qui rend le catalogue utilisable.
          </p>
        </div>

        <div>
          <div className="card rounded-sm p-5">
            <SkuStepsEditor
              availableSteps={(stages ?? []).map((s) => ({
                code: s.catalog_column as string,
                name: s.name,
                phase: s.phase,
              }))}
              initialSteps={{}}
            />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between border-t border-line bg-bone px-4 py-3.5 md:left-64 md:px-8">
        <p className="text-xs text-paper/55">SKU et modele fournisseur requis.</p>
        <div className="flex gap-2.5">
          <Link href="/catalogue" className="rounded-sm border border-line px-4 py-2 text-sm text-paper/70 hover:border-gold">
            Annuler
          </Link>
          <button type="submit" className="rounded-sm bg-gold px-4 py-2 text-sm text-ink">
            Creer le code PK
          </button>
        </div>
      </div>
    </form>
  );
}
