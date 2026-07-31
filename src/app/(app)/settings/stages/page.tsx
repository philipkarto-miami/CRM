import { redirect } from "next/navigation";
import { getCurrentProfile, createClient } from "@/lib/supabase/server";
import { createStage } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { StageToggle } from "@/components/StageToggle";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/constants";
import type { ProductionStage } from "@/types/database";

export default async function StagesSettingsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: stages } = await supabase
    .from("production_stages")
    .select("*")
    .order("phase")
    .order("order_index");

  const grouped = PHASE_ORDER.map((phase) => ({
    phase,
    items: (stages as ProductionStage[] | null)?.filter((s) => s.phase === phase) ?? [],
  }));

  return (
    <div>
      <PageHeader eyebrow="Parametres" title="Etapes de fabrication" />

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          {grouped.map((group) => (
            <div key={group.phase}>
              <p className="eyebrow mb-2">{PHASE_LABELS[group.phase]}</p>
              <div className="card divide-y divide-line/60 rounded-sm">
                {group.items.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-paper/80">
                      {stage.order_index}. {stage.name}
                    </span>
                    <StageToggle stageId={stage.id} isActive={stage.is_active} />
                  </div>
                ))}
                {group.items.length === 0 && (
                  <p className="px-4 py-4 text-xs text-paper/30">Aucune etape</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <Card>
          <CardTitle>Ajouter une etape</CardTitle>
          <form action={createStage} className="space-y-3">
            <FormRow label="Phase">
              <Select name="phase" required>
                {PHASE_ORDER.map((phase) => (
                  <option key={phase} value={phase}>
                    {PHASE_LABELS[phase]}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Nom de l'etape">
              <Input name="name" required />
            </FormRow>
            <FormRow label="Ordre">
              <Input type="number" name="order_index" defaultValue={1} min={1} required />
            </FormRow>
            <Button type="submit" className="w-full">
              Ajouter
            </Button>
          </form>
          <p className="mt-4 text-xs text-paper/40">
            Note : ajouter/desactiver une etape ici ne modifie pas les sacs deja en cours de
            fabrication, seulement les nouveaux sacs crees ensuite.
          </p>
        </Card>
      </div>
    </div>
  );
}
