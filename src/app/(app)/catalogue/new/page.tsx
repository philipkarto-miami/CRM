import { createSkuCatalogEntry } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { FormRow, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SKU_STEP_COLUMNS } from "@/lib/constants";

export default function NewSkuCatalogPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Catalogue" title="Nouveau code PK" />

      {searchParams?.error && <p className="mb-4 text-sm text-red-400">Erreur : {searchParams.error}</p>}

      <form action={createSkuCatalogEntry} className="card space-y-4 rounded-sm p-6">
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="SKU">
            <Input name="sku" required placeholder="PKPOP35" />
          </FormRow>
          <FormRow label="Edition">
            <Input name="edition" placeholder="PK.03" />
          </FormRow>
        </div>

        <FormRow label="Description">
          <Textarea name="description" rows={4} placeholder="Description du produit" />
        </FormRow>

        <p className="eyebrow pt-2">Etapes de fabrication pour ce SKU</p>
        <p className="text-xs text-paper/40">
          Laisse une case vide si l&apos;etape ne s&apos;applique pas. Sinon indique sa position (1, 2,
          3...) ou un texte pour une sous-traitance (ex "3 & 6").
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SKU_STEP_COLUMNS.map(({ code, label }) => (
            <FormRow key={code} label={label}>
              <Input name={`step_${code}`} placeholder="—" />
            </FormRow>
          ))}
        </div>

        <Button type="submit">Creer le code PK</Button>
      </form>
    </div>
  );
}
