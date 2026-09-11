import { createServerSupabaseClient } from "@vez/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

/** Renova a sessão antes de qualquer renderização protegida do painel. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerSupabaseClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      for (const { name, value } of cookiesToSet) {
        request.cookies.set(name, value);
      }

      response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
    },
  });

  // getUser valida o JWT com o Auth server e atualiza os cookies quando preciso.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/"],
};
