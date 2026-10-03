import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";
import {
  chargeAmountCents,
  MIN_CHARGE_CENTS,
  parseChargeRequest,
  PIX_TTL_MINUTES,
  platformFeeCents,
} from "../_shared/payments/core.ts";
import {
  activeProvider,
  applyCharge,
  chargeOf,
  closePending,
  merchantFor,
  PAYMENT_COLUMNS,
  type PaymentRow,
  providerByName,
  publicPayment,
  webhookUrl,
} from "../_shared/payments/store.ts";
import { ProviderError } from "../_shared/payments/types.ts";

/**
 * Cobra uma reserva pelo app — ou devolve a cobrança que já existe.
 *
 * Corpo: `{ appointment_id, method?: "pix" | "card", scope?: "deposit" | "full" }`.
 * Sem `method` nem `scope` a chamada é só "já paguei?": se há cobrança viva,
 * ela é conferida no provedor e devolvida. Isso faz o app funcionar mesmo que
 * o webhook nunca chegue. Com eles, e diferentes da cobrança que espera, a
 * anterior é encerrada no provedor antes de a nova nascer.
 *
 * O que o cliente NÃO escolhe: o valor (sinal ou preço, os dois congelados na
 * reserva), quem recebe (a conta que a loja conectou) e a taxa da Vez (o plano
 * da loja).
 *
 * A linha em `payments` nasce ANTES da chamada ao provedor. O índice único de
 * "uma cobrança viva por reserva" é o que impede dois toques simultâneos de
 * gerarem duas cobranças: o segundo insert falha antes de qualquer chamada
 * externa.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const {
    data: { user },
  } = await asUser(req).auth.getUser();
  if (!user) return fail("unauthorized", "Entre para pagar.", 401);

  let body: { appointment_id?: string; method?: unknown; scope?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }
  if (!body.appointment_id) return fail("missing_fields", "Informe a reserva.");
  const wanted = parseChargeRequest(body);
  const explicit = body.method !== undefined || body.scope !== undefined;

  const admin = asAdmin();

  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .select("id, establishment_id, customer_id, status, starts_at, price_cents, deposit_cents")
    .eq("id", body.appointment_id)
    .maybeSingle();
  if (appointmentError) return fail("lookup_failed", "Não foi possível ler a reserva.", 500);
  // Reserva de outra pessoa responde igual a reserva inexistente.
  if (!appointment || appointment.customer_id !== user.id) {
    return fail("not_found", "Reserva não encontrada.", 404);
  }

  const { data: live, error: liveError } = await admin
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("appointment_id", appointment.id)
    .in("status", ["pending", "authorized", "paid", "partially_refunded"])
    .maybeSingle();
  if (liveError) return fail("lookup_failed", "Não foi possível ler o pagamento.", 500);

  let existing = live as PaymentRow | null;
  try {
    if (existing && existing.status !== "pending" && existing.status !== "authorized") {
      return json({ payment: publicPayment(existing) });
    }

    if (existing) {
      const provider = existing.provider ? providerByName(existing.provider) : null;
      if (!provider) return fail("payment_unavailable", "Pagamento pelo app indisponível.", 503);
      const merchant = await merchantFor(admin, provider, existing.establishment_id);
      if (!merchant) return fail("payment_unavailable", "Pagamento pelo app indisponível.", 503);

      const expired = existing.expires_at && new Date(existing.expires_at).getTime() <= Date.now();
      const same =
        !explicit ||
        ((existing.provider_checkout_id ? "card" : "pix") === wanted.method &&
          existing.scope === wanted.scope);

      if (!existing.provider_charge_id && !existing.provider_checkout_id) {
        // A execução anterior morreu antes de falar com o provedor. A linha
        // sai de cena e a cobrança é criada de novo, abaixo.
        await admin.from("payments").update({ status: "failed" }).eq("id", existing.id);
        existing = null;
      } else if (same && !expired) {
        const charge = await chargeOf(provider, merchant, existing);
        return json({
          payment: publicPayment(charge ? await applyCharge(admin, existing, charge) : existing),
        });
      } else {
        // Venceu, ou o cliente trocou de método ou de valor. Encerrar antes de
        // emitir outra: duas cobranças vivas para a mesma reserva é como se
        // cobra duas vezes.
        const closed = await closePending(admin, provider, merchant, existing);
        if (closed.status === "pending" || closed.status === "authorized") {
          return fail("payment_busy", "Pagamento em processamento. Tente em instantes.", 409);
        }
        if (closed.status !== "cancelled" && closed.status !== "failed") {
          return json({ payment: publicPayment(closed) });
        }
        existing = null;
      }
    }
  } catch (error) {
    console.error("payment-create: conferência falhou", error);
    return fail("provider_failed", "Não foi possível conferir o pagamento. Tente de novo.", 502);
  }

  // ── cobrança nova ────────────────────────────────────────────────────────

  if (!["scheduled", "confirmed"].includes(appointment.status)) {
    return fail("not_payable", "Esta reserva não está mais ativa.", 409);
  }
  if (new Date(appointment.starts_at).getTime() <= Date.now()) {
    return fail("not_payable", "O horário desta reserva já passou.", 409);
  }
  const amountCents = chargeAmountCents(appointment, wanted.scope);
  if (amountCents < MIN_CHARGE_CENTS) {
    return fail(
      "no_deposit",
      wanted.scope === "full"
        ? "Esta reserva não tem valor a pagar pelo app."
        : "Esta reserva não tem sinal a pagar pelo app.",
      409,
    );
  }

  const provider = activeProvider();
  if (!provider) return fail("payment_unavailable", "Pagamento pelo app indisponível.", 503);
  if (!provider.methods.includes(wanted.method)) {
    return fail("method_unavailable", "Esta forma de pagamento não está disponível.", 409);
  }

  const [settingsResult, establishmentResult] = await Promise.all([
    admin
      .from("establishment_settings")
      .select("accept_app_payment")
      .eq("establishment_id", appointment.establishment_id)
      .maybeSingle(),
    admin
      .from("establishments")
      .select("name, status, plans(kind, commission_percent)")
      .eq("id", appointment.establishment_id)
      .maybeSingle(),
  ]);
  if (settingsResult.error || establishmentResult.error || !establishmentResult.data) {
    return fail("lookup_failed", "Não foi possível ler a loja.", 500);
  }
  const establishment = establishmentResult.data as unknown as {
    name: string;
    status: string;
    plans: { kind: "monthly" | "commission"; commission_percent: number | null } | null;
  };
  if (establishment.status !== "active" || !settingsResult.data?.accept_app_payment) {
    return fail("payment_unavailable", "Esta loja recebe direto no estabelecimento.", 409);
  }

  let merchant;
  try {
    merchant = await merchantFor(admin, provider, appointment.establishment_id);
  } catch (error) {
    console.error("payment-create: credenciais", error);
    return fail("lookup_failed", "Não foi possível ler a loja.", 500);
  }
  if (!merchant) {
    return fail("payment_unavailable", "Esta loja recebe direto no estabelecimento.", 409);
  }
  if (!user.email) return fail("email_required", "Sua conta precisa de um e-mail para pagar.", 409);

  const expiresAt = new Date(Date.now() + PIX_TTL_MINUTES * 60_000);

  const { data: inserted, error: insertError } = await admin
    .from("payments")
    .insert({
      appointment_id: appointment.id,
      establishment_id: appointment.establishment_id,
      customer_id: user.id,
      amount_cents: amountCents,
      platform_fee_cents: platformFeeCents(amountCents, establishment.plans),
      status: "pending",
      // Em checkout hospedado só se sabe crédito ou débito depois de pago.
      method: wanted.method === "pix" ? "pix" : null,
      scope: wanted.scope,
      provider: provider.name,
      expires_at: expiresAt.toISOString(),
    })
    .select(PAYMENT_COLUMNS)
    .single();

  if (insertError) {
    // 23505: dois toques em "pagar" ao mesmo tempo. O outro ganhou a corrida.
    if (insertError.code === "23505") {
      return fail("payment_busy", "Pagamento em processamento. Tente em instantes.", 409);
    }
    console.error("payment-create: insert", insertError);
    return fail("insert_failed", "Não foi possível iniciar o pagamento.", 500);
  }
  const row = inserted as unknown as PaymentRow;

  try {
    const charge = await provider.createCharge(merchant, {
      reference: `pay_${row.id}`,
      idempotencyKey: row.id,
      method: wanted.method,
      amountCents,
      platformFeeCents: row.platform_fee_cents,
      description: `${wanted.scope === "full" ? "Reserva" : "Sinal da reserva"} — ${establishment.name}`,
      // O provedor devolve o cliente para o detalhe da reserva, que mostra a
      // situação do pagamento.
      returnUrl: `${(Deno.env.get("CUSTOMER_APP_RETURN_URL") ?? "").trim() || "vezcliente://reserva/"}${appointment.id}`,
      payer: { email: user.email },
      expiresAt,
      notificationUrl: webhookUrl(provider.name),
    });

    const { data: saved, error: saveError } = await admin
      .from("payments")
      .update({
        provider_charge_id: charge.id,
        provider_checkout_id: charge.checkoutId,
        pix_copy_paste: charge.pixCopyPaste,
        checkout_url: charge.checkoutUrl,
        provider_payload: charge.raw,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select(PAYMENT_COLUMNS)
      .single();
    if (saveError) throw new Error(saveError.message);

    return json({ payment: publicPayment(saved as unknown as PaymentRow) }, 201);
  } catch (error) {
    console.error(
      "payment-create: provedor",
      error instanceof ProviderError ? error.detail : error,
    );
    // A linha sai de cena para a próxima tentativa poder criar outra. Se o
    // provedor chegou a criar a cobrança, o código dela nunca foi mostrado a
    // ninguém: expira sozinha, sem ter como ser paga.
    await admin.from("payments").update({ status: "failed" }).eq("id", row.id);
    return fail("provider_failed", "Não foi possível iniciar o pagamento. Tente de novo.", 502);
  }
});
