"use client";

import { useState } from "react";
import { FormRow, Input, Select } from "@/components/ui/Field";
import type { Customer, CustomerType } from "@/types/database";

// Selectionne d'abord le type de client (particulier / professionnel) car
// cela determine completement le champ suivant : un particulier n'a pas de
// fiche dans le carnet clients pro, seul son nom/reference est saisi ici.
export function CustomerTypePicker({
  customers,
}: {
  customers: Pick<Customer, "id" | "full_name">[];
}) {
  const [type, setType] = useState<CustomerType>("professionnel");

  return (
    <>
      <FormRow label="Type de client">
        <Select name="customer_type" value={type} onChange={(e) => setType(e.target.value as CustomerType)}>
          <option value="professionnel">Professionnel</option>
          <option value="particulier">Particulier</option>
        </Select>
      </FormRow>

      {type === "professionnel" ? (
        <FormRow label="Client pro">
          <Select name="customer_id" required>
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </Select>
        </FormRow>
      ) : (
        <FormRow label="Nom / reference du client">
          <Input name="individual_customer_name" required placeholder="Nom du client particulier" />
        </FormRow>
      )}
    </>
  );
}
