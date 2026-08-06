"use client";

import { useMemo, useState } from "react";
import { FormRow, Select } from "@/components/ui/Field";

type ModelOption = { id: string; label: string };
type BagOption = { id: string; serial_number: string; model_id: string | null; sku: string | null };

// Le SKU determine le modele de sac : on choisit d'abord le modele vendu,
// et on ne propose ensuite que les sacs en stock de ce modele (qu'ils aient
// deja un SKU/produit fini, ou qu'ils soient encore en pieces detachees).
// Si aucun ne convient, la commande partira en "sac a commander" pour ce
// modele (gere par le formulaire parent / createOrder).
export function ModelBagPicker({ models, bags }: { models: ModelOption[]; bags: BagOption[] }) {
  const [modelId, setModelId] = useState("");

  const matchingBags = useMemo(() => bags.filter((b) => b.model_id === modelId), [bags, modelId]);

  return (
    <div className="space-y-4">
      <FormRow label="Modele vendu">
        <Select name="desired_model_id" required value={modelId} onChange={(e) => setModelId(e.target.value)}>
          <option value="">—</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormRow>

      {modelId && (
        <FormRow label="Sac en stock pour ce modele (si disponible)">
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
              Aucun sac de ce modele en stock actuellement — la commande sera placee en « Sac à
              commander » jusqu&apos;a l&apos;arrivee d&apos;un sac correspondant.
            </p>
          )}
        </FormRow>
      )}
    </div>
  );
}
