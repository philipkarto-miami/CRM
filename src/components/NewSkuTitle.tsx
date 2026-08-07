"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Field";

// Le titre de la page reprend en direct le SKU tape, pour que la fiche
// "ressemble" au code PK des le debut plutot que d'afficher un intitule
// generique jusqu'a l'enregistrement.
export function NewSkuTitle() {
  const [sku, setSku] = useState("");

  return (
    <>
      <p className="mb-0.5 text-xs uppercase tracking-widest2 text-gold">
        <span className="text-paper/45">Catalogue /</span> Nouveau code PK
      </p>
      <h2 className="font-serif text-2xl text-paper">
        {sku.trim() ? sku.trim().toUpperCase() : "Nouveau code PK"}{" "}
        <span className="text-base text-paper/45">· brouillon</span>
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest2 text-paper/55">SKU</p>
          <Input
            name="sku"
            required
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="PKPOP35"
            className="text-[13px]"
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest2 text-paper/55">Edition</p>
          <Input name="edition" placeholder="PK.03" className="text-[13px]" />
        </div>
      </div>
    </>
  );
}
