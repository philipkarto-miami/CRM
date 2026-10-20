// Aides communes aux pages du catalogue (cote serveur).

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
// "PK" ni taille (25, 30... ou PM, MM, GM). Meme regle que la migration 0029.
export function deriveDesign(sku: string): string {
  const stem = (sku.startsWith("PK") ? sku.slice(2) : sku).replace(/(\d+|PM|MM|GM)$/, "");
  return stem || sku;
}

export const MIGRATION_0029_MESSAGE =
  "La migration 0029_fiches_design_catalogue.sql n'est pas encore appliquee dans Supabase : les fiches sont regroupees provisoirement d'apres les codes. Lance-la dans l'editeur SQL pour activer la gestion des modeles et couleurs.";
