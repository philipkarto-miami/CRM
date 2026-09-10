"use client";

import { useState } from "react";
import { FormRow, Input, Select } from "@/components/ui/Field";
import type { PaymentTerms } from "@/types/database";

// Champ "Conditions de paiement" d'un client pro : le pourcentage n'a de
// sens que pour l'option "Partiel", donc masque sinon.
export function PaymentTermsFields({
  defaultTerms = "total",
  defaultPercent,
}: {
  defaultTerms?: PaymentTerms;
  defaultPercent?: number | null;
}) {
  const [terms, setTerms] = useState<PaymentTerms>(defaultTerms);

  return (
    <>
      <FormRow label="Conditions de paiement">
        <Select name="payment_terms" value={terms} onChange={(e) => setTerms(e.target.value as PaymentTerms)}>
          <option value="total">Paiement total (100% requis avant expedition)</option>
          <option value="partiel">Paiement partiel (acompte)</option>
          <option value="consignement">Consignement (sans avance)</option>
        </Select>
      </FormRow>
      {terms === "partiel" && (
        <FormRow label="Pourcentage d'acompte attendu (%)">
          <Input
            type="number"
            name="payment_terms_percent"
            min={1}
            max={100}
            defaultValue={defaultPercent ?? ""}
            placeholder="30"
          />
        </FormRow>
      )}
    </>
  );
}
