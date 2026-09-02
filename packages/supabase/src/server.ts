import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

import type { Database } from "./database.types";
import { requireEnv } from "./env";

/**
 * Cliente para Server Components, Route Handlers e Server Actions.
 *
 * O adapter de cookie entra por parâmetro de propósito: assim este pacote não
 * importa `next/headers` e continua carregável pelo Metro, que empacota os dois
 * apps Expo a partir do mesmo workspace.
 *
 * Continua sendo um cliente sujeito a RLS. Não existe cliente de service role
 * neste pacote — ver a nota no fim do arquivo.
 */
export function createServerSupabaseClient(cookies: CookieMethodsServer) {
  return createServerClient<Database>(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
    { cookies },
  );
}

export type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>;

/**
 * NOTA DE SEGURANÇA
 *
 * A secret key (`sb_secret_...`, antiga service_role) nunca é lida aqui, e não
 * existe entrypoint neste pacote que a aceite. Ela ignora RLS por completo.
 *
 * Toda operação que precisa desse privilégio — criar estabelecimento validando
 * a cota da cidade, promover admin da plataforma, conciliar cobrança — vive em
 * Edge Function, lendo a chave do ambiente do Deno.
 *
 * O motivo de não existir sequer um `admin.ts` opcional: bastaria um import
 * errado num Server Component para a chave entrar no bundle do cliente. Se ela
 * não está no pacote, esse erro não é possível.
 */
