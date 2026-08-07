"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";
import { LogoutButton } from "@/components/LogoutButton";

const NAV: { href: string; label: string; roles?: UserRole[] }[] = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/catalogue", label: "Catalogue produits" },
  { href: "/bags", label: "Stock de sacs" },
  { href: "/production", label: "Fabrication" },
  { href: "/orders", label: "Ventes & commandes" },
  { href: "/customers", label: "Clients" },
  { href: "/suppliers", label: "Fournisseurs" },
  { href: "/settings/stages", label: "Etapes de fabrication", roles: ["admin"] },
  { href: "/settings/users", label: "Utilisateurs", roles: ["admin"] },
];

function SidebarContent({
  role,
  fullName,
  onNavigate,
}: {
  role: UserRole;
  fullName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="px-6 py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/philip-karto-logo-white.avif" alt="Philip Karto" className="h-6 w-auto" />
        <p className="mt-2 text-[0.7rem] uppercase tracking-widest2 text-gold">Atelier CRM</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "block px-3 py-2 text-sm tracking-wide transition-colors",
                active
                  ? "border-l-2 border-gold bg-white/5 text-goldBright"
                  : "border-l-2 border-transparent text-white/50 hover:text-white/90"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-4">
        <p className="text-sm text-white/80">{fullName}</p>
        <p className="mb-3 text-xs uppercase tracking-widest2 text-white/30">{role}</p>
        <LogoutButton />
      </div>
    </>
  );
}

export function Sidebar({ role, fullName }: { role: UserRole; fullName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Referme le drawer a chaque changement de page (ex: retour navigateur).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // La sidebar reste sombre (comme le bandeau noir du site philipkarto.com)
  // pendant que le reste de l'outil est clair et epure : le logo blanc
  // officiel n'existe que dans cette variante, il a besoin d'un fond sombre.
  return (
    <>
      {/* Barre mobile : hamburger + logo, visible uniquement sous md. */}
      <div className="flex h-14 shrink-0 items-center gap-3 bg-brandDark px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="flex h-11 w-11 items-center justify-center -ml-2 text-white/70 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/philip-karto-logo-white.avif" alt="Philip Karto" className="h-5 w-auto" />
      </div>

      {/* Sidebar desktop, toujours visible a partir de md. */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col bg-brandDark md:flex">
        <SidebarContent role={role} fullName={fullName} />
      </aside>

      {/* Drawer mobile : overlay + panneau glissant, memes contenus. */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="relative flex h-full w-72 max-w-[80vw] flex-col bg-brandDark shadow-xl">
            <SidebarContent role={role} fullName={fullName} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
