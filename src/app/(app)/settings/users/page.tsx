import { redirect } from "next/navigation";
import { getCurrentProfile, createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { RoleSelect } from "@/components/RoleSelect";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/types/database";

export default async function UsersSettingsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");

  return (
    <div>
      <PageHeader eyebrow="Parametres" title="Utilisateurs" />

      <div className="card overflow-hidden rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-widest2 text-paper/40">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Membre depuis</th>
            </tr>
          </thead>
          <tbody>
            {(profiles as Profile[] | null)?.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 text-paper/80">{p.full_name}</td>
                <td className="px-4 py-3 text-paper/60">{p.email}</td>
                <td className="px-4 py-3">
                  <RoleSelect profileId={p.id} role={p.role} />
                </td>
                <td className="px-4 py-3 text-paper/60">{formatDate(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-paper/40">
        Pour creer un nouvel utilisateur, invite-le depuis le tableau de bord Supabase
        (Authentication &gt; Users &gt; Invite). Il apparaitra ici automatiquement avec le
        role &quot;Atelier&quot; par defaut ; change son role si besoin.
      </p>
    </div>
  );
}
