"use client";

import { useState } from "react";
import { PhotoCapture } from "@/components/PhotoCapture";

// CTA pleine largeur "Ajouter une photo" (vue atelier) : replie par defaut,
// revele les deux options existantes (fichier / camera) de PhotoCapture au
// clic, pour rester sur un seul geste evident plutot que deux boutons
// secondaires d'emblee.
export function AddPhotoAction({ bagId }: { bagId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-sm bg-gold py-3 text-sm text-ink"
      >
        Ajouter une photo
      </button>
    );
  }

  return <PhotoCapture bagId={bagId} />;
}
