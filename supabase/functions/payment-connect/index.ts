import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";
import { signConnectState, verifyConnectState } from "../_shared/payments/core.ts";
import { activeProvider, functionUrl } from "../_shared/payments/store.ts";

/**
 * Liga a conta de recebimento da loja ao Vez.
 *
 * Duas entradas na mesma função, porque a URL de retorno do OAuth precisa ser
 * uma só e estar cadastrada no provedor:
 *
 *   POST  (dono logado)  { establishment_id, action: "start" | "disconnect" }
 *         "start" devolve a URL do provedor para o portal redirecionar.
 *   GET   (navegador voltando do provedor)  ?code=…&state=…
 *         troca o código por tokens, guarda no Vault e devolve o dono ao portal.
 *
 * Roda com `verify_jwt = false` por causa do GET, que chega sem JWT. O POST
 * confere o usuário à mão; o GET confia só no `state`, que é assinado por nós,
 * expira em 15 minutos e carrega a loja e o dono que começaram o fluxo.
 */

const env = (name: string) => (Deno.env.get(name) ?? "").trim();

function backToPortal(result: "conectado" | "erro"): Response {
  const base = env("PORTAL_URL") || "http://127.0.0.1:3001";
  return Response.redirect(`${base}/?section=billing&recebimento=${result}`, 303);
}

async function isOwner(userId: string, establishmentId: string): Promise<boolean> {
  const { data } = await asAdmin()
    .from("establishment_members")
    .select("role")
    .eq("user_id", userId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  return data?.role === "owner";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const provider = activeProvider();
  const stateSecret = env("PAYMENTS_STATE_SECRET");
  const redirectUri = functionUrl("payment-connect");

  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!provider || !stateSecret || !code || !state) return backToPortal("erro");

    const claims = await verifyConnectState(stateSecret, state);
    // O dono pode ter perdido o papel entre começar e voltar.
    if (!claims || !(await isOwner(claims.userId, claims.establishmentId))) {
      return backToPortal("erro");
    }

    try {
      const account = await provider.exchangeCode(code, redirectUri);
      const { error } = await asAdmin().rpc("payment_account_store", {
        p_establishment_id: claims.establishmentId,
        p_provider: provider.name,
        p_external_account_id: account.externalAccountId,
        p_access_token: account.accessToken,
        p_refresh_token: account.refreshToken,
        p_token_expires_at: account.expiresAt?.toISOString() ?? null,
        p_connected_by: claims.userId,
      });
      if (error) throw new Error(error.message);
      return backToPortal("conectado");
    } catch (error) {
      console.error("payment-connect: troca do código", error);
      return backToPortal("erro");
    }
  }

  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const {
    data: { user },
  } = await asUser(req).auth.getUser();
  if (!user) return fail("unauthorized", "Entre para continuar.", 401);

  let body: { establishment_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }
  if (!body.establishment_id) return fail("missing_fields", "Informe a loja.");
  if (!(await isOwner(user.id, body.establishment_id))) {
    return fail("forbidden", "Só o dono da loja configura o recebimento.", 403);
  }
  if (!provider || !stateSecret) {
    return fail("payment_unavailable", "O pagamento pelo app ainda não está disponível.", 503);
  }

  if (body.action === "disconnect") {
    const { error } = await asAdmin().rpc("payment_account_revoke", {
      p_establishment_id: body.establishment_id,
      p_provider: provider.name,
    });
    if (error) return fail("update_failed", "Não foi possível desconectar.", 500);
    return json({ disconnected: true });
  }

  const state = await signConnectState(stateSecret, {
    establishmentId: body.establishment_id,
    userId: user.id,
  });
  return json({ url: provider.authorizeUrl(state, redirectUri), provider: provider.name });
});
