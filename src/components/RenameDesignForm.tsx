"use client";

import { useMemo, useState } from "react";
import { renameSkuDesign } from "@/app/(app)/catalogue/actions";
import { normalizeDesign } from "@/lib/sku";

// Renommer l'acronyme d'un design = renommer tous ses codes PK (PKSBLK30 ->
// PKXYZ30...). Les sacs et commandes qui utilisent ces codes sont mis a jour
// cote base. Formulaire independant de celui de la fiche (pas de formulaires
// imbriques) : place dans l'en-tete.
export function RenameDesignForm({
  design,
  codes,
  allSkus,
  bagsCount,
  ordersCount,
}: {
  design: string;
  codes: string[];
  allSkus: string[];
  bagsCount: number;
  ordersCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(design);
  const [submitting, setSubmitting] = useState(false);

  const taken = useMemo(() => new Set(allSkus), [allSkus]);

  const renamed = useMemo(
    () =>
      codes
        .filter((sku) => sku.startsWith(`PK${design}`))
        .map((sku) => ({ from: sku, to: `PK${value}${sku.slice(2 + design.length)}` })),
    [codes, design, value]
  );
  const clash = renamed.find((r) => r.from !== r.to && taken.has(r.to));
  const unchanged = value === design;
  const canSubmit = value !== "" && !unchanged && !clash && !submitting;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const ok = window.confirm(
      `Renommer PK${design} en PK${value} ?\n\n${renamed.length} code${renamed.length > 1 ? "s" : ""} PK ` +
        `(${renamed[0]?.from} devient ${renamed[0]?.to}${renamed.length > 1 ? "…" : ""}), ` +
        `${bagsCount} sac${bagsCount > 1 ? "s" : ""} et ${ordersCount} commande${ordersCount > 1 ? "s" : ""} mis à jour.`
    );
    if (!ok) {
      e.preventDefault();
      return;
    }
    setSubmitting(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-gold underline underline-offset-2"
      >
        Renommer l&apos;acronyme
      </button>
    );
  }

  return (
    <form
      action={renameSkuDesign}
      onSubmit={handleSubmit}
      className="mt-3 max-w-xl rounded-sm border border-line bg-white/60 p-4"
    >
      <input type="hidden" name="design" value={design} />

      <p className="mb-2 text-xs uppercase tracking-widest2 text-paper/50">Nouvel acronyme du design</p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-paper/60">PK</span>
        <input
          name="new_design"
          value={value}
          onChange={(e) => setValue(normalizeDesign(e.target.value))}
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
          className="input-base w-40 px-3 py-2 font-mono text-sm uppercase"
        />
      </div>

      <div className="mt-3 space-y-0.5 font-mono text-xs text-paper/60">
        {renamed.slice(0, 3).map((r) => (
          <p key={r.from} className={r.from !== r.to && taken.has(r.to) ? "text-danger" : undefined}>
            {r.from} → {r.to}
          </p>
        ))}
        {renamed.length > 3 && <p>… et {renamed.length - 3} autre{renamed.length - 3 > 1 ? "s" : ""}</p>}
      </div>

      {clash && (
        <p className="mt-2 text-xs text-danger">Le code {clash.to} existe déjà : choisis un autre acronyme.</p>
      )}
      <p className="mt-2 text-[11px] text-paper/50">
        {bagsCount} sac{bagsCount > 1 ? "s" : ""} et {ordersCount} commande{ordersCount > 1 ? "s" : ""} utilisent ces
        codes ; ils sont mis à jour automatiquement. Les photos sont conservées.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-sm bg-gold px-4 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Renommage…" : "Renommer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValue(design);
          }}
          className="rounded-sm border border-line px-4 py-2 text-sm text-paper/70 hover:border-gold"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
