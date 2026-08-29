import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

// Rafraichit la session Supabase a chaque requete et protege les routes
// de l'application (tout sauf /login est reserve aux utilisateurs connectes).
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        // Un Supabase lent a repondre (ex: sortie de pause du projet gratuit)
        // ne doit pas faire attendre le middleware jusqu'a la coupure Vercel
        // (25s, ecran 504 brut pour le visiteur) : on abandonne l'appel apres
        // 8s et on traite ca comme "verification impossible" plus bas.
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, signal: AbortSignal.timeout(8000) }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase injoignable/trop lent : on ne bloque pas la requete jusqu'au
    // timeout Vercel, on renvoie plutot vers /login avec un message clair
    // (l'utilisateur peut reessayer une fois Supabase revenu).
    if (isLoginRoute) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "Connexion a la base de donnees indisponible, reessaie dans une minute.");
    return NextResponse.redirect(url);
  }

  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
