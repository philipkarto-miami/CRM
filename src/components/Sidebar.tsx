"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function Sidebar({ role, fullName }: { role: UserRole; fullName: string }) {
  const pathname = usePathname();

  // La sidebar reste sombre (comme le bandeau noir du site philipkarto.com)
  // pendant que le reste de l'outil est clair et epure : le logo blanc
  // officiel n'existe que dans cette variante, il a besoin d'un fond sombre.
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-brandDark">
      <div className="px-6 py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/philip-karto-logo-white.avif" alt="Philip Karto" className="h-6 w-auto" />
        <p className="mt-2 text-[0.7rem] uppercase tracking-widest2 text-[#8a6a30]">Atelier CRM</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block px-3 py-2 text-sm tracking-wide transition-colors",
                active
                  ? "border-l-2 border-gold bg-white/5 text-[#c9a35c]"
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
    </aside>
  );
}
