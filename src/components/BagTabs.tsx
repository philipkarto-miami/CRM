"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tab = "fabrication" | "informations" | "photos";

const TABS: { id: Tab; label: string }[] = [
  { id: "fabrication", label: "Fabrication" },
  { id: "informations", label: "Informations" },
  { id: "photos", label: "Photos" },
];

// Sur mobile (<768px) la fiche sac bascule en onglets pour rester utilisable
// a une main ; sur desktop (md:) on retrouve la mise en page 3 colonnes
// habituelle, tout est affiche en meme temps (les onglets sont ignores).
export function BagTabs({
  informations,
  photos,
  fabrication,
}: {
  informations: ReactNode;
  photos: ReactNode;
  fabrication: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("fabrication");

  return (
    <div>
      <div className="mb-4 flex h-[46px] border-b border-line md:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 text-sm transition-colors",
              tab === t.id ? "border-b-2 border-gold font-semibold text-gold" : "text-paper/50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="md:grid md:grid-cols-3 md:gap-8">
        <div className="md:col-span-2">
          <div className={cn(tab === "informations" ? "block" : "hidden", "md:block")}>{informations}</div>
          <div className={cn(tab === "photos" ? "block mt-0" : "hidden", "md:mt-8 md:block")}>{photos}</div>
        </div>
        <div className={cn(tab === "fabrication" ? "block" : "hidden", "md:block")}>{fabrication}</div>
      </div>
    </div>
  );
}
