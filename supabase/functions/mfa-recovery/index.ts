import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";

/**
 * Remove o segundo fator de uma conta, por um dos dois caminhos recuperáveis.
 *
 * Existe como Edge Function porque remover fator é a Admin API do Auth
 * (`auth.admin.mfa.deleteFactor`), que só aceita a secret key. A regra de quem
 * pode fica no banco (`20260917134000_mfa_recovery.sql`).
 *
 *   { "action": "redeem", "code": "ABCDE-FGHJK" }
 *     A própria pessoa, entrando só com a senha (aal1), usa um código de
 *     recuperação. O banco confere e consome o código, com freio de 5 erros
 *     em 15 minutos.
 *
 *   { "action": "reset_member", "user_id": "…" }
 *     Admin da plataforma, em aal2, redefine o fator de outra pessoa. O banco
 *     confere papel e aal e grava a auditoria antes da remoção.
 *
 * Remover um fator verificado encerra as sessões da conta: a pessoa entra de
 * novo com a senha e o painel pede o cadastro de um autenticador novo. Nos dois
 * caminhos ela recebe e-mail avisando (caixa de saída).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function removeFactors(admin: ReturnType<typeof asAdmin>, userId: string) {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) throw error;
  let removed = 0;
  for (const factor of data?.factors ?? []) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId,
    });
    if (deleteError) throw deleteError;
    removed += 1;
  }
  return removed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const userClient = asUser(req);
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return fail("unauthorized", "Entre com a sua senha antes de recuperar o acesso.", 401);

  let body: { action?: unknown; code?: unknown; user_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }

  const admin = asAdmin();

  if (body.action === "redeem") {
    const code = typeof body.code === "string" ? body.code : "";
    if (!code.trim()) return fail("invalid_code", "Informe um código de recuperação.");

    const { data: ok, error } = await admin.rpc("mfa_redeem_recovery_code", {
      p_user_id: user.id,
      p_code: code,
    });
    if (error) {
      if (error.hint === "rate_limited") return fail("rate_limited", error.message, 429);
      console.error("mfa-recovery: conferência falhou", error);
      return fail("redeem_failed", "Não foi possível conferir o código. Tente de novo.", 500);
    }
    if (!ok) return fail("invalid_code", "Código inválido ou já usado.", 400);

    let removed: number;
    try {
      removed = await removeFactors(admin, user.id);
    } catch (factorError) {
      // O código já foi consumido. A pessoa tem outros nove; o erro fica no log.
      console.error("mfa-recovery: remoção do fator falhou", factorError);
      return fail(
        "factor_reset_failed",
        "O código foi aceito, mas o autenticador não foi removido. Use outro código ou fale com a equipe.",
        502,
      );
    }

    const { error: doneError } = await admin.rpc("mfa_recovery_completed", {
      p_user_id: user.id,
      p_method: "code",
    });
    if (doneError) console.error("mfa-recovery: pós-remoção falhou", doneError);

    return json({ reset: true, factors_removed: removed });
  }

  if (body.action === "reset_member") {
    const target = typeof body.user_id === "string" ? body.user_id : "";
    if (!UUID.test(target)) return fail("invalid_user", "Informe a conta.");

    const { error: checkError } = await userClient.rpc("admin_mfa_reset_check", {
      p_user_id: target,
    });
    if (checkError) {
      if (checkError.code === "PVMFA") return fail("mfa_required", checkError.message, 403);
      if (checkError.code === "42501") return fail("forbidden", checkError.message, 403);
      if (checkError.code === "P0002") return fail("not_found", checkError.message, 404);
      if (checkError.code === "P0001")
        return fail(checkError.hint || "invalid", checkError.message, 400);
      console.error("mfa-recovery: checagem do admin falhou", checkError);
      return fail("check_failed", "Não foi possível conferir o seu acesso.", 500);
    }

    let removed: number;
    try {
      removed = await removeFactors(admin, target);
    } catch (factorError) {
      console.error("mfa-recovery: remoção do fator (admin) falhou", factorError);
      return fail("factor_reset_failed", "O Auth não removeu o autenticador. Tente de novo.", 502);
    }

    const { error: doneError } = await admin.rpc("mfa_recovery_completed", {
      p_user_id: target,
      p_method: "admin",
      p_actor_id: user.id,
    });
    if (doneError) console.error("mfa-recovery: pós-remoção falhou", doneError);

    return json({ reset: true, factors_removed: removed });
  }

  return fail("invalid_action", 'Use "redeem" ou "reset_member".');
});
