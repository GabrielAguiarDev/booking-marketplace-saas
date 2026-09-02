import { cookies } from "next/headers";

import { createServerSupabaseClient, type ServerSupabaseClient } from "./server";

/**
 * Liga o cliente de servidor ao cookie store do Next.
 *
 * Existe aqui, e não em cada app, porque o tratamento do `setAll` é sutil e
 * errá-lo em um dos três portais só apareceria como sessão que não renova.
 * Os apps Expo nunca importam este módulo, então o Metro não o alcança.
 */
export async function createNextServerClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();

  return createServerSupabaseClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Server Component não pode escrever cookie — só Server Action e Route
        // Handler podem. Quem renova o token nesse caso é o middleware, então
        // engolir aqui é intencional e não mascara bug.
      }
    },
  });
}
