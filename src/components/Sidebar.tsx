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

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-line bg-ink">
      <div className="px-6 py-8">
        <p className="font-serif text-xl tracking-wide text-paper">Philip Karto</p>
        <p className="eyebrow mt-1">Atelier CRM</p>
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
                active ? "border-l-2 border-gold bg-white/5 text-gold" : "border-l-2 border-transparent text-paper/60 hover:text-paper"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-6 py-4">
        <p className="text-sm text-paper">{fullName}</p>
        <p className="mb-3 text-xs uppercase tracking-widest2 text-paper/40">{role}</p>
        <LogoutButton />
      </div>
    </aside>
  );
}
