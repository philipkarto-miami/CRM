import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import HeaderClock from "./HeaderClock";
import { Icon } from "./ui";
import "./atelier.css";

export const metadata = { title: "Atelier — Philip Karto" };

// Mode tablette pour l'atelier : pleine largeur, sans la barre laterale du CRM.
// Reserve a l'admin et au compte atelier (compte partage).
export default async function AtelierLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "atelier") redirect("/dashboard");

  const name = (profile.full_name || String(profile.email).split("@")[0]) as string;
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "PK";

  return (
    <div className="af">
      <header className="af-header">
        <Link href="/production" aria-label="Retour au kanban de l'atelier" style={{ display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/philip-karto-logo-white.avif" alt="Philip Karto" className="af-header__logo" />
        </Link>
        <span className="af-header__div" aria-hidden />
        <Link href="/production" className="af-header__title">
          Atelier
        </Link>
        <span className="af-header__spacer" />
        <HeaderClock />
        <div className="af-pill">
          <span className="af-avatar" aria-hidden>
            {initials}
          </span>
          <span>
            <span className="af-pill__name" style={{ display: "block" }}>
              {name}
            </span>
            <span className="af-pill__role">{profile.role === "admin" ? "Admin" : "Atelier"}</span>
          </span>
          <Link
            href="/production"
            className="af-btn af-btn--outline-white"
            style={{ minHeight: 40, padding: "8px 18px", fontSize: 11 }}
          >
            <Icon name="arrowLeft" size={16} /> Retour à l&apos;atelier
          </Link>
        </div>
      </header>
      <main className="af-main">{children}</main>
    </div>
  );
}
