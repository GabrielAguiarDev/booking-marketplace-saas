import { asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";

/**
 * Cancela uma reserva do próprio cliente.
 *
 * A RLS já permitiria o `update` (política `appointments_cancel_own`). Esta
 * função existe pela janela de cancelamento: ela é uma regra de negócio da
 * loja (`cancellation_window_minutes`), e expressá-la como política de RLS
 * significaria escondê-la num `using` que ninguém lê — e devolver ao app um
 * "0 linhas atualizadas" sem explicação em vez de "faltam 40 minutos".
 *
 * Fora da janela, o cancelamento não é recusado: ele acontece e é marcado como
 * fora do prazo, para a cobrança de multa (fase 6) ter em que se apoiar.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const userClient = asUser(req);
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return fail("unauthorized", "Entre para cancelar.", 401);

  let body: { appointment_id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }

  if (!body.appointment_id) return fail("missing_fields", "Informe a reserva.");

  const { data, error } = await userClient.rpc("customer_cancel_appointment", {
    p_appointment_id: body.appointment_id,
    p_reason: body.reason ?? null,
  });
  if (error) {
    if (error.hint === "not_found") return fail("not_found", "Reserva não encontrada.", 404);
    if (error.hint === "not_cancellable") return fail("not_cancellable", error.message, 409);
    console.error("cancel-appointment: RPC falhou", error);
    return fail("update_failed", "Não foi possível cancelar.", 500);
  }
  const result = (data ?? [])[0] as
    | { within_free_window: boolean; deposit_cents: number; minutes_until_start: number }
    | undefined;

  return json({
    cancelled: true,
    within_free_window: result?.within_free_window ?? false,
    // O app usa isto para dizer se o sinal volta ou não. Quem decide o estorno
    // de fato é a fase de pagamento; aqui só se registra o veredito.
    deposit_cents: result?.deposit_cents ?? 0,
    minutes_until_start: result?.minutes_until_start ?? 0,
  });
});
