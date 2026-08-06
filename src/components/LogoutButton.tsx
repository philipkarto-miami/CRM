"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="text-xs uppercase tracking-widest2 text-white/50 hover:text-[#c9a35c]"
    >
      Deconnexion
    </button>
  );
}
