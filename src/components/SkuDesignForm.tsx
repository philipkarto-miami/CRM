"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { saveSkuDesign } from "@/app/(app)/catalogue/actions";
import { COLOR_NONE, SKU_COLORS, planDesignChanges, type DesignRow } from "@/lib/sku";
import { cn } from "@/lib/utils";

type ModelOption = { id: string; brand: string; name: string; baseSize: string | null };

const chipBase =
  "flex cursor-pointer select-none items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-colors";
const chipOn = "border-gold bg-gold/10 text-paper";
const chipOff = "border-line text-paper/60 hover:border-gold/50";

export function SkuDesignForm({
  design,
  edition,
  models,
  rows,
  allSkus,
  error,
}: {
  design: string;
  edition: string | null;
  models: ModelOption[];
  rows: DesignRow[];
  allSkus: string[];
  error?: string;
}) {
  const modelIds = useMemo(() => new Set(models.map((m) => m.id)), [models]);
  const managed = useMemo(() => rows.filter((r) => r.modelId && modelIds.has(r.modelId)), [rows, modelIds]);

  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    () => new Set(managed.map((r) => r.modelId as string))
  );
  const [selectedColors, setSelectedColors] = useState<Set<string>>(
    () => new Set(managed.map((r) => r.colorCode ?? COLOR_NONE))
  );
  const [submitting, setSubmitting] = useState(false);

  const allSkuSet = useMemo(() => new Set(allSkus), [allSkus]);

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

  const plan = useMemo(
    () =>
      planDesignChanges({
        design,
        rows,
        models: models.map((m) => ({
          id: m.id,
          name: m.name,
          label: [m.brand, m.name, m.baseSize].filter(Boolean).join(" "),
          baseSize: m.baseSize,
        })),
        selectedModelIds: [...selectedModels],
        selectedColorKeys: [...selectedColors],
        allSkus: allSkuSet,
      }),
    [design, rows, models, selectedModels, selectedColors, allSkuSet]
  );

  const hasChanges = plan.create.length > 0 || plan.remove.length > 0;
  const canSubmit = hasChanges && selectedModels.size > 0 && selectedColors.size > 0 && !submitting;

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (plan.remove.length > 0) {
      const ok = window.confirm(
        `${plan.remove.length} code${plan.remove.length > 1 ? "s" : ""} PK ${
          plan.remove.length > 1 ? "seront supprimes" : "sera supprime"
        } du catalogue (${plan.remove
          .slice(0, 5)
          .map((r) => r.sku)
          .join(", ")}${plan.remove.length > 5 ? "…" : ""}). Continuer ?`
      );
      if (!ok) {
        e.preventDefault();
        return;
      }
    }
    setSubmitting(true);
  }

  const submitLabel = submitting
    ? "Enregistrement…"
    : `Enregistrer${plan.create.length > 0 ? ` · +${plan.create.length}` : ""}${
        plan.remove.length > 0 ? ` · −${plan.remove.length}` : ""
      }`;

  return (
    <form action={saveSkuDesign} onSubmit={handleSubmit} className="pb-20">
      <input type="hidden" name="design" value={design} />

      <p className="text-xs uppercase tracking-widest2 text-gold">
        <span className="text-paper/45">Catalogue /</span> PK{design}
      </p>
      <h2 className="mt-0.5 font-serif text-2xl text-paper">PK{design}</h2>
      <p className="mt-1 text-sm text-paper/55">
        {rows.length} code{rows.length > 1 ? "s" : ""} PK{edition ? ` · ${edition}` : ""}. Coche les modèles et les
        couleurs applicables : les codes manquants sont créés, ceux que tu décoches sont supprimés.
      </p>

      {error && <p className="mt-4 text-sm text-danger">Erreur : {error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="card rounded-sm p-5">
            <h3 className="mb-1 font-serif text-[17px] text-paper">Modèles de sac</h3>
            <p className="mb-3.5 text-xs text-paper/55">Les modèles cochés existent pour ce design.</p>
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
            </div>
          </div>

          <div className="card rounded-sm p-5">
            <h3 className="mb-1 font-serif text-[17px] text-paper">Couleurs</h3>
            <p className="mb-3.5 text-xs text-paper/55">
              « Sans couleur » = codes sans lettre de couleur (les anciens codes). Cocher une couleur ajoute de
              nouveaux codes, sans toucher aux existants.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className={cn(chipBase, selectedColors.has(COLOR_NONE) ? chipOn : chipOff)}>
                <input
                  type="checkbox"
                  name="colors"
                  value={COLOR_NONE}
                  checked={selectedColors.has(COLOR_NONE)}
                  onChange={() => setSelectedColors((prev) => toggle(prev, COLOR_NONE))}
                  className="accent-gold"
                />
                Sans couleur
              </label>
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
          </div>
        </div>

        <div className="space-y-6">
          <div className="card rounded-sm p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-serif text-[17px] text-paper">Codes PK de ce design</h3>
              <span className="text-xs text-paper/60">
                {plan.keep.length} existant{plan.keep.length > 1 ? "s" : ""}
                {plan.create.length > 0 && ` · +${plan.create.length} à créer`}
                {plan.remove.length > 0 && ` · −${plan.remove.length} à supprimer`}
              </span>
            </div>

            <div className="flex max-h-80 flex-wrap gap-1.5 overflow-y-auto">
              {plan.keep.map((r) => (
                <Link
                  key={r.sku}
                  href={`/catalogue/${r.sku}`}
                  title="Ouvrir ce code (photos, recette)"
                  className="rounded-sm border border-line px-2 py-1 font-mono text-xs text-paper/80 hover:border-gold"
                >
                  {r.sku}
                </Link>
              ))}
              {plan.create.map((c) => (
                <span
                  key={c.sku}
                  title={`${c.modelLabel} — sera créé`}
                  className="rounded-sm border border-gold bg-gold/10 px-2 py-1 font-mono text-xs text-paper"
                >
                  + {c.sku}
                </span>
              ))}
              {plan.remove.map((r) => (
                <span
                  key={r.sku}
                  title="Sera supprimé"
                  className="rounded-sm border border-danger px-2 py-1 font-mono text-xs text-danger line-through"
                >
                  {r.sku}
                </span>
              ))}
              {rows.length === 0 && <p className="text-sm text-paper/45">Aucun code.</p>}
            </div>

            {plan.conflicts.length > 0 && (
              <p className="mt-3 text-xs text-paper/55">
                {plan.conflicts.length} code{plan.conflicts.length > 1 ? "s" : ""} existe
                {plan.conflicts.length > 1 ? "nt" : ""} déjà dans un autre design et sera ignoré (
                {plan.conflicts
                  .slice(0, 3)
                  .map((c) => c.sku)
                  .join(", ")}
                {plan.conflicts.length > 3 ? "…" : ""}).
              </p>
            )}
            <p className="mt-3 text-[11px] text-paper/50">
              Les nouveaux codes reprennent l&apos;édition, la description et la recette d&apos;un code existant ; les
              photos se déposent ensuite sur chaque code. Un code déjà utilisé par un sac n&apos;est jamais supprimé.
            </p>
          </div>

          {plan.orphans.length > 0 && (
            <div className="card rounded-sm p-5">
              <h3 className="mb-1 font-serif text-[17px] text-paper">Sans modèle rattaché</h3>
              <p className="mb-3 text-xs text-paper/55">
                Ces codes n&apos;ont pas de modèle de sac : ils ne sont pas gérés ici. Ouvre-les pour choisir leur
                modèle.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {plan.orphans.map((r) => (
                  <Link
                    key={r.sku}
                    href={`/catalogue/${r.sku}`}
                    className="rounded-sm border border-line px-2 py-1 font-mono text-xs text-paper/70 hover:border-gold"
                  >
                    {r.sku}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between border-t border-line bg-bone px-4 py-3.5 md:left-64 md:px-8">
        <p className="text-xs text-paper/55">
          {hasChanges ? "Modifications non enregistrées." : "Aucune modification."}
        </p>
        <div className="flex gap-2.5">
          <Link href="/catalogue" className="rounded-sm border border-line px-4 py-2 text-sm text-paper/70 hover:border-gold">
            Retour
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-sm bg-gold px-4 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
