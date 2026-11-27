import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { fetchAllRows, deriveDesign } from "@/lib/catalogue";
import { LINE_SHEET_BY_SKU, LINE_SHEET_CODES, codesOutsideLineSheet, lookalikeCode } from "@/lib/linesheet";
import { checkRecipe, executionInfo, executionLabel, stepCodeLabel } from "@/lib/execution";

type Row = {
  sku: string;
  design: string | null;
  color_code: string | null;
  steps: Record<string, number | string> | null;
};
type LineRow = { sku: string; execution: string | null; max_units: number | null };

// Gamme 2027 : le line sheet (inventaire des codes vendus aux acheteurs)
// compare au catalogue du CRM. Lecture seule : rien n'est cree ni renomme ici.
export default async function GammePage() {
  const supabase = createClient();

  const [catalog, line] = await Promise.all([
    fetchAllRows<Row>((from, to) =>
      supabase.from("sku_catalog").select("sku, design, color_code, steps").order("sku").range(from, to)
    ),
    // Colonnes de la migration 0035 : lues a part (erreur ignoree = pas encore appliquee).
    fetchAllRows<LineRow>((from, to) =>
      supabase.from("sku_catalog").select("sku, execution, max_units").order("sku").range(from, to)
    ),
  ]);
  const migrationMissing = Boolean(line.error);
  const lineBySku = new Map(line.rows.map((r) => [r.sku, r]));

  const skus = catalog.rows.map((r) => r.sku);
  const skuSet = new Set(skus);
  const missing = LINE_SHEET_CODES.filter((c) => !skuSet.has(c.sku));
  const outside = codesOutsideLineSheet(skus);

  // Ecarts recette / execution, regroupes par design + couleur + ecart.
  type Gap = { design: string; color: string | null; execution: string; text: string; codes: string[] };
  const gaps = new Map<string, Gap>();
  for (const r of catalog.rows) {
    const execution = lineBySku.get(r.sku)?.execution ?? LINE_SHEET_BY_SKU.get(r.sku)?.execution ?? null;
    const info = executionInfo(execution);
    if (!info) continue;
    const { missing: miss, unexpected } = checkRecipe(execution, Object.keys(r.steps ?? {}));
    const parts: string[] = [];
    if (miss.length) parts.push(`manque ${miss.map(stepCodeLabel).join(", ")}`);
    if (unexpected.length) parts.push(`en trop : ${unexpected.map(stepCodeLabel).join(", ")}`);
    if (parts.length === 0) continue;
    const design = r.design ?? deriveDesign(r.sku);
    const text = parts.join(" · ");
    const key = `${design}|${r.color_code ?? ""}|${text}`;
    const gap = gaps.get(key) ?? { design, color: r.color_code, execution: info.label, text, codes: [] };
    gap.codes.push(r.sku);
    gaps.set(key, gap);
  }
  const gapList = [...gaps.values()].sort((a, b) => a.design.localeCompare(b.design) || (a.color ?? "").localeCompare(b.color ?? ""));

  // Plafonds de production : sacs deja attribues a chaque code plafonne.
  const capped = line.rows.filter((r) => r.max_units).sort((a, b) => a.sku.localeCompare(b.sku));
  const used = new Map<string, number>();
  if (capped.length > 0) {
    const { data } = await supabase
      .from("bags")
      .select("sku")
      .in(
        "sku",
        capped.map((r) => r.sku)
      );
    for (const b of data ?? []) used.set(b.sku as string, (used.get(b.sku as string) ?? 0) + 1);
  }

  const missingByEdition = new Map<string, typeof missing>();
  for (const c of missing) missingByEdition.set(c.edition, [...(missingByEdition.get(c.edition) ?? []), c]);

  const stat = (label: string, value: number | string, tone?: "warn") => (
    <div className="card rounded-sm p-4">
      <p className="text-[11px] uppercase tracking-widest2 text-paper/45">{label}</p>
      <p className={`mt-1 font-serif text-3xl ${tone === "warn" ? "text-gold" : "text-paper"}`}>{value}</p>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Gamme 2027"
        action={
          <LinkButton href="/catalogue" variant="secondary">
            ← Codes PK
          </LinkButton>
        }
      />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-paper/55">
        Le line sheet 2027 (les codes présentés aux acheteurs) comparé au catalogue de l&apos;atelier. Lecture seule : rien
        n&apos;est créé ni renommé depuis cette page.
      </p>

      {catalog.error && (
        <p className="mb-4 rounded-sm border border-danger bg-danger/5 px-3.5 py-2.5 text-xs text-danger">
          Impossible de lire le catalogue : {catalog.error}
        </p>
      )}
      {!catalog.error && migrationMissing && (
        <p className="mb-4 rounded-sm border border-line bg-gold/5 px-3.5 py-2.5 text-xs text-paper/70">
          La migration 0035_ligne_collection.sql n&apos;est pas encore appliquée dans Supabase : les exécutions viennent
          alors du line sheet directement, et les plafonds ne s&apos;affichent pas.
        </p>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat("Codes du line sheet", LINE_SHEET_CODES.length)}
        {stat("Déjà au catalogue", LINE_SHEET_CODES.length - missing.length)}
        {stat("Manquants", missing.length, missing.length > 0 ? "warn" : undefined)}
        {stat("Recettes à revoir", gapList.length, gapList.length > 0 ? "warn" : undefined)}
      </div>

      <section className="mb-10">
        <h2 className="mb-1 font-serif text-xl text-paper">Codes manquants au catalogue</h2>
        <p className="mb-4 text-xs text-paper/55">
          Vendus dans le line sheet mais absents du CRM : impossible de leur attribuer un sac tant qu&apos;ils n&apos;existent
          pas. Crée-les depuis « Nouveau design » (l&apos;exécution pré-remplit la recette).
        </p>
        {missing.length === 0 ? (
          <p className="text-sm text-paper/45">Aucun : tous les codes du line sheet existent.</p>
        ) : (
          [...missingByEdition].map(([edition, items]) => (
            <div key={edition} className="mb-5">
              <p className="mb-2 text-xs uppercase tracking-widest2 text-gold">
                {edition} <span className="text-paper/45">· {items.length}</span>
              </p>
              <div className="card overflow-x-auto rounded-sm">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {items.map((c) => {
                      const near = lookalikeCode(c.sku, skuSet);
                      return (
                        <tr key={c.sku} className="border-b border-line/60 last:border-0">
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-paper/85">{c.sku}</td>
                          <td className="px-3 py-2 text-paper/70">
                            {c.model} · {c.silhouette} {c.size}
                          </td>
                          <td className="px-3 py-2 text-paper/55">{c.color}</td>
                          <td className="px-3 py-2 text-paper/55">{executionLabel(c.execution)}</td>
                          <td className="px-3 py-2 text-xs text-gold">
                            {near && (
                              <Link href={`/catalogue/${encodeURIComponent(near)}`} className="hover:underline">
                                proche de {near} (à vérifier)
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-1 font-serif text-xl text-paper">Recettes qui ne correspondent pas à l&apos;exécution</h2>
        <p className="mb-4 text-xs text-paper/55">
          Une étape attendue manque, ou une étape inattendue est cochée. Avertissement seulement : une recette peut être
          voulue ainsi. Corrige-la depuis la fiche du design.
        </p>
        {gapList.length === 0 ? (
          <p className="text-sm text-paper/45">Aucun écart.</p>
        ) : (
          <div className="card overflow-x-auto rounded-sm">
            <table className="w-full text-left text-sm">
              <tbody>
                {gapList.map((g) => (
                  <tr key={`${g.design}|${g.color}|${g.text}`} className="border-b border-line/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link
                        href={`/catalogue/design/${encodeURIComponent(g.design)}`}
                        className="text-paper/85 hover:text-gold"
                      >
                        PK{g.design}
                      </Link>
                      {g.color && <span className="ml-1.5 text-xs text-paper/45">{g.color}</span>}
                    </td>
                    <td className="px-3 py-2 text-paper/55">{g.execution}</td>
                    <td className="px-3 py-2 text-gold">{g.text}</td>
                    <td className="px-3 py-2 text-xs text-paper/45">
                      {g.codes.length} code{g.codes.length > 1 ? "s" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {capped.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 font-serif text-xl text-paper">Plafonds de production</h2>
          <p className="mb-4 text-xs text-paper/55">
            Capsules et éditions limitées : au plafond, le code ne peut plus être attribué à un sac.
          </p>
          <div className="card overflow-x-auto rounded-sm">
            <table className="w-full text-left text-sm">
              <tbody>
                {capped.map((r) => {
                  const n = used.get(r.sku) ?? 0;
                  const full = n >= (r.max_units as number);
                  return (
                    <tr key={r.sku} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-paper/85">
                        <Link href={`/catalogue/${encodeURIComponent(r.sku)}`} className="hover:text-gold">
                          {r.sku}
                        </Link>
                      </td>
                      <td className={`px-3 py-2 ${full ? "text-gold" : "text-paper/65"}`}>
                        {n} / {r.max_units}
                        {full ? " · complet" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-1 font-serif text-xl text-paper">Au catalogue, hors line sheet</h2>
        <p className="mb-3 text-xs text-paper/55">
          {outside.length} code{outside.length > 1 ? "s" : ""} (anciens codes, archives, essais). Information : rien à corriger.
        </p>
        {outside.length > 0 && (
          <details className="card rounded-sm p-3">
            <summary className="cursor-pointer text-xs text-paper/60">Voir la liste</summary>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {outside.map((sku) => (
                <Link
                  key={sku}
                  href={`/catalogue/${encodeURIComponent(sku)}`}
                  className="rounded-sm border border-line px-1.5 py-0.5 font-mono text-[11px] text-paper/65 hover:border-gold"
                >
                  {sku}
                </Link>
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
