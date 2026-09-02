import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Dois clientes, com propósitos que não devem se misturar.
 *
 * `asUser` carrega o JWT de quem chamou e obedece a RLS — é o que responde
 * "quem é você". `asAdmin` usa a chave secreta e ignora a RLS; só ele escreve,
 * e só depois de a função ter validado tudo à mão.
 */
export function asUser(req: Request): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

export function asAdmin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}
