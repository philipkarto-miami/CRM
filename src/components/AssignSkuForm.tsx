"use client";

import { useState, useTransition } from "react";
import { assignSku } from "@/app/(app)/bags/actions";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function AssignSkuForm({
  bagId,
  currentSku,
  currentEdition,
  currentWarning,
  bagLabel,
  skuOptions,
}: {
  bagId: string;
  currentSku: string | null;
  currentEdition: string | null;
  // Renseigne quand le code deja pose ne correspond pas au modele/taille du sac.
  currentWarning: string | null;
  bagLabel: string;
  // Codes compatibles avec ce sac uniquement.
  skuOptions: { sku: string; edition: string | null }[];
}) {
  const [value, setValue] = useState(currentSku ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(currentWarning);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sku = value.trim();
    if (!sku || isPending) return;

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await assignSku(bagId, sku);
      if (result.error) {
        setError(result.error);
        return;
      }
      // La saisie peut etre un design (PKS) : on affiche le code reellement pose.
      if (result.sku) setValue(result.sku);
      setWarning(null);
      setSuccess(result.sku ?? sku);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            list="sku-catalog-options"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSuccess(null);
            }}
            placeholder="PKPOP35 ou un design (PKS)"
          />
          <datalist id="sku-catalog-options">
            {skuOptions.map((o) => (
              <option key={o.sku} value={o.sku} label={o.edition ?? undefined} />
            ))}
          </datalist>
        </div>
        <Button type="submit" disabled={isPending || !value.trim()}>
          {isPending ? "Attribution…" : "Attribuer"}
        </Button>
      </div>

      <p className="text-xs text-paper/45">
        Seuls les codes de {bagLabel} sont proposés. Tu peux aussi saisir un design (ex : PKS) : le code à la bonne
        taille est choisi automatiquement.
      </p>

      {currentSku && (
        <p className="text-xs text-paper/40">
          SKU actuel : <span className="text-paper/70">{currentSku}</span>
          {currentEdition && ` (${currentEdition})`}
        </p>
      )}
      {warning && <p className="text-sm text-amber-500">⚠ {warning}</p>}
      {error && <p className="text-sm text-red-400">Erreur : {error}</p>}
      {success && (
        <p className="text-sm text-emerald-400">
          SKU {success} attribué — la liste des étapes de fabrication a été mise à jour.
        </p>
      )}
    </form>
  );
}
