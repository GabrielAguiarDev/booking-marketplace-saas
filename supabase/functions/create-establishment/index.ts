import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";

/**
 * Abre um cadastro de estabelecimento em nome da conta autenticada.
 *
 * A escrita usa service_role porque `establishments` deliberadamente não tem
 * INSERT para usuários. Identidade e regras de preenchimento continuam no
 * banco: o JWT define o dono e a RPC cria loja, vínculo e serviços na mesma
 * transação.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const {
    data: { user },
  } = await asUser(req).auth.getUser();
  if (!user) return fail("unauthorized", "Entre para cadastrar sua loja.", 401);

  let application: unknown;
  try {
    application = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }
  if (!application || typeof application !== "object" || Array.isArray(application)) {
    return fail("invalid_body", "Cadastro inválido.");
  }

  const { data, error } = await asAdmin().rpc("create_establishment_application", {
    p_owner: user.id,
    p_application: application,
  });

  if (error) {
    const conflict = error.code === "23505";
    return fail(
      conflict ? "application_exists" : "invalid_application",
      error.message || "Não foi possível cadastrar a loja.",
      conflict ? 409 : 400,
    );
  }

  return json({ establishment_id: data }, 201);
});
