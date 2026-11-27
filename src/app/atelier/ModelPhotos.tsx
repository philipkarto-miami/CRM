"use client";

import { useState } from "react";

/** Photos recto / verso du modèle PK à réaliser. Un appui agrandit la photo. */
export default function ModelPhotos({
  front,
  back,
  compact = false,
}: {
  front: string | null;
  back: string | null;
  compact?: boolean;
}) {
  const [zoom, setZoom] = useState<string | null>(null);
  const items = [
    { src: front, tag: "Recto" },
    { src: back, tag: "Verso" },
  ].filter((i): i is { src: string; tag: string } => Boolean(i.src));

  if (items.length === 0) {
    return <p className="af-meta">Pas de photo pour ce modèle dans le catalogue.</p>;
  }

  return (
    <>
      <div
        className="af-photos"
        style={compact ? { gridTemplateColumns: `repeat(${items.length}, 96px)`, gap: 10 } : undefined}
      >
        {items.map((i) => (
          <button
            key={i.tag}
            type="button"
            className="af-photo"
            onClick={() => setZoom(i.src)}
            aria-label={`Agrandir la photo ${i.tag.toLowerCase()}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.src} alt={`Modèle — ${i.tag}`} />
            {!compact && <span className="af-photo__tag">{i.tag}</span>}
          </button>
        ))}
      </div>
      {zoom && (
        <div className="af-modal" onClick={() => setZoom(null)} role="dialog" aria-label="Photo agrandie">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Modèle agrandi" />
        </div>
      )}
    </>
  );
}
