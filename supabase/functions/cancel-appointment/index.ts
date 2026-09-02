import { asAdmin, asUser } from "../_shared/client.ts";
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

  const {
    data: { user },
  } = await asUser(req).auth.getUser();
  if (!user) return fail("unauthorized", "Entre para cancelar.", 401);

  let body: { appointment_id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }

  if (!body.appointment_id) return fail("missing_fields", "Informe a reserva.");

  const admin = asAdmin();

  const { data: appointment } = await admin
    .from("appointments")
    .select("id, customer_id, status, starts_at, deposit_cents, establishment_id")
    .eq("id", body.appointment_id)
    .maybeSingle();

  if (!appointment) return fail("not_found", "Reserva não encontrada.", 404);
  if (appointment.customer_id !== user.id) {
    // Mesma resposta de "não existe": dizer "existe, mas não é sua" confirma a
    // existência de uma reserva alheia para quem está sondando ids.
    return fail("not_found", "Reserva não encontrada.", 404);
  }
  if (!["scheduled", "confirmed"].includes(appointment.status)) {
    return fail("not_cancellable", "Esta reserva não pode mais ser cancelada.", 409);
  }

  const { data: establishment } = await admin
    .from("establishments")
    .select("cancellation_window_minutes")
    .eq("id", appointment.establishment_id)
    .maybeSingle();

  const windowMinutes = establishment?.cancellation_window_minutes ?? 0;
  const minutesUntilStart = (new Date(appointment.starts_at).getTime() - Date.now()) / 60_000;
  const withinFreeWindow = minutesUntilStart >= windowMinutes;

  const { error: updateError } = await admin
    .from("appointments")
    .update({
      status: "cancelled_by_customer",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: body.reason ?? null,
    })
    .eq("id", appointment.id);

  if (updateError) return fail("update_failed", "Não foi possível cancelar.", 500);

  return json({
    cancelled: true,
    within_free_window: withinFreeWindow,
    // O app usa isto para dizer se o sinal volta ou não. Quem decide o estorno
    // de fato é a fase de pagamento; aqui só se registra o veredito.
    deposit_cents: appointment.deposit_cents,
    minutes_until_start: Math.round(minutesUntilStart),
  });
});
