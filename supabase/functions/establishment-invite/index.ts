import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";

/**
 * Convida uma pessoa para a equipe de uma loja (portal ou app da loja).
 *
 * Mesmo desenho da `admin-invite`, com o portão da loja no lugar do da
 * plataforma:
 *
 * 1. **Pode convidar?** `establishment_invite_check`, com o JWT de quem chama,
 *    antes de qualquer e-mail sair: só o dono, papel `manager` ou `staff`,
 *    cadeira da própria loja, e não é alguém que já está na equipe.
 * 2. **Conta e e-mail.** `inviteUserByEmail` cria a conta e manda o convite
 *    (modelo `supabase/templates/invite.html`); para convite ainda não aceito,
 *    reenvia. E-mail que já tem conta: o Auth recusa com `email_exists`, a
 *    pessoa é vinculada direto e recebe o aviso pela caixa de saída.
 * 3. **Vínculo, cadeira e convite.** `establishment_add_member`, de novo com o
 *    JWT de quem convidou, numa transação só.
 *
 * Corpo: { establishment_id, email, name, role: "manager"|"staff", professional_id? }
 * Resposta: { user_id, invited } — `invited` falso quando a conta já existia.
 */

const ROLES = ["manager", "staff"] as const;
type Role = (typeof ROLES)[number];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function statusFor(code: string | undefined) {
  switch (code) {
    case "42501":
      return 403;
    case "23505":
      return 409;
    case "P0002":
      return 404;
    case "P0001":
      return 400;
    default:
      return 500;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const userClient = asUser(req);
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return fail("unauthorized", "Entre para convidar alguém.", 401);

  let body: {
    establishment_id?: unknown;
    email?: unknown;
    name?: unknown;
    role?: unknown;
    professional_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }

  const establishmentId = typeof body.establishment_id === "string" ? body.establishment_id : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role as Role;
  const professionalId =
    typeof body.professional_id === "string" && body.professional_id ? body.professional_id : null;

  if (!UUID.test(establishmentId)) return fail("invalid_establishment", "Informe a loja.");
  if (!EMAIL.test(email)) return fail("invalid_email", "Informe um e-mail válido.");
  if (name.length < 2 || name.length > 120)
    return fail("invalid_name", "Informe o nome da pessoa.");
  if (!ROLES.includes(role)) return fail("invalid_role", "Escolha gerência ou equipe.");
  if (professionalId && !UUID.test(professionalId)) {
    return fail("invalid_professional", "Profissional inválido.");
  }

  const { error: checkError } = await userClient.rpc("establishment_invite_check", {
    p_establishment_id: establishmentId,
    p_email: email,
    p_role: role,
    p_professional_id: professionalId,
  });
  if (checkError) {
    const status = statusFor(checkError.code);
    if (status === 500) console.error("establishment-invite: checagem falhou", checkError);
    return fail(checkError.hint || "check_failed", checkError.message, status);
  }

  // Precisa estar em `additional_redirect_urls` do Auth; senão cai no site_url.
  const portal = (Deno.env.get("PORTAL_SITE_URL") ?? "http://localhost:3001").replace(/\/+$/, "");
  const redirectTo = `${portal}/convite`;

  const admin = asAdmin();
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
      console.error("establishment-invite: convite recusado pelo Auth", inviteError);
      return fail("invite_failed", "O Auth não conseguiu enviar o convite. Tente de novo.", 502);
    }
  }

  // A chave secreta grava somente um convite pendente. O vínculo e a cadeira
  // nascem depois, quando a própria pessoa aceita em /convite.
  const { data: invitationId, error: grantError } = await admin.rpc(
    "establishment_record_invite",
    {
    p_establishment_id: establishmentId,
    p_email: email,
    p_name: name,
    p_role: role,
    p_professional_id: professionalId,
    p_sent_by_auth: invited,
      p_invited_by: user.id,
    },
  );

  if (grantError) {
    const status = statusFor(grantError.code);
    if (status === 500) console.error("establishment-invite: vínculo não gravado", grantError);
    const message =
      status === 500
        ? invited
          ? "O convite foi enviado, mas o vínculo não foi gravado. Convide de novo."
          : "Não foi possível gravar o vínculo. Tente de novo."
        : grantError.message;
    return fail(grantError.hint || "grant_failed", message, status);
  }

  return json({ invitation_id: invitationId, invited }, invited ? 201 : 200);
});
