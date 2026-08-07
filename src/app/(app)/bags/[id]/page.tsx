import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateBag, deleteBag } from "../actions";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { StageChecklist } from "@/components/StageChecklist";
import { CollapsiblePastPhase } from "@/components/CollapsiblePastPhase";
import { AddPhotoAction } from "@/components/AddPhotoAction";
import { PhotoGallery } from "@/components/PhotoGallery";
import { AssignSkuForm } from "@/components/AssignSkuForm";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Bag, BagPhoto, BagStageProgress, ProductionStage, SkuCatalog, StagePhase, Supplier } from "@/types/database";

type Progress = BagStageProgress & { production_stages: ProductionStage };

// Regroupement affiche dans la barre de progression en 6 segments (le detail
// des 8 phases reste visible dans la checklist elle-meme).
const PHASE_GROUPS: { label: string; phases: StagePhase[] }[] = [
  { label: "Reception", phases: ["reception"] },
  { label: "Fabrication", phases: ["disassembly", "stock_propre", "manufacturing"] },
  { label: "Controle", phases: ["quality_control"] },
  { label: "Emballage", phases: ["wrapping"] },
  { label: "Expedition", phases: ["shipping"] },
  { label: "Compta", phases: ["accounting"] },
];

function groupIndexForPhase(phase: StagePhase) {
  return PHASE_GROUPS.findIndex((g) => g.phases.includes(phase));
}

function daysBetween(fromISO: string, toISO: string) {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  return Math.round(ms / 86_400_000);
}

function formatDayMonth(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(value));
}

export default async function BagDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; view?: string; from?: string };
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

  // Photo(s) du modele PK (catalogue) attribue a ce sac : sert de reference
  // visuelle a l'atelier pour confirmer qu'il fabrique le bon modele.
  let skuPhotoFrontUrl: string | null = null;
  let skuPhotoBackUrl: string | null = null;
  let skuEdition: string | null = null;
  if (typedBag.sku) {
    const { data: skuEntry } = await supabase
      .from("sku_catalog")
      .select("photo_path, photo_path_back, edition")
      .eq("sku", typedBag.sku)
      .maybeSingle();
    const typedSkuEntry = skuEntry as Pick<SkuCatalog, "photo_path" | "photo_path_back" | "edition"> | null;
    if (typedSkuEntry) {
      skuEdition = typedSkuEntry.edition;
      if (typedSkuEntry.photo_path) {
        const { data } = await supabase.storage.from("sku-photos").createSignedUrl(typedSkuEntry.photo_path, 3600);
        skuPhotoFrontUrl = data?.signedUrl ?? null;
      }
      if (typedSkuEntry.photo_path_back) {
        const { data } = await supabase.storage.from("sku-photos").createSignedUrl(typedSkuEntry.photo_path_back, 3600);
        skuPhotoBackUrl = data?.signedUrl ?? null;
      }
    }
  }
  const typedProgress = ((progress as Progress[] | null) ?? []).filter((p) => p.production_stages);
  const updateBagWithId = updateBag.bind(null, typedBag.id);
  const deleteBagWithId = deleteBag.bind(null, typedBag.id);
  const isInfosView = searchParams?.view === "infos";
  const backHref = searchParams?.from === "production" ? "/production" : "/bags";
  const backLabel = searchParams?.from === "production" ? "← Fabrication" : "← Stock";

  const photos = await Promise.all(
    ((photoRows as BagPhoto[] | null) ?? []).map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from("bag-photos")
        .createSignedUrl(photo.storage_path, 3600);
      return { id: photo.id, storage_path: photo.storage_path, url: signed?.signedUrl ?? null };
    })
  );

  // Compte a rebours livraison, affiche dans l'en-tete sombre.
  let deliveryText: React.ReactNode = null;
  if (typedBag.delivery_date) {
    const today = new Date().toISOString().slice(0, 10);
    const diff = daysBetween(today, typedBag.delivery_date);
    if (diff < 0) {
      deliveryText = (
        <span className="text-danger">
          {formatDayMonth(typedBag.delivery_date)} · en retard de {Math.abs(diff)} jour{Math.abs(diff) > 1 ? "s" : ""}
        </span>
      );
    } else {
      deliveryText = (
        <>
          {formatDayMonth(typedBag.delivery_date)} <span className="text-goldBright">· dans {diff} jour{diff > 1 ? "s" : ""}</span>
        </>
      );
    }
  }

  const currentGroupIndex = groupIndexForPhase(typedBag.current_phase);
  const currentPhaseIndex = PHASE_ORDER.indexOf(typedBag.current_phase);

  const currentPhaseProgress = typedProgress.filter((p) => p.production_stages.phase === typedBag.current_phase);
  const doneInCurrent = currentPhaseProgress.filter((p) => p.status === "termine").length;

  const pastPhases = PHASE_ORDER.slice(0, currentPhaseIndex).filter(
    (phase) => typedProgress.some((p) => p.production_stages.phase === phase)
  );
  const futurePhases = PHASE_ORDER.slice(currentPhaseIndex + 1).filter(
    (phase) => typedProgress.some((p) => p.production_stages.phase === phase)
  );

  const header = (
    <div className="-mx-4 -mt-6 mb-4 bg-brandDark px-4 py-5 md:mx-0 md:mt-0 md:rounded-sm md:px-8 md:py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href={backHref} className="text-[13px] text-white/55">
            {backLabel}
          </Link>
          <div className="mt-2.5 flex items-baseline gap-3.5">
            <p className="font-serif text-xl text-white md:text-2xl">{typedBag.model_label}</p>
            <p className="text-[11px] uppercase tracking-widest2 text-gold">{typedBag.serial_number}</p>
          </div>
        </div>
        {deliveryText && (
          <div className="md:text-right">
            <p className="text-[10px] uppercase tracking-widest2 text-white/40">Livraison prevue</p>
            <p className="mt-0.5 text-sm text-white">{deliveryText}</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gold px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-goldBright">
          {PHASE_LABELS[typedBag.current_phase]}
        </span>
        <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
          {typedBag.sku ?? "SKU non attribue"}
        </span>
        <span className="ml-auto text-xs text-white/45">
          {isInfosView ? (
            <Link href={`/bags/${typedBag.id}`} className="text-white/70 underline">
              ← Vue atelier
            </Link>
          ) : (
            <>
              Vue atelier ·{" "}
              <Link href={`/bags/${typedBag.id}?view=infos`} className="text-white/70 underline">
                Informations completes
              </Link>
            </>
          )}
        </span>
      </div>

      {!isInfosView && (
        <div className="mt-4">
          <div className="flex h-1 gap-[3px]">
            {PHASE_GROUPS.map((g, i) => (
              <div
                key={g.label}
                className={cn("flex-1 rounded-full", i <= currentGroupIndex ? "bg-gold" : "bg-white/15")}
              />
            ))}
          </div>
          <div className="mt-1.5 flex text-[9px] uppercase tracking-wide">
            {PHASE_GROUPS.map((g, i) => (
              <span key={g.label} className={cn("flex-1 text-center", i === currentGroupIndex ? "text-goldBright" : "text-white/35")}>
                {g.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (isInfosView) {
    return (
      <div>
        {header}

        {searchParams?.error && <p className="mb-4 text-sm text-danger">Erreur : {searchParams.error}</p>}

        <Card>
          <CardTitle>Informations du sac</CardTitle>
          <form action={updateBagWithId} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormRow label="N° de série (auto-généré)">
                <Input value={typedBag.serial_number} disabled />
              </FormRow>
              <FormRow label="SKU (voir carte « Attribution du SKU » ci-dessous)">
                <Input value={typedBag.sku ?? "Non attribué"} disabled />
              </FormRow>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormRow label="Libelle du modele">
                <Input name="model_label" defaultValue={typedBag.model_label} required />
              </FormRow>
              <FormRow label="Taille">
                <Input name="size" defaultValue={typedBag.size ?? ""} />
              </FormRow>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-paper/70">
                <input type="checkbox" name="size_verified" defaultChecked={typedBag.size_verified} className="accent-gold" />
                Taille verifiee (OK)
              </label>
              <label className="flex items-center gap-2 text-sm text-paper/70">
                <input type="checkbox" name="canvas_verified" defaultChecked={typedBag.canvas_verified} className="accent-gold" />
                Toile verifiee (OK)
              </label>
            </div>

            <FormRow label="Notes toile">
              <Input name="canvas_notes" defaultValue={typedBag.canvas_notes ?? ""} />
            </FormRow>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Input name="auth_number_supplier" defaultValue={typedBag.auth_number_supplier ?? ""} />
              </FormRow>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormRow label="Prix d'achat (€)">
                <Input type="number" step="0.01" name="purchase_price" defaultValue={typedBag.purchase_price ?? ""} />
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <p className="mb-4 text-xs text-paper/60">
            Le SKU définit la transformation à réaliser sur ce sac : il détermine
            automatiquement, depuis le catalogue, quelles étapes de fabrication
            s&apos;appliquent (et dans quel ordre) dans le suivi de fabrication.
          </p>
          <AssignSkuForm
            bagId={typedBag.id}
            currentSku={typedBag.sku}
            currentEdition={typedBag.sku_edition}
            skuOptions={(skuOptions as { sku: string; edition: string | null }[] | null) ?? []}
          />
        </Card>

        <Card className="mt-8">
          <CardTitle>Supprimer ce sac</CardTitle>
          <p className="mb-4 text-xs text-paper/60">
            Supprime définitivement la fiche, son historique de fabrication et ses photos.
          </p>
          <form action={deleteBagWithId}>
            <ConfirmSubmitButton
              confirmMessage={`Supprimer le sac ${typedBag.serial_number} ? Son historique de fabrication et ses photos seront perdus definitivement.`}
            >
              Supprimer le sac
            </ConfirmSubmitButton>
          </form>
        </Card>
      </div>
    );
  }

  // Vue atelier (par defaut) : le travail du moment, rien de plus.
  return (
    <div>
      {header}

      {searchParams?.error && <p className="mb-4 text-sm text-danger">Erreur : {searchParams.error}</p>}

      <div className="md:grid md:grid-cols-[1.6fr_1fr] md:gap-6">
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="eyebrow">En cours — {PHASE_LABELS[typedBag.current_phase]}</p>
            <p className="text-xs text-paper/60">
              {doneInCurrent}/{currentPhaseProgress.length} terminee{currentPhaseProgress.length > 1 ? "s" : ""}
            </p>
          </div>
          {currentPhaseProgress.length > 0 ? (
            <StageChecklist bagId={typedBag.id} progress={currentPhaseProgress} />
          ) : (
            <p className="card rounded-sm px-4 py-6 text-center text-sm text-paper/50">
              Aucune etape pour cette phase.
            </p>
          )}

          {pastPhases.length > 0 && (
            <div className="mt-6 space-y-2">
              {pastPhases.map((phase) => (
                <CollapsiblePastPhase
                  key={phase}
                  bagId={typedBag.id}
                  phase={phase}
                  progress={typedProgress.filter((p) => p.production_stages.phase === phase)}
                />
              ))}
            </div>
          )}

          {futurePhases.length > 0 && (
            <div className="mt-6">
              <p className="mb-2.5 text-xs uppercase tracking-widest2 text-paper/40">Ensuite</p>
              <div className="card divide-y divide-line/60 rounded-sm">
                {futurePhases.map((phase) => {
                  const count = typedProgress.filter((p) => p.production_stages.phase === phase).length;
                  return (
                    <div key={phase} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-paper/60">
                        {PHASE_LABELS[phase]} — {count} etape{count > 1 ? "s" : ""}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-paper/35">verrouillee</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 md:mt-0">
          <p className="eyebrow mb-2.5">Modele a realiser</p>
          {typedBag.sku && (skuPhotoFrontUrl || skuPhotoBackUrl) ? (
            <div className="card rounded-sm p-3">
              <div className="flex gap-2.5">
                <div className="aspect-square w-1/2 overflow-hidden rounded-sm bg-black/[0.03]">
                  {skuPhotoFrontUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={skuPhotoFrontUrl} alt="Recto du modele" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-paper/30">Pas de recto</div>
                  )}
                </div>
                <div className="aspect-square w-1/2 overflow-hidden rounded-sm bg-black/[0.03]">
                  {skuPhotoBackUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={skuPhotoBackUrl} alt="Verso du modele" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-paper/30">Pas de verso</div>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-paper/60">
                <span className="text-gold">{typedBag.sku}</span>
                {skuEdition && ` — ${skuEdition}`}
              </p>
              <Link href={`/catalogue/${typedBag.sku}`} className="text-xs text-paper/40 underline">
                Voir la fiche catalogue →
              </Link>
            </div>
          ) : typedBag.sku ? (
            <div className="card rounded-sm px-4 py-5 text-center text-xs text-paper/45">
              Aucune photo pour le SKU {typedBag.sku} —{" "}
              <Link href={`/catalogue/${typedBag.sku}`} className="text-gold underline">
                ajoute-la au catalogue
              </Link>
              .
            </div>
          ) : (
            <div className="card rounded-sm px-4 py-5 text-center text-xs text-paper/45">
              SKU non attribue — pas encore de photo de reference.{" "}
              <Link href={`/bags/${typedBag.id}?view=infos`} className="text-gold underline">
                Attribuer un SKU
              </Link>
            </div>
          )}

          <p className="eyebrow mb-2.5 mt-6">Photos</p>
          <PhotoGallery bagId={typedBag.id} photos={photos} />
          <div className="mt-2.5">
            <AddPhotoAction bagId={typedBag.id} />
          </div>

          <p className="eyebrow mb-2.5 mt-6">L&apos;essentiel</p>
          <div className="card divide-y divide-line/60 rounded-sm text-[13px]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-paper/55">SKU</span>
              <span className="text-paper/85">{typedBag.sku ?? "Non attribué"}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-paper/55">Taille</span>
              <span className="text-paper/85">{typedBag.size ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-paper/55">Fournisseur</span>
              <span className="text-paper/85">
                {(suppliers as Supplier[] | null)?.find((s) => s.id === typedBag.supplier_id)?.name ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-paper/55">Notes toile</span>
              <span className="text-paper/45">{typedBag.canvas_notes ?? "—"}</span>
            </div>
          </div>
          <p className="mt-2.5 text-xs">
            <Link href={`/bags/${typedBag.id}?view=infos`} className="text-gold underline">
              Informations completes →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
