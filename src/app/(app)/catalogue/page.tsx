import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { SavedToast } from "@/components/SavedToast";
import { MIGRATION_0029_MESSAGE, deriveDesign, fetchAllRows } from "@/lib/catalogue";

type CatalogRow = { sku: string; design?: string | null; edition: string | null; photo_path: string | null };

type DesignCard = {
  design: string;
  codes: string[];
  edition: string | null;
  photoPath: string | null;
};

// Une fiche par design (code sans "PK" ni taille) : PKSBLK30 a PKSBLK55 = une
// seule fiche. Chaque code reste accessible depuis la fiche.
export default async function CataloguePage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const q = searchParams?.q?.trim().toLowerCase() ?? "";

  // Lecture normale (avec la colonne `design` de la migration 0029). Si elle
  // n'existe pas encore, on relit sans elle et on deduit le design du code :
  // le catalogue reste visible au lieu de s'afficher vide.
  let { rows, error } = await fetchAllRows<CatalogRow>((from, to) =>
    supabase.from("sku_catalog").select("sku, design, edition, photo_path").order("sku").range(from, to)
  );
  let migrationMissing = false;
  if (error) {
    migrationMissing = true;
    ({ rows, error } = await fetchAllRows<CatalogRow>((from, to) =>
      supabase.from("sku_catalog").select("sku, edition, photo_path").order("sku").range(from, to)
    ));
  }

  const byDesign = new Map<string, DesignCard>();
  for (const row of rows) {
    const design = row.design ?? deriveDesign(row.sku);
    const card = byDesign.get(design) ?? { design, codes: [], edition: null, photoPath: null };
    card.codes.push(row.sku);
    card.edition = card.edition ?? row.edition;
    card.photoPath = card.photoPath ?? row.photo_path;
    byDesign.set(design, card);
  }

  // Recherche tolerante : casse, espaces et tirets ignores ("pk sblk-30" trouve
  // PKSBLK30). Un code precis (sous-code) retrouve la fiche du design qui le
  // contient ; la carte affiche alors le ou les codes trouves.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, "");
  const nq = norm(q);

  const cards = [...byDesign.values()]
    .map((card) => {
      if (!nq) return { card, matched: [] as string[], wholeDesign: true };
      const wholeDesign = norm(`PK${card.design}`).includes(nq) || norm(card.edition ?? "").includes(nq);
      const matched = card.codes.filter((code) => norm(code).includes(nq));
      return { card, matched: wholeDesign ? card.codes : matched, wholeDesign };
    })
    .filter((entry) => !nq || entry.matched.length > 0)
    .sort((a, b) => a.card.design.localeCompare(b.card.design));

  const photoUrls = new Map<string, string>();
  const paths = [...new Set(cards.map((c) => c.card.photoPath).filter((p): p is string => Boolean(p)))];
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("sku-photos").createSignedUrls(paths, 3600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) photoUrls.set(item.path, item.signedUrl);
    }
  }

  const codeCount = cards.reduce((sum, c) => sum + (nq ? c.matched.length : c.card.codes.length), 0);

  return (
    <div>
      <SavedToast />
      <PageHeader
        eyebrow="Catalogue"
        title="Codes PK"
        action={<LinkButton href="/catalogue/new">+ Nouveau design</LinkButton>}
      />

      {error && (
        <p className="mb-4 rounded-sm border border-danger bg-danger/5 px-3.5 py-2.5 text-xs text-danger">
          Impossible de lire le catalogue : {error}
        </p>
      )}
      {!error && migrationMissing && (
        <p className="mb-4 rounded-sm border border-line bg-gold/5 px-3.5 py-2.5 text-xs text-paper/70">
          {MIGRATION_0029_MESSAGE}
        </p>
      )}

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={searchParams?.q ?? ""}
          placeholder="Rechercher un design, un code ou une edition (ex: SBLK, PKPOP35, PK.03)"
          className="input-base w-full max-w-md px-3 py-2 text-sm"
        />
      </form>

      <p className="mb-3 text-xs text-paper/40">
        {cards.length} design{cards.length > 1 ? "s" : ""} · {codeCount} code{codeCount > 1 ? "s" : ""} PK
        {q ? ` correspondant a "${searchParams?.q?.trim()}"` : ""}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map(({ card, matched, wholeDesign }) => {
          // Recherche d'un sous-code : on montre les codes trouves (liens directs
          // vers leur fiche), la carte elle-meme ouvre la fiche mere du design.
          const showMatches = Boolean(nq) && !wholeDesign && matched.length > 0;
          return (
            <div key={card.design} className="card space-y-2.5 rounded-sm p-3 hover:border-gold/40">
              <Link href={`/catalogue/design/${encodeURIComponent(card.design)}`} className="block space-y-2.5">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-sm bg-black/[0.03]">
                  {card.photoPath && photoUrls.has(card.photoPath) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrls.get(card.photoPath)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-paper/30">Pas de photo</span>
                  )}
                </div>
                <p className="text-sm text-paper/80">PK{card.design}</p>
                <p className="text-xs text-paper/40">
                  {card.codes.length} code{card.codes.length > 1 ? "s" : ""}
                  {card.edition ? ` · ${card.edition}` : ""}
                </p>
              </Link>
              {showMatches && (
                <div className="flex flex-wrap gap-1 border-t border-line/60 pt-2">
                  {matched.slice(0, 4).map((code) => (
                    <Link
                      key={code}
                      href={`/catalogue/${encodeURIComponent(code)}`}
                      title="Ouvrir ce code"
                      className="rounded-sm border border-gold/50 bg-gold/10 px-1.5 py-0.5 font-mono text-[11px] text-paper/80 hover:border-gold"
                    >
                      {code}
                    </Link>
                  ))}
                  {matched.length > 4 && <span className="px-1 py-0.5 text-[11px] text-paper/45">+{matched.length - 4}</span>}
                </div>
              )}
            </div>
          );
        })}
        {cards.length === 0 && <p className="col-span-full py-10 text-center text-paper/40">Aucun design trouve.</p>}
      </div>
    </div>
  );
}
