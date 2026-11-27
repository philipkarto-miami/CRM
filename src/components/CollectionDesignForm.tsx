import { deleteCollectionDesign, saveCollectionDesign } from "@/app/(app)/settings/actions";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { FAMILIES, availabilityValue, isAvailable, type CollectionDesign } from "@/lib/collection";
import { COMMERCIAL_EDITIONS, EXECUTIONS } from "@/lib/execution";

// Formulaire d'un design de la matrice (ajout si `design` est absent). Aucun
// etat cote client : de simples cases a cocher dans un formulaire.
export function CollectionDesignForm({ design }: { design?: CollectionDesign }) {
  return (
    <div className="card rounded-sm p-4">
      <form action={saveCollectionDesign} className="space-y-3.5">
        {design && <input type="hidden" name="id" value={design.id} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input name="name" defaultValue={design?.name ?? ""} placeholder="Nom du design (ex : Square Painted)" required />
          <Select name="edition" defaultValue={design?.edition ?? COMMERCIAL_EDITIONS[1]}>
            {COMMERCIAL_EDITIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <Select name="execution" defaultValue={design?.execution ?? ""}>
            <option value="">Exécution : non précisée</option>
            {EXECUTIONS.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {FAMILIES.map((family) => (
            <div key={family.key}>
              <p className="mb-1 text-[11px] uppercase tracking-widest2 text-paper/45">{family.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {family.sizes.map((size) => (
                  <label key={size} className="cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="avail"
                      value={availabilityValue(family.key, size)}
                      defaultChecked={design ? isAvailable(design.availability, family.key, size) : false}
                      className="peer sr-only"
                    />
                    <span className="block rounded-sm border border-line px-2.5 py-1 text-xs text-paper/55 transition-colors peer-checked:border-gold peer-checked:bg-gold/10 peer-checked:text-paper peer-focus-visible:ring-1 peer-focus-visible:ring-gold">
                      {size}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit">{design ? "Enregistrer" : "Ajouter à la matrice"}</Button>
        </div>
      </form>
      {design && (
        <form action={deleteCollectionDesign} className="mt-2">
          <input type="hidden" name="id" value={design.id} />
          <button type="submit" className="text-xs text-paper/40 hover:text-danger">
            Retirer de la matrice
          </button>
        </form>
      )}
    </div>
  );
}
