"use client";

import { useTransition } from "react";
import { deleteBagPhoto } from "@/app/(app)/bags/actions";

type Photo = { id: string; storage_path: string; url: string | null };

export function PhotoGallery({ bagId, photos }: { bagId: string; photos: Photo[] }) {
  const [isPending, startTransition] = useTransition();

  if (photos.length === 0) {
    return <p className="text-xs text-paper/30">Aucune photo pour le moment.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="group relative overflow-hidden rounded-sm border border-line">
          {photo.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => deleteBagPhoto(photo.id, photo.storage_path, bagId))}
            className="absolute right-1 top-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-red-300 opacity-0 transition-opacity group-hover:opacity-100"
          >
            Supprimer
          </button>
        </div>
      ))}
    </div>
  );
}
