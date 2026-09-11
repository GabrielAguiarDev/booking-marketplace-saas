import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";

/**
 * Convida uma pessoa para a equipe da plataforma.
 *
 * Existe como Edge Function porque criar a conta de outra pessoa e mandar o
 * e-mail de convite é a Admin API do Auth, que só aceita a secret key — e a
 * secret key não pode ir para o navegador.
 *
 * A divisão de trabalho:
 *
 * 1. **Quem chama é admin?** Conferido aqui, antes de qualquer e-mail sair:
 *    sem isso, qualquer conta logada usaria a função para disparar convites.
 * 2. **Conta e e-mail.** `inviteUserByEmail` cria a conta e manda o convite;
 *    para uma conta convidada que ainda não aceitou, reenvia. Se o e-mail já
 *    pertence a uma conta ativa, o Auth recusa com `email_exists` — então só
 *    concedemos o papel, e a pessoa entra com a senha que já usa.
 * 3. **Papel e auditoria.** Quem grava é a RPC `admin_add_team_member`, chamada
 *    com o JWT de quem convidou. A RPC confere o papel de novo, e a linha de
 *    auditoria sai em nome da pessoa certa, na mesma transação da concessão.
 */

const ROLES = ["admin", "operations", "finance", "support"] as const;
type Role = (typeof ROLES)[number];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const userClient = asUser(req);
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return fail("unauthorized", "Entre no painel para convidar alguém.", 401);

  const admin = asAdmin();

  const { data: caller, error: callerError } = await admin
    .from("platform_admins")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (callerError) return fail("lookup_failed", "Não foi possível conferir o seu acesso.", 500);
  if (!caller) return fail("forbidden", "Acesso restrito à equipe da plataforma.", 403);
  if (caller.role !== "admin") {
    return fail(
      "forbidden",
      "Só quem é administrador da plataforma convida pessoas para a equipe.",
      403,
    );
  }

  // O convite sai pela Admin API antes da RPC que grava o papel. Passamos antes
  // pela porta de entrada do banco (`admin_require`, que exige aal2 quando o
  // segundo fator está ligado), para uma sessão só com senha não disparar e-mail.
  const { error: gateError } = await userClient.rpc("admin_me");
  if (gateError) {
    return fail(gateError.code === "PVMFA" ? "mfa_required" : "forbidden", gateError.message, 403);
  }

  let body: { email?: unknown; name?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role as Role;

  if (!EMAIL.test(email)) return fail("invalid_email", "Informe um e-mail válido.");
  if (name.length < 2) return fail("invalid_name", "Informe o nome da pessoa.");
  if (name.length > 120) return fail("invalid_name", "O nome pode ter até 120 caracteres.");
  if (!ROLES.includes(role)) return fail("invalid_role", "Escolha o papel da pessoa.");

  // O convite leva de volta ao painel. Precisa estar em
  // `additional_redirect_urls` do Auth; senão o Auth cai no `site_url`.
  const redirectTo = Deno.env.get("ADMIN_SITE_URL") ?? "http://localhost:3002/";

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
    redirectTo,
  });

  let invited = true;
  if (inviteError) {
    if (
      inviteError.code === "email_exists" ||
      /already been registered/i.test(inviteError.message)
    ) {
      invited = false;
    } else if (inviteError.code === "over_email_send_rate_limit" || inviteError.status === 429) {
      return fail(
        "rate_limited",
        "O limite de e-mails do Auth foi atingido. Tente de novo em alguns minutos.",
        429,
      );
    } else {
      console.error("admin-invite: convite recusado pelo Auth", inviteError);
      return fail("invite_failed", "O Auth não conseguiu enviar o convite. Tente de novo.", 502);
    }
  }

  const { data: userId, error: grantError } = await userClient.rpc("admin_add_team_member", {
    p_email: email,
    p_name: name,
    p_role: role,
    p_invited: invited,
  });

  if (grantError) {
    const status =
      grantError.code === "42501"
        ? 403
        : grantError.code === "23505"
          ? 409
          : grantError.code === "P0002"
            ? 404
            : grantError.code === "P0001"
              ? 400
              : 500;
    if (status === 500) console.error("admin-invite: papel não gravado", grantError);
    // A mensagem da RPC já é a frase para a tela. Se o convite saiu e o papel
    // não entrou, repetir o convite resolve: o Auth reenvia e a RPC concede.
    const message =
      status === 500
        ? invited
          ? "O convite foi enviado, mas o papel não foi gravado. Convide de novo."
          : "Não foi possível gravar o papel. Tente de novo."
        : grantError.message;
    return fail(status === 409 ? "already_member" : "grant_failed", message, status);
  }

  return json({ user_id: userId, invited }, invited ? 201 : 200);
});
