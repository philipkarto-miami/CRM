"use client";

import { useMemo, useState } from "react";
import { FormRow, Input, Select, Label } from "@/components/ui/Field";

type PkModelOption = { sku: string; bagModelId: string | null; label: string };
type BagOption = { id: string; serial_number: string; model_id: string | null; sku: string | null };

// Un "modele PK" = un SKU precis du catalogue, qui ne correspond toujours
// qu'a un seul modele/taille fournisseur. On choisit d'abord le modele PK
// vendu (recherche libre : SKU, edition ou modele/marque du sac fournisseur,
// puisque tout est concatene dans le label), et on ne propose ensuite que
// les sacs en stock de ce modele fournisseur qui ne sont pas deja engages
// sur un autre SKU.
export function PkModelBagPicker({ pkModels, bags }: { pkModels: PkModelOption[]; bags: BagOption[] }) {
  const [sku, setSku] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => pkModels.find((m) => m.sku === sku) ?? null, [pkModels, sku]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pkModels;
    return pkModels.filter((m) => m.label.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q));
  }, [pkModels, query]);

  const matchingBags = useMemo(() => {
    if (!selected) return [];
    return bags.filter((b) => b.model_id === selected.bagModelId && (!b.sku || b.sku === selected.sku));
  }, [bags, selected]);

  function select(m: PkModelOption) {
    setSku(m.sku);
    setQuery(m.label);
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Label>Modele PK vendu</Label>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (sku) setSku("");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Rechercher par SKU, edition ou modele (ex: Speedy, PKPOP35)…"
        />
        <input type="hidden" name="desired_sku" value={sku} required />

        {open && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border border-line bg-bone shadow-lg">
            {matches.length === 0 && <p className="px-3 py-2 text-xs text-paper/45">Aucun modele PK trouve.</p>}
            {matches.map((m) => (
              <button
                key={m.sku}
                type="button"
                disabled={!m.bagModelId}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(m)}
                className="block w-full border-t border-line/60 px-3 py-2 text-left text-[13px] text-paper/80 first:border-t-0 hover:bg-gold/[0.06] disabled:cursor-not-allowed disabled:text-paper/30 disabled:hover:bg-transparent"
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <FormRow label="Sac en stock pour ce modele PK (si disponible)">
          <Select name="bag_id">
            <option value="">— Aucun disponible, mettre en « sac a commander »</option>
            {matchingBags.map((b) => (
              <option key={b.id} value={b.id}>
                {b.serial_number} {b.sku ? `— produit fini (SKU ${b.sku})` : "— pieces detachees (sans SKU)"}
              </option>
            ))}
          </Select>
          {matchingBags.length === 0 && (
            <p className="mt-1 text-xs text-paper/40">
              Aucun sac disponible pour ce modele PK actuellement — la commande sera placee en « Sac
              à commander » jusqu&apos;a l&apos;arrivee d&apos;un sac correspondant.
            </p>
          )}
        </FormRow>
      )}
    </div>
  );
}
