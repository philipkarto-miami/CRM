"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recharge les donnees de la page serveur toutes les quelques secondes et au reveil de la tablette. */
export default function LiveRefresh({ everyMs = 10000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), everyMs);
    const onVis = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, everyMs]);
  return null;
}
