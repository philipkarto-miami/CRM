"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function PhotoPickerInline({ onChange }: { onChange: (file: File | null) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setFile(file: File) {
    onChange(file);
    setPreview(URL.createObjectURL(file));
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
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) setFile(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
    stopWebcam();
  }

  function removePhoto() {
    onChange(null);
    setPreview(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Choisir un fichier
        </Button>
        <Button type="button" variant="secondary" onClick={streaming ? stopWebcam : startWebcam}>
          {streaming ? "Fermer la caméra" : "Utiliser la caméra"}
        </Button>
        {preview && (
          <Button type="button" variant="ghost" onClick={removePhoto}>
            Retirer la photo
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setFile(file);
          e.target.value = "";
        }}
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Le <video> reste toujours monte (juste masque quand inactif) : s'il
          n'etait rendu que lorsque streaming=true, la reference videoRef
          serait encore vide au moment ou startWebcam() essaie d'y attacher
          le flux camera, et l'aperçu resterait noir malgre l'autorisation
          accordee. */}
      <div className={cn("card space-y-2 rounded-sm p-3", !streaming && "hidden")}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="w-full rounded-sm bg-black" autoPlay muted playsInline />
        <Button type="button" onClick={capturePhoto}>
          Capturer
        </Button>
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-32 w-32 rounded-sm object-cover" />
      )}
    </div>
  );
}
