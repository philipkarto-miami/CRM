"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createSkuCatalogBatch } from "@/app/(app)/catalogue/actions";
import { FormRow, Input, Textarea } from "@/components/ui/Field";
import { SkuStepsEditor } from "@/components/SkuStepsEditor";
import { SKU_COLORS, generateSkuVariants, normalizeDesign } from "@/lib/sku";
import type { RecipeStepOption } from "@/lib/stages";
import { cn } from "@/lib/utils";

type ModelOption = { id: string; brand: string; name: string; baseSize: string | null };

const chipBase =
  "flex cursor-pointer select-none items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-colors";
const chipOn = "border-gold bg-gold/10 text-paper";
const chipOff = "border-line text-paper/60 hover:border-gold/50";

export function NewSkuBatchForm({
  models,
  existingSkus,
  recipeSteps,
  error,
}: {
  models: ModelOption[];
  existingSkus: string[];
  recipeSteps: RecipeStepOption[];
  error?: string;
}) {
  const [design, setDesign] = useState("");
  const [edition, setEdition] = useState("");
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const existing = useMemo(() => new Set(existingSkus), [existingSkus]);

  // Modeles regroupes par famille (Speedy, Keepall...) : une ligne par famille,
  // une case par taille.
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; brand: string; name: string; items: ModelOption[] }>();
    for (const m of models) {
      const key = `${m.brand}|${m.name}`;
      const group = map.get(key) ?? { key, brand: m.brand, name: m.name, items: [] };
      group.items.push(m);
      map.set(key, group);
    }
    return [...map.values()];
  }, [models]);

  const chosenModels = useMemo(
    () =>
      models
        .filter((m) => selectedModels.has(m.id))
        .map((m) => ({
          id: m.id,
          name: m.name,
          label: [m.brand, m.name, m.baseSize].filter(Boolean).join(" "),
          baseSize: m.baseSize,
        })),
    [models, selectedModels]
  );

  const variants = useMemo(
    () => generateSkuVariants(design, [...selectedColors], chosenModels),
    [design, selectedColors, chosenModels]
  );

  const duplicateCodes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of variants) counts.set(v.sku, (counts.get(v.sku) ?? 0) + 1);
    return new Set([...counts].filter(([, n]) => n > 1).map(([sku]) => sku));
  }, [variants]);

  const creatable = variants.filter((v) => !existing.has(v.sku));
  const alreadyThere = variants.length - creatable.length;
  const canSubmit = design !== "" && creatable.length > 0 && duplicateCodes.size === 0 && !submitting;

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function toggleGroup(items: ModelOption[]) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      const allOn = items.every((m) => next.has(m.id));
      for (const m of items) {
        if (allOn) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });
  }

  return (
    <form action={createSkuCatalogBatch} onSubmit={() => setSubmitting(true)} className="pb-20">
      <p className="text-xs uppercase tracking-widest2 text-gold">
        <span className="text-paper/45">Catalogue /</span> Nouveau design
      </p>
      <h2 className="mt-0.5 font-serif text-2xl text-paper">Nouveau design</h2>
      <p className="mt-1 text-sm text-paper/55">
        Choisis les modèles, l&apos;acronyme et les couleurs : tous les codes PK sont créés d&apos;un coup.
      </p>

      {error && <p className="mt-4 text-sm text-danger">Erreur : {error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* 1. Modeles */}
          <div className="card rounded-sm p-5">
            <h3 className="mb-1 font-serif text-[17px] text-paper">1 · Modèles de sac</h3>
            <p className="mb-3.5 text-xs text-paper/55">Coche tous les modèles auxquels ce design s&apos;applique.</p>

            <div className="space-y-3">
              {groups.map((group) => {
                const allOn = group.items.every((m) => selectedModels.has(m.id));
                return (
                  <div key={group.key} className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.items)}
                      className="w-28 shrink-0 text-left text-sm text-paper/80 hover:text-gold"
                      title={allOn ? "Tout décocher" : "Tout cocher"}
                    >
                      {group.name}
                      <span className="block text-[10px] uppercase tracking-wide text-paper/40">{group.brand}</span>
                    </button>
                    {group.items.map((m) => {
                      const on = selectedModels.has(m.id);
                      return (
                        <label key={m.id} className={cn(chipBase, on ? chipOn : chipOff)}>
                          <input
                            type="checkbox"
                            name="model_ids"
                            value={m.id}
                            checked={on}
                            onChange={() => setSelectedModels((prev) => toggle(prev, m.id))}
                            className="accent-gold"
                          />
                          {m.baseSize ?? "—"}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
              {groups.length === 0 && <p className="text-sm text-paper/45">Aucun modèle de sac disponible.</p>}
            </div>
          </div>

          {/* 2. Design + couleurs */}
          <div className="card rounded-sm p-5">
            <h3 className="mb-3.5 font-serif text-[17px] text-paper">2 · Design et couleurs</h3>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Acronyme du design">
                <Input
                  name="design"
                  value={design}
                  onChange={(e) => setDesign(normalizeDesign(e.target.value))}
                  placeholder="POP"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="font-mono uppercase"
                />
              </FormRow>
              <FormRow label="Édition (optionnel)">
                <Input
                  name="edition"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  placeholder="PK.03"
                />
              </FormRow>
            </div>
            <p className="mt-1 text-[11px] text-paper/50">Sans « PK » : il est ajouté automatiquement.</p>

            <div className="mt-4">
              <p className="mb-1.5 text-xs uppercase tracking-widest2 text-paper/50">Couleurs disponibles</p>
              <div className="flex flex-wrap gap-2">
                {SKU_COLORS.map((c) => {
                  const on = selectedColors.has(c.code);
                  return (
                    <label key={c.code} className={cn(chipBase, on ? chipOn : chipOff)}>
                      <input
                        type="checkbox"
                        name="colors"
                        value={c.code}
                        checked={on}
                        onChange={() => setSelectedColors((prev) => toggle(prev, c.code))}
                        className="accent-gold"
                      />
                      <span
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                        style={{ background: c.swatch }}
                      />
                      {c.label}
                      <span className="font-mono text-[11px] text-paper/45">{c.code}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-paper/50">
                Aucune couleur cochée = un seul code par modèle, sans lettre de couleur.
              </p>
            </div>

            <div className="mt-4">
              <FormRow label="Description (optionnel)">
                <Textarea
                  name="description"
                  rows={3}
                  placeholder="Visible dans le catalogue…"
                  className="min-h-[64px]"
                />
              </FormRow>
            </div>
          </div>

          {/* 3. Apercu */}
          <div className="card rounded-sm p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-serif text-[17px] text-paper">3 · Codes PK générés</h3>
              <span className="text-xs text-paper/60">
                {creatable.length} à créer
                {alreadyThere > 0 && ` · ${alreadyThere} existe${alreadyThere > 1 ? "nt" : ""} déjà`}
              </span>
            </div>

            {variants.length === 0 ? (
              <p className="text-sm text-paper/45">
                Saisis l&apos;acronyme et coche au moins un modèle pour voir les codes.
              </p>
            ) : (
              <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
                {variants.map((v) => {
                  const isDuplicate = duplicateCodes.has(v.sku);
                  const isExisting = existing.has(v.sku);
                  return (
                    <span
                      key={`${v.modelId}-${v.colorCode ?? "none"}`}
                      title={`${v.modelLabel}${v.colorLabel ? ` · ${v.colorLabel}` : ""}`}
                      className={cn(
                        "rounded-sm border px-2 py-1 font-mono text-xs",
                        isDuplicate
                          ? "border-danger text-danger"
                          : isExisting
                            ? "border-line text-paper/35 line-through"
                            : "border-gold/40 text-paper/80"
                      )}
                    >
                      {v.sku}
                    </span>
                  );
                })}
              </div>
            )}

            {duplicateCodes.size > 0 && (
              <p className="mt-3 text-xs text-danger">
                Deux modèles donnent le même code (ex : {[...duplicateCodes][0]}). Crée ce design séparément pour chacun.
              </p>
            )}
            {alreadyThere > 0 && duplicateCodes.size === 0 && (
              <p className="mt-3 text-xs text-paper/55">
                Les codes barrés existent déjà dans le catalogue : ils seront ignorés, jamais écrasés.
              </p>
            )}
            <p className="mt-3 text-[11px] text-paper/50">
              Format : PK + design + couleur + taille (25, 30, 35, 40… ou PM, MM, GM pour le Neverfull). Neverfull :
              « NF » et Birkin : « H » s&apos;ajoutent entre le design et la couleur (ex : PKPOPNFOMM, PKPOPHO30).
              Les photos se déposent ensuite sur chaque code, couleur par couleur.
            </p>
          </div>
        </div>

        <div>
          <div className="card rounded-sm p-5">
            <SkuStepsEditor availableSteps={recipeSteps} initialSteps={{}} />
          </div>
          <p className="mt-3 text-xs text-paper/55">
            Cette recette s&apos;applique à tous les codes créés. Elle reste modifiable code par code ensuite. Les
            autres phases sont fixes ; les bandes sont posées d&apos;office sur les Speedy 35+ et les Keepall.
          </p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between border-t border-line bg-bone px-4 py-3.5 md:left-64 md:px-8">
        <p className="text-xs text-paper/55">
          {canSubmit ? `${creatable.length} code${creatable.length > 1 ? "s" : ""} PK seront créés.` : "Acronyme et modèle requis."}
        </p>
        <div className="flex gap-2.5">
          <Link href="/catalogue" className="rounded-sm border border-line px-4 py-2 text-sm text-paper/70 hover:border-gold">
            Annuler
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-sm bg-gold px-4 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Création…" : `Créer ${creatable.length > 0 ? creatable.length : ""} code${creatable.length > 1 ? "s" : ""} PK`}
          </button>
        </div>
      </div>
    </form>
  );
}
