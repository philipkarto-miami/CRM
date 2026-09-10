"use client";

import { useRef, useState } from "react";
import { createCustomer } from "@/app/(app)/customers/actions";
import { FormRow, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PaymentTermsFields } from "@/components/PaymentTermsFields";
import { cn } from "@/lib/utils";

// Assistant en 2 etapes pour la creation d'un client pro : etape 1 identite
// et coordonnees, etape 2 conditions commerciales. Les deux etapes restent
// dans le meme <form> (un seul submit, une seule action serveur) : on ne
// fait qu'afficher/masquer les groupes de champs, ce qui evite de perdre la
// saisie en changeant d'etape et garde createCustomer() inchangee cote
// validation globale.
export function NewCustomerWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={createCustomer} className="card max-w-xl space-y-5 rounded-sm p-6">
      <div className="flex items-center gap-3 text-xs uppercase tracking-widest2 text-paper/50">
        <span className={cn(step === 1 && "text-gold")}>1. Identite &amp; contact</span>
        <span className="text-paper/25">—</span>
        <span className={cn(step === 2 && "text-gold")}>2. Conditions commerciales</span>
      </div>

      <div className={cn("space-y-3", step !== 1 && "hidden")}>
        <FormRow label="Nom de la societe">
          <Input name="full_name" required placeholder="Nom / raison sociale" />
        </FormRow>
        <FormRow label="Contact principal">
          <Input name="contact_name" placeholder="Personne a contacter chez ce client" />
        </FormRow>
        <FormRow label="Email">
          <Input type="email" name="email" />
        </FormRow>
        <FormRow label="Telephone">
          <Input name="phone" />
        </FormRow>
        <FormRow label="Adresse">
          <Textarea name="address" rows={2} placeholder="Rue, ville, etat, code postal" />
        </FormRow>
      </div>

      <div className={cn("space-y-3", step !== 2 && "hidden")}>
        <PaymentTermsFields />
        <FormRow label="Tax ID / EIN (optionnel)">
          <Input name="tax_id" placeholder="Identifiant fiscal de l'entreprise" />
        </FormRow>
        <FormRow label="Notes">
          <Textarea name="notes" rows={2} />
        </FormRow>
      </div>

      <div className="flex items-center justify-between pt-2">
        {step === 2 ? (
          <Button type="button" variant="secondary" onClick={() => setStep(1)}>
            Precedent
          </Button>
        ) : (
          <span />
        )}

        {step === 1 ? (
          <Button
            type="button"
            onClick={() => {
              const fullName = formRef.current?.elements.namedItem("full_name") as HTMLInputElement | null;
              if (fullName && !fullName.value.trim()) {
                fullName.reportValidity();
                return;
              }
              setStep(2);
            }}
          >
            Suivant
          </Button>
        ) : (
          <Button type="submit">Ajouter le client</Button>
        )}
      </div>
    </form>
  );
}
