// Aides communes aux pages du catalogue (cote serveur).

import type { createClient } from "@/lib/supabase/server";
import { parseAvailability, type CollectionDesign } from "./collection";
import { isExecutionKey } from "./execution";
import { parseLegacyNeverfull } from "./sku";

type Sb = ReturnType<typeof createClient>;

// L'API Supabase plafonne chaque requete a 1000 lignes : on lit le catalogue
// par pages de 1000 jusqu'a epuisement. L'erreur eventuelle est renvoyee (et
// non avalee) pour que la page puisse l'afficher ou se rabattre sur un secours.
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) return { rows, error: error.message };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return { rows, error: null };
}

// Design d'un code sans colonne `design` renseignee (secours) : le code sans
// "PK" ni taille (25, 30... ou PM, MM, GM). Meme regle que la migration 0029,
// sauf les anciens codes Neverfull (taille en une lettre, voir sku.ts) dont le
// design est lu comme dans la migration 0035 (PKNSQGM -> NSQ).
export function deriveDesign(sku: string): string {
  const legacy = parseLegacyNeverfull(sku);
  if (legacy) return legacy.design;
  const stem = (sku.startsWith("PK") ? sku.slice(2) : sku).replace(/(\d+|PM|MM|GM)$/, "");
  return stem || sku;
}

export const MIGRATION_0029_MESSAGE =
  "La migration 0029_fiches_design_catalogue.sql n'est pas encore appliquee dans Supabase : les fiches sont regroupees provisoirement d'apres les codes. Lance-la dans l'editeur SQL pour activer la gestion des modeles et couleurs.";

// Nom lisible des designs (migration 0036), pour une liste de codes : lu par
// paquets, erreur ignoree (sans migration, on retombe sur le line sheet puis sur
// l'acronyme). Renvoie code -> nom.
export async function fetchDesignNames(supabase: Sb, skus: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(skus.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 150) chunks.push(unique.slice(i, i + 150));
  const results = await Promise.all(chunks.map((chunk) => supabase.from("sku_catalog").select("sku, design_name").in("sku", chunk)));
  for (const { data, error } of results) {
    if (error || !data) continue;
    for (const r of data as { sku: string; design_name: string | null }[]) {
      if (r.design_name) names.set(r.sku, r.design_name);
    }
  }
  return names;
}

// Matrice des editions (table collection_designs, migration 0036). Liste vide si
// la table n'existe pas encore : les ecrans restent utilisables sans.
export async function fetchCollection(supabase: Sb): Promise<CollectionDesign[]> {
  const { data, error } = await supabase
    .from("collection_designs")
    .select("id, name, edition, execution, availability, sort_order")
    .order("sort_order");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    edition: r.edition as string,
    execution: isExecutionKey(r.execution) ? r.execution : null,
    availability: parseAvailability(r.availability),
    sortOrder: (r.sort_order as number) ?? 999,
  }));
}
