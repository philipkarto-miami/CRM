"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Bandeau de confirmation apres un enregistrement reussi. Se declenche quand
// l'URL contient ?saved=<message> (pose par le server action juste avant sa
// redirection), s'affiche quelques secondes puis disparait, et nettoie le
// parametre de l'URL pour qu'un rafraichissement de la page ne le fasse pas
// reapparaitre.
//
// useSearchParams() exige un Suspense au-dessus de lui (sinon Next.js fait
// echouer le build) : on l'encapsule ici pour que les pages qui utilisent
// <SavedToast /> n'aient pas a s'en soucier.
export function SavedToast() {
  return (
    <Suspense fallback={null}>
      <SavedToastInner />
    </Suspense>
  );
}

function SavedToastInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = searchParams.get("saved");
    if (!saved) return;

    setMessage(saved === "1" ? "Enregistre" : saved);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("saved");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    const timeout = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-sm border border-success bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
      <span className="text-success">✓</span> {message}
    </div>
  );
}
