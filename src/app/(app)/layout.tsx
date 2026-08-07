import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink md:flex-row">
      <Sidebar role={profile.role} fullName={profile.full_name || profile.email} />
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
