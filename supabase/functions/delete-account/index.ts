import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";

/**
 * Exclui a conta do próprio cliente (LGPD, art. 18, VI).
 *
 * Duas etapas, nesta ordem:
 *
 *   1. `customer_delete_account()` anonimiza os dados no banco — política
 *      completa no comentário da migration `20260917120000_cliente_conta.sql`.
 *      Só service role executa a função, por isso ela não é RPC do app.
 *   2. Soft delete do usuário no Auth: e-mail e telefone ofuscados,
 *      identidades removidas, login impossível. É soft, e não hard, porque o
 *      hard apagaria `profiles` em cascata e com ele o histórico que a loja
 *      precisa manter (e esbarraria no `restrict` de `payments`).
 *
 * As duas etapas são idempotentes: se a segunda falhar, repetir o pedido
 * termina o serviço sem estragar o que a primeira fez.
 *
 * A confirmação digitada vem no corpo para que um toque acidental, ou uma
 * chamada sem a tela de aviso, nunca chegue até aqui.
 */
const CONFIRMATION = "EXCLUIR";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const {
    data: { user },
  } = await asUser(req).auth.getUser();
  if (!user) return fail("unauthorized", "Entre para excluir sua conta.", 401);

  const signedInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
  if (!signedInAt || Date.now() - signedInAt > 10 * 60_000) {
    return fail(
      "reauth_required",
      "Entre novamente na sua conta e repita a exclusão em até 10 minutos.",
      403,
    );
  }

  let body: { confirmation?: string };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }

  if ((body.confirmation ?? "").trim().toUpperCase() !== CONFIRMATION) {
    return fail("confirmation_required", `Digite ${CONFIRMATION} para confirmar.`);
  }

  const admin = asAdmin();

  const { data, error } = await admin.rpc("customer_delete_account", { p_user_id: user.id });
  if (error) {
    // Códigos estáveis vêm em `hint` (ver migration). Os que o cliente precisa
    // ler — tem loja, é da equipe — viram 409 com a mensagem do banco.
    if (error.hint === "has_establishment" || error.hint === "platform_staff") {
      return fail(error.hint, error.message, 409);
    }
    return fail("anonymize_failed", "Não foi possível excluir sua conta. Tente de novo.", 500);
  }

  // Soft delete do Auth não é contrato para limpar campos livres. Fazemos isso
  // explicitamente para não conservar nome/telefone em raw_user_meta_data.
  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {},
  });
  if (metadataError) {
    console.error("delete-account: limpeza de metadata falhou", metadataError);
    return fail("auth_metadata_failed", "Os dados foram apagados, mas o acesso ainda não foi encerrado. Tente de novo.", 500);
  }

  const { error: authError } = await admin.auth.admin.deleteUser(user.id, true);
  if (authError) {
    return fail(
      "auth_delete_failed",
      "Seus dados foram apagados, mas não conseguimos encerrar o acesso. Tente de novo.",
      500,
    );
  }

  const summary = (data ?? [])[0] as
    { cancelled_appointments: number; anonymized_reviews: number } | undefined;

  return json({
    deleted: true,
    cancelled_appointments: summary?.cancelled_appointments ?? 0,
    anonymized_reviews: summary?.anonymized_reviews ?? 0,
  });
});
