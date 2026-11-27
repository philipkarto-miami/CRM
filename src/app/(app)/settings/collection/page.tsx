import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { SavedToast } from "@/components/SavedToast";
import { CollectionDesignForm } from "@/components/CollectionDesignForm";
import { parseAvailability, type CollectionDesign } from "@/lib/collection";
import { COMMERCIAL_EDITIONS, isExecutionKey } from "@/lib/execution";

// Reglages > Collection : la matrice des editions (quels designs, dans quelle
// edition, en quels modeles et tailles). Elle alimente « Nouveau design » (les
// modeles se cochent d'office), les noms affiches a l'atelier et les controles
// de gamme du catalogue.
export default async function CollectionSettingsPage({ searchParams }: { searchParams: { error?: string } }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("collection_designs")
    .select("id, name, edition, execution, availability, sort_order")
    .order("sort_order")
    .order("name");

  const designs: CollectionDesign[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    edition: r.edition as string,
    execution: isExecutionKey(r.execution) ? r.execution : null,
    availability: parseAvailability(r.availability),
    sortOrder: (r.sort_order as number) ?? 999,
  }));

  const byEdition = COMMERCIAL_EDITIONS.map((edition) => ({
    edition: edition as string,
    items: designs.filter((d) => d.edition === edition),
  })).filter((g) => g.items.length > 0);
  const known = new Set<string>(COMMERCIAL_EDITIONS);
  const others = designs.filter((d) => !known.has(d.edition));
  if (others.length > 0) byEdition.push({ edition: "Autres", items: others });

  return (
    <div>
      <SavedToast />
      <PageHeader eyebrow="Parametres" title="Collection" />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-paper/55">
        La matrice des éditions : pour chaque design, son édition et les modèles vendus. « Nouveau design » coche les
        modèles d&apos;office, et le catalogue signale ce qui manque ou sort de la gamme.
      </p>

      {searchParams?.error && <p className="mb-4 text-sm text-danger">Erreur : {searchParams.error}</p>}
      {error && (
        <p className="mb-4 rounded-sm border border-line bg-gold/5 px-3.5 py-2.5 text-sm text-paper/70">
          La migration 0036_matrice_collection.sql n&apos;est pas encore appliquée dans Supabase : lance-la dans
          l&apos;éditeur SQL pour activer la matrice.
        </p>
      )}

      {!error && (
        <div className="space-y-8">
          {byEdition.map((group) => (
            <section key={group.edition}>
              <p className="eyebrow mb-2">
                {group.edition} <span className="text-paper/40">· {group.items.length}</span>
              </p>
              <div className="space-y-3">
                {group.items.map((design) => (
                  <CollectionDesignForm key={design.id} design={design} />
                ))}
              </div>
            </section>
          ))}

          <section>
            <p className="eyebrow mb-2">Ajouter un design</p>
            <CollectionDesignForm />
          </section>
        </div>
      )}
    </div>
  );
}
