"use client";

import { useRef, useState } from "react";
import { createCustomer } from "@/app/(app)/customers/actions";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PaymentTermsFields } from "@/components/PaymentTermsFields";
import { COUNTRIES } from "@/lib/countries";
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
    <form ref={formRef} action={createCustomer} className="card max-w-2xl space-y-5 rounded-sm p-6">
      <div className="flex items-center gap-3 text-xs uppercase tracking-widest2 text-paper/50">
        <span className={cn(step === 1 && "text-gold")}>1. Identite &amp; contact</span>
        <span className="text-paper/25">—</span>
        <span className={cn(step === 2 && "text-gold")}>2. Conditions commerciales</span>
      </div>

      <div className={cn("space-y-5", step !== 1 && "hidden")}>
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-widest2 text-paper/40">Entreprise</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormRow label="Nom de la societe">
              <Input name="full_name" required placeholder="Nom / raison sociale" />
            </FormRow>
            <FormRow label="Contact principal">
              <Input name="contact_name" placeholder="Personne a contacter chez ce client" />
            </FormRow>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-widest2 text-paper/40">Coordonnees</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormRow label="Email">
              <Input type="email" name="email" />
            </FormRow>
            <FormRow label="Telephone">
              <Input name="phone" />
            </FormRow>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-widest2 text-paper/40">Adresse</p>
          <FormRow label="Adresse (ligne 1)">
            <Input name="address_line1" placeholder="Numero et rue" />
          </FormRow>
          <FormRow label="Adresse (ligne 2, optionnelle)">
            <Input name="address_line2" placeholder="Complement d'adresse" />
          </FormRow>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormRow label="Ville">
              <Input name="city" />
            </FormRow>
            <FormRow label="Region / Etat / Province">
              <Input name="region" />
            </FormRow>
            <FormRow label="Code postal">
              <Input name="postal_code" />
            </FormRow>
          </div>
          <FormRow label="Pays">
            <Select name="country" defaultValue="Etats-Unis">
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
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
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStep(1)}
          className={cn(step !== 2 && "invisible")}
        >
          Precedent
        </Button>

        {/*
          Suivant (type="button") et Ajouter le client (type="submit") restent
          deux boutons distincts, toujours montes, juste bascules en CSS :
          les rendre via un ternaire au meme endroit de l'arbre faisait que
          React reutilisait le meme noeud DOM et changeait juste son attribut
          "type" a la volee, ce qui soumettait le formulaire immediatement
          (le navigateur relit le type au moment de l'action par defaut du
          clic, apres le re-render synchrone de React).
        */}
        <Button
          type="button"
          className={cn(step !== 1 && "hidden")}
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
        <Button type="submit" className={cn(step !== 2 && "hidden")}>
          Ajouter le client
        </Button>
      </div>
    </form>
  );
}
