// Aides communes aux pages du catalogue (cote serveur).

// L'API Supabase plafonne chaque requete a 1000 lignes : on lit le catalogue
// par pages de 1000 jusqu'a epuisement.
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await fetchPage(from, from + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

// Design d'un code sans colonne `design` renseignee (secours) : le code sans
// "PK" ni taille (25, 30... ou PM, MM, GM).
export function deriveDesign(sku: string): string {
  const stem = (sku.startsWith("PK") ? sku.slice(2) : sku).replace(/(\d+|PM|MM|GM)$/, "");
  return stem || sku;
}
