import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PHASE_LABELS, SALE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Bag } from "@/types/database";

export default async function BagsPage() {
  const supabase = createClient();
  const { data: bags } = await supabase
    .from("bags")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        eyebrow="Stock"
        title="Sacs en stock"
        action={<LinkButton href="/bags/new">+ Nouveau sac</LinkButton>}
      />

      <div className="card overflow-hidden rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-widest2 text-paper/40">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Modele</th>
              <th className="px-4 py-3">N° serie</th>
              <th className="px-4 py-3">Type de vente</th>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">Livraison</th>
            </tr>
          </thead>
          <tbody>
            {(bags as Bag[] | null)?.map((bag) => (
              <tr key={bag.id} className="border-b border-line/60 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/bags/${bag.id}`} className="text-gold hover:underline">
                    {bag.sku}
                  </Link>
                </td>
                <td className="px-4 py-3 text-paper/80">{bag.model_label}</td>
                <td className="px-4 py-3 text-paper/60">{bag.serial_number}</td>
                <td className="px-4 py-3 text-paper/60">{SALE_TYPE_LABELS[bag.sale_type]}</td>
                <td className="px-4 py-3">
                  <Badge tone="gold">{PHASE_LABELS[bag.current_phase]}</Badge>
                </td>
                <td className="px-4 py-3 text-paper/60">{formatDate(bag.delivery_date)}</td>
              </tr>
            ))}
            {(!bags || bags.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-paper/40">
                  Aucun sac enregistre pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
