import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";
import type { Bag } from "@/types/database";

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ data: bags }, { data: paidOrders }, { count: customerCount }] = await Promise.all([
    supabase.from("bags").select("id, current_phase, delivery_date"),
    supabase.from("orders").select("sale_price").eq("payment_status", "paye"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  const typedBags = (bags as Pick<Bag, "id" | "current_phase" | "delivery_date">[] | null) || [];
  const today = new Date().toISOString().slice(0, 10);

  const late = typedBags.filter(
    (b) => b.delivery_date && b.delivery_date < today && b.current_phase !== "shipping"
  ).length;

  const ca = (paidOrders || []).reduce((sum, o: { sale_price: number | null }) => sum + (o.sale_price || 0), 0);

  const counts = PHASE_ORDER.map((phase) => ({
    phase,
    count: typedBags.filter((b) => b.current_phase === phase).length,
  }));

  return (
    <div>
      <PageHeader eyebrow="Vue d'ensemble" title="Tableau de bord" />

      <div className="mb-8 grid grid-cols-4 gap-6">
        <Card>
          <p className="eyebrow mb-2">Sacs en stock</p>
          <p className="font-serif text-3xl text-paper">{typedBags.length}</p>
        </Card>
        <Card>
          <p className="eyebrow mb-2">Clients</p>
          <p className="font-serif text-3xl text-paper">{customerCount ?? 0}</p>
        </Card>
        <Card>
          <p className="eyebrow mb-2">Chiffre d&apos;affaires encaisse</p>
          <p className="font-serif text-3xl text-paper">{formatMoney(ca)}</p>
        </Card>
        <Card>
          <p className="eyebrow mb-2">Sacs en retard</p>
          <p className="font-serif text-3xl text-red-400">{late}</p>
        </Card>
      </div>

      <p className="eyebrow mb-3">Repartition par phase</p>
      <div className="grid grid-cols-7 gap-4">
        {counts.map((c) => (
          <Card key={c.phase}>
            <p className="text-xs uppercase tracking-widest2 text-paper/40">{PHASE_LABELS[c.phase]}</p>
            <p className="mt-2 font-serif text-2xl text-gold">{c.count}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
