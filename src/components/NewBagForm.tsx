"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBag, uploadBagPhoto } from "@/app/(app)/bags/actions";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PhotoPickerInline } from "@/components/PhotoPickerInline";
import type { BagModel, Supplier } from "@/types/database";

type ModelWithBrand = BagModel & { brands: { name: string } | null };

// Le numero exact (increment sur 3 chiffres) n'est connu qu'a l'enregistrement
// (attribue cote base de donnees pour eviter tout doublon entre plusieurs
// utilisateurs qui creeraient un sac au meme moment) ; on affiche donc un
// apercu du prefixe AAMM en attendant, dans un champ grise non modifiable.
function serialPreviewPrefix() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

export function NewBagForm({
  models,
  suppliers,
}: {
  models: ModelWithBrand[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [modelId, setModelId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [authNumber, setAuthNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [factoryDate, setFactoryDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [sizeOk, setSizeOk] = useState(false);
  const [canvasOk, setCanvasOk] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const canSubmit =
    modelId !== "" &&
    supplierId !== "" &&
    authNumber.trim() !== "" &&
    deliveryDate !== "" &&
    factoryDate !== "" &&
    invoiceNumber.trim() !== "" &&
    sizeOk &&
    canvasOk;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || isPending) return;

    const fd = new FormData(e.currentTarget);
    setFormError(null);

    startTransition(async () => {
      const result = await createBag(fd);

      if (result.error || !result.id) {
        setFormError(result.error ?? "Une erreur est survenue.");
        return;
      }

      if (photoFile) {
        const photoFd = new FormData();
        photoFd.set("photo", photoFile);
        await uploadBagPhoto(result.id, photoFd);
      }

      router.push(`/bags/${result.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-6 rounded-sm p-6">
      <p className="text-xs text-paper/40">
        Tous les champs ci-dessous sont obligatoires (sauf la photo). Le n° de série PK
        est généré automatiquement. Le SKU et les autres informations (prix
        d&apos;achat, notes...) pourront être complétés plus tard depuis la fiche du sac.
      </p>

      {formError && <p className="text-sm text-red-400">Erreur : {formError}</p>}

      <FormRow label="N° de série (auto-généré à la création)">
        <Input value={`PK${serialPreviewPrefix()}···`} disabled />
      </FormRow>

      <FormRow label="Modèle">
        <Select name="model_id" required value={modelId} onChange={(e) => setModelId(e.target.value)}>
          <option value="">—</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.brands?.name} {m.name} {m.base_size}
            </option>
          ))}
        </Select>
      </FormRow>

      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Fournisseur">
          <Select
            name="supplier_id"
            required
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="N° authentification fournisseur">
          <Input
            name="auth_number_supplier"
            required
            value={authNumber}
            onChange={(e) => setAuthNumber(e.target.value)}
            placeholder="ARI3956"
          />
        </FormRow>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Date de livraison">
          <Input
            type="date"
            name="delivery_date"
            required
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </FormRow>
        <FormRow label="Date de fabrication (LV / Hermès)">
          <Input
            type="date"
            name="factory_date"
            required
            value={factoryDate}
            onChange={(e) => setFactoryDate(e.target.value)}
          />
        </FormRow>
      </div>

      <FormRow label="N° de facture">
        <Input
          name="invoice_number"
          required
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />
      </FormRow>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm text-paper/70">
          <input
            type="checkbox"
            name="size_verified"
            required
            checked={sizeOk}
            onChange={(e) => setSizeOk(e.target.checked)}
            className="accent-gold"
          />
          Taille conforme (OK)
        </label>
        <label className="flex items-center gap-2 text-sm text-paper/70">
          <input
            type="checkbox"
            name="canvas_verified"
            required
            checked={canvasOk}
            onChange={(e) => setCanvasOk(e.target.checked)}
            className="accent-gold"
          />
          Toile conforme (OK)
        </label>
      </div>

      <FormRow label="Photo (optionnel)">
        <PhotoPickerInline onChange={setPhotoFile} />
      </FormRow>

      <Button type="submit" disabled={!canSubmit || isPending}>
        {isPending ? "Création…" : "Créer le sac"}
      </Button>
    </form>
  );
}
