"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Vue "live" d'un ecran atelier : rafraichie depuis le serveur toutes les
 * quelques secondes (plusieurs tablettes sur le meme sac restent synchronisees)
 * et horloge alignee sur l'heure du serveur, pour que les chronos ne derivent
 * jamais et ne repartent pas de zero quand une tablette se met en veille.
 */
export function useLiveView<T extends { serverNow: number }>(initial: T, url: string, everyMs = 8000) {
  const [view, setView] = useState<T>(initial);
  const offset = useRef(0);
  const [now, setNow] = useState<number>(initial.serverNow);

  useEffect(() => {
    offset.current = initial.serverNow - Date.now();
  }, [initial.serverNow]);

  const refresh = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const next = (await res.json()) as T;
    offset.current = next.serverNow - Date.now();
    setView(next);
  }, [url]);

  // Tick chaque seconde (aligne sur le serveur)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(t);
  }, []);

  // Interrogation reguliere + rafraichissement au reveil de la tablette
  useEffect(() => {
    const t = setInterval(refresh, everyMs);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, everyMs]);

  return { view, refresh, now };
}

export async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = res
    ? ((await res.json().catch(() => ({}))) as Record<string, unknown>)
    : { error: "Pas de connexion — réessaie." };
  return { ok: !!res?.ok, data };
}
