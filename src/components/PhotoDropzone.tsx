"use client";

import { useRef, useState } from "react";

// Slot photo carre 96px, integre directement au formulaire d'identite du
// SKU (soumis avec le reste : plus besoin d'un mini-formulaire d'upload a
// part). Affiche la photo existante si il y en a une, ou un apercu local
// (URL.createObjectURL) des qu'un fichier est choisi. Le champ "name" et le
// libelle sont personnalisables pour permettre plusieurs slots sur une
// meme fiche (ex : recto / verso).
export function PhotoDropzone({
  name = "photo",
  label = "Deposer une photo",
  existingUrl,
}: {
  name?: string;
  label?: string;
  existingUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square w-24 items-center justify-center overflow-hidden rounded-sm border border-dashed border-line bg-bone/60 p-1.5 text-center text-[10px] text-paper/45"
      >
        {preview || existingUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview ?? existingUrl ?? ""} alt="" className="h-full w-full object-cover" />
        ) : (
          label
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setPreview(URL.createObjectURL(file));
        }}
      />
    </div>
  );
}
