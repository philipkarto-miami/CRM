import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { SavedToast } from "@/components/SavedToast";
import { deriveDesign, fetchAllRows } from "@/lib/catalogue";

type CatalogRow = { sku: string; design: string | null; edition: string | null; photo_path: string | null };

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

  const rows = await fetchAllRows<CatalogRow>((from, to) =>
    supabase.from("sku_catalog").select("sku, design, edition, photo_path").order("sku").range(from, to)
  );

  const byDesign = new Map<string, DesignCard>();
  for (const row of rows) {
    const design = row.design ?? deriveDesign(row.sku);
    const card = byDesign.get(design) ?? { design, codes: [], edition: null, photoPath: null };
    card.codes.push(row.sku);
    card.edition = card.edition ?? row.edition;
    card.photoPath = card.photoPath ?? row.photo_path;
    byDesign.set(design, card);
  }

  const cards = [...byDesign.values()]
    .filter(
      (c) =>
        !q ||
        c.design.toLowerCase().includes(q) ||
        (c.edition ?? "").toLowerCase().includes(q) ||
        c.codes.some((code) => code.toLowerCase().includes(q))
    )
    .sort((a, b) => a.design.localeCompare(b.design));

  const photoUrls = new Map<string, string>();
  const paths = [...new Set(cards.map((c) => c.photoPath).filter((p): p is string => Boolean(p)))];
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("sku-photos").createSignedUrls(paths, 3600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) photoUrls.set(item.path, item.signedUrl);
    }
  }

  const codeCount = cards.reduce((sum, c) => sum + c.codes.length, 0);

  return (
    <div>
      <SavedToast />
      <PageHeader
        eyebrow="Catalogue"
        title="Codes PK"
        action={<LinkButton href="/catalogue/new">+ Nouveau design</LinkButton>}
      />

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
        {cards.map((card) => (
          <Link
            key={card.design}
            href={`/catalogue/design/${encodeURIComponent(card.design)}`}
            className="card block space-y-2.5 rounded-sm p-3 hover:border-gold/40"
          >
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
        ))}
        {cards.length === 0 && <p className="col-span-full py-10 text-center text-paper/40">Aucun design trouve.</p>}
      </div>
    </div>
  );
}
