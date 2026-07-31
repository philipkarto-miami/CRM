"use client";

import { useRef, useState, useTransition } from "react";
import { uploadBagPhoto } from "@/app/(app)/bags/actions";
import { Button } from "@/components/ui/Button";

export function PhotoCapture({ bagId }: { bagId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function uploadFile(file: File) {
    const fd = new FormData();
    fd.set("photo", file);
    startTransition(() => {
      uploadBagPhoto(bagId, fd);
    });
  }

  async function startWebcam() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError("Impossible d'accéder à la caméra. Vérifie les autorisations du navigateur.");
    }
  }

  function stopWebcam() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          uploadFile(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
        }
      },
      "image/jpeg",
      0.9
    );
    stopWebcam();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
        >
          Choisir un fichier
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={streaming ? stopWebcam : startWebcam}
          disabled={isPending}
        >
          {streaming ? "Fermer la caméra" : "Utiliser la caméra"}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = "";
        }}
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {streaming && (
        <div className="card space-y-2 rounded-sm p-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="w-full rounded-sm" muted playsInline />
          <Button type="button" onClick={capturePhoto}>
            Capturer
          </Button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {isPending && <p className="text-xs text-paper/40">Envoi en cours…</p>}
    </div>
  );
}
