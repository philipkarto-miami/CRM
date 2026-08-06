"use client";

import { useMemo, useState } from "react";
import { FormRow, Select } from "@/components/ui/Field";

type PkModelOption = { sku: string; bagModelId: string | null; label: string };
type BagOption = { id: string; serial_number: string; model_id: string | null; sku: string | null };

// Un "modele PK" = un SKU precis du catalogue, qui ne correspond toujours
// qu'a un seul modele/taille fournisseur. On choisit d'abord le modele PK
// vendu, et on ne propose ensuite que les sacs en stock de ce modele
// fournisseur qui ne sont pas deja engages sur un autre SKU.
export function PkModelBagPicker({ pkModels, bags }: { pkModels: PkModelOption[]; bags: BagOption[] }) {
  const [sku, setSku] = useState("");

  const selected = useMemo(() => pkModels.find((m) => m.sku === sku) ?? null, [pkModels, sku]);

  const matchingBags = useMemo(() => {
    if (!selected) return [];
    return bags.filter((b) => b.model_id === selected.bagModelId && (!b.sku || b.sku === selected.sku));
  }, [bags, selected]);

  return (
    <div className="space-y-4">
      <FormRow label="Modele PK vendu">
        <Select name="desired_sku" required value={sku} onChange={(e) => setSku(e.target.value)}>
          <option value="">—</option>
          {pkModels.map((m) => (
            <option key={m.sku} value={m.sku}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormRow>

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
