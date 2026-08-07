import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import type { SkuCatalog } from "@/types/database";

export default async function CataloguePage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const q = searchParams?.q?.trim() ?? "";

  let query = supabase.from("sku_catalog").select("*").order("sku");
  if (q) {
    query = query.or(`sku.ilike.%${q}%,edition.ilike.%${q}%`);
  }
  const { data: entries } = await query.limit(200);

  const photoUrls = new Map<string, string>();
  for (const entry of (entries as SkuCatalog[] | null) ?? []) {
    if (!entry.photo_path) continue;
    const { data } = await supabase.storage.from("sku-photos").createSignedUrl(entry.photo_path, 3600);
    if (data?.signedUrl) photoUrls.set(entry.sku, data.signedUrl);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Codes PK"
        action={<LinkButton href="/catalogue/new">+ Nouveau code PK</LinkButton>}
      />

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un SKU ou une edition (ex: PKPOP, PK.03)"
          className="input-base w-full max-w-md px-3 py-2 text-sm"
        />
      </form>

      <p className="mb-3 text-xs text-paper/40">
        {entries?.length ?? 0} code{(entries?.length ?? 0) > 1 ? "s" : ""} PK{q ? ` correspondant a "${q}"` : ""}
        {(entries?.length ?? 0) >= 200 && " (200 premiers resultats, affine ta recherche)"}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(entries as SkuCatalog[] | null)?.map((entry) => (
          <Link
            key={entry.sku}
            href={`/catalogue/${entry.sku}`}
            className="card block space-y-2.5 rounded-sm p-3 hover:border-gold/40"
          >
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-sm bg-black/[0.03]">
              {photoUrls.has(entry.sku) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrls.get(entry.sku)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-paper/30">Pas de photo</span>
              )}
            </div>
            <p className="text-sm text-paper/80">{entry.sku}</p>
            <p className="text-xs text-paper/40">{entry.edition ?? "-"}</p>
          </Link>
        ))}
        {(!entries || entries.length === 0) && (
          <p className="col-span-full py-10 text-center text-paper/40">Aucun code PK trouve.</p>
        )}
      </div>
    </div>
  );
}
