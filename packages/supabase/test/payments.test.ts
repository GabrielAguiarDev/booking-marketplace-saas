import assert from "node:assert/strict";
import { test } from "node:test";

import {
  chargeAmountCents,
  hmacHex,
  nextPaymentState,
  parseChargeRequest,
  platformFeeCents,
  refundDueCents,
  signConnectState,
  verifyConnectState,
} from "../../../supabase/functions/_shared/payments/core.ts";
import {
  chargeFromMercadoPago,
  createMercadoPago,
} from "../../../supabase/functions/_shared/payments/mercadopago.ts";
import { type Charge, ProviderError } from "../../../supabase/functions/_shared/payments/types.ts";

/**
 * As regras de dinheiro e o adaptador do Mercado Pago, sem chave e sem rede.
 *
 * O provedor aqui é um `fetch` roteirizado: cada teste diz o que a API
 * responderia e confere o que o adaptador mandou.
 */

const charge = (over: Partial<Charge>): Charge => ({
  id: "123",
  checkoutId: null,
  paidWith: null,
  status: "pending",
  amountCents: 3000,
  refundedCents: 0,
  providerFeeCents: null,
  paidAt: null,
  expiresAt: null,
  pixCopyPaste: null,
  checkoutUrl: null,
  reference: null,
  raw: {},
  ...over,
});

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function roteiro(responses: { status?: number; body: unknown }[]) {
  const calls: Call[] = [];
  const fake = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const next = responses.shift();
    assert.ok(next, "o adaptador chamou a API mais vezes do que o roteiro previa");
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  }) as typeof fetch;
  return { calls, fake };
}

const mp = (fake: typeof fetch) =>
  createMercadoPago({
    accessToken: "token-da-vez",
    clientId: "app-1",
    clientSecret: "segredo-app",
    webhookSecret: "segredo-webhook",
    fetch: fake,
  });

// ── taxa da plataforma ──────────────────────────────────────────────────────

test("taxa: comissão incide sobre o que passou pelo app; mensalidade não paga", () => {
  assert.equal(platformFeeCents(3000, { kind: "commission", commission_percent: 12 }), 360);
  // O Postgres devolve numeric como texto.
  assert.equal(platformFeeCents(1999, { kind: "commission", commission_percent: "12.50" }), 250);
  assert.equal(platformFeeCents(3000, { kind: "monthly", commission_percent: null }), 0);
  assert.equal(platformFeeCents(3000, null), 0);
  assert.equal(platformFeeCents(100, { kind: "commission", commission_percent: 100 }), 100);
});

test("pedido: o app escolhe método e escopo, nunca o valor", () => {
  assert.deepEqual(parseChargeRequest({}), { method: "pix", scope: "deposit" });
  assert.deepEqual(parseChargeRequest({ method: "card", scope: "full" }), {
    method: "card",
    scope: "full",
  });
  // Valor desconhecido cai no padrão — inclusive `wallet`, que ninguém implementa.
  assert.deepEqual(parseChargeRequest({ method: "wallet", scope: 9999 }), {
    method: "pix",
    scope: "deposit",
  });
  const appointment = { price_cents: 6000, deposit_cents: 1800 };
  assert.equal(chargeAmountCents(appointment, "deposit"), 1800);
  assert.equal(chargeAmountCents(appointment, "full"), 6000);
});

// ── transições ──────────────────────────────────────────────────────────────

test("estado: pago anda para a frente e registra tarifa e data", () => {
  const patch = nextPaymentState(
    { status: "pending", refunded_cents: 0 },
    charge({ status: "paid", providerFeeCents: 30, paidAt: "2026-10-03T12:00:00Z" }),
  );
  assert.deepEqual(patch, {
    status: "paid",
    refunded_cents: 0,
    provider_fee_cents: 30,
    paid_at: "2026-10-03T12:00:00Z",
  });
});

test("estado: aviso atrasado ou repetido não desfaz nem reescreve", () => {
  const paid = { status: "paid" as const, refunded_cents: 0 };
  assert.equal(nextPaymentState(paid, charge({ status: "pending" })), null);
  assert.equal(nextPaymentState(paid, charge({ status: "cancelled" })), null);
  assert.equal(nextPaymentState(paid, charge({ status: "paid" })), null);
});

test("estado: estorno parcial e total", () => {
  const now = new Date("2026-10-03T15:00:00Z");
  assert.deepEqual(
    nextPaymentState(
      { status: "paid", refunded_cents: 0 },
      charge({ status: "partially_refunded", refundedCents: 1000 }),
      now,
    ),
    {
      status: "partially_refunded",
      refunded_cents: 1000,
      paid_at: now.toISOString(),
      refunded_at: now.toISOString(),
    },
  );
  const total = nextPaymentState(
    { status: "partially_refunded", refunded_cents: 1000 },
    charge({ status: "refunded", refundedCents: 3000 }),
    now,
  );
  assert.equal(total?.status, "refunded");
  assert.equal(total?.refunded_cents, 3000);
});

test("estado: em checkout hospedado, cartão recusado não encerra a cobrança", () => {
  const pending = { status: "pending" as const, refunded_cents: 0 };
  assert.equal(
    nextPaymentState(pending, charge({ status: "failed" }), new Date(), { hosted: true }),
    null,
  );
  // Fora do checkout hospedado, recusa é recusa.
  assert.equal(nextPaymentState(pending, charge({ status: "failed" }))?.status, "failed");
  // E a tentativa seguinte, aprovada, anda — levando o método que o provedor informou.
  const paid = nextPaymentState(
    pending,
    charge({ status: "paid", paidWith: "credit_card", paidAt: "2026-10-03T12:00:00Z" }),
    new Date(),
    { hosted: true },
  );
  assert.equal(paid?.status, "paid");
  assert.equal(paid?.method, "credit_card");
});

test("estorno devido: só para pagamento pago, e só a diferença", () => {
  const base = { refund_requested_cents: 3000, refunded_cents: 1000 };
  assert.equal(refundDueCents({ status: "partially_refunded", ...base }), 2000);
  assert.equal(refundDueCents({ status: "pending", ...base }), 0);
  assert.equal(refundDueCents({ status: "paid", refund_requested_cents: 0, refunded_cents: 0 }), 0);
});

// ── state do OAuth ──────────────────────────────────────────────────────────

test("state: volta íntegro, e recusa adulteração, outro segredo e prazo vencido", async () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const state = { establishmentId: "loja-1", userId: "dono-1" };
  const token = await signConnectState("segredo", state, 900, now);

  assert.deepEqual(await verifyConnectState("segredo", token, now), state);
  assert.equal(await verifyConnectState("outro", token, now), null);
  assert.equal(await verifyConnectState("segredo", `x${token}`, now), null);
  assert.equal(await verifyConnectState("segredo", token, new Date(now.getTime() + 901_000)), null);
  // Trocar a loja no corpo invalida a assinatura.
  const forged = btoa(JSON.stringify({ e: "loja-2", u: "dono-1", x: 9_999_999_999 }));
  assert.equal(await verifyConnectState("segredo", `${forged}.${token.split(".")[1]}`, now), null);
});

// ── Mercado Pago ────────────────────────────────────────────────────────────

test("mercado pago: tradução de estado, centavos, tarifa e estorno parcial", () => {
  const paid = chargeFromMercadoPago({
    id: 987,
    status: "approved",
    transaction_amount: 30,
    transaction_amount_refunded: 0,
    date_approved: "2026-10-03T12:00:00Z",
    external_reference: "pay_abc",
    fee_details: [
      { type: "mercadopago_fee", amount: 0.3 },
      { type: "application_fee", amount: 3.6 },
    ],
  });
  assert.equal(paid.id, "987");
  assert.equal(paid.status, "paid");
  assert.equal(paid.amountCents, 3000);
  assert.equal(paid.providerFeeCents, 30);
  assert.equal(paid.reference, "pay_abc");

  assert.equal(
    chargeFromMercadoPago({
      id: 1,
      status: "approved",
      transaction_amount: 30,
      transaction_amount_refunded: 10,
    }).status,
    "partially_refunded",
  );
  const refunded = chargeFromMercadoPago({ id: 1, status: "refunded", transaction_amount: 19.99 });
  assert.equal(refunded.refundedCents, 1999);
  assert.equal(
    chargeFromMercadoPago({ id: 1, status: "rejected", transaction_amount: 1 }).status,
    "failed",
  );
});

test("mercado pago: Pix com split usa o token da loja e application_fee", async () => {
  const { calls, fake } = roteiro([
    {
      status: 201,
      body: {
        id: 555,
        status: "pending",
        transaction_amount: 30,
        point_of_interaction: { transaction_data: { qr_code: "00020126…" } },
      },
    },
  ]);
  const created = await mp(fake).createCharge(
    { externalAccountId: "loja-mp", accessToken: "token-da-loja" },
    {
      reference: "pay_abc",
      idempotencyKey: "abc",
      method: "pix",
      amountCents: 3000,
      platformFeeCents: 360,
      description: "Sinal",
      payer: { email: "cliente@vez.local" },
      expiresAt: new Date("2026-10-03T12:30:00Z"),
      notificationUrl: "https://vez.test/functions/v1/payment-webhook?provider=mercadopago",
    },
  );

  assert.equal(created.pixCopyPaste, "00020126…");
  const call = calls[0]!;
  assert.equal(call.url, "https://api.mercadopago.com/v1/payments");
  assert.equal(call.headers.Authorization, "Bearer token-da-loja");
  assert.equal(call.headers["X-Idempotency-Key"], "abc");
  assert.deepEqual(call.body, {
    transaction_amount: 30,
    description: "Sinal",
    payment_method_id: "pix",
    external_reference: "pay_abc",
    notification_url: "https://vez.test/functions/v1/payment-webhook?provider=mercadopago",
    date_of_expiration: "2026-10-03T12:30:00.000Z",
    payer: { email: "cliente@vez.local" },
    application_fee: 3.6,
  });
});

test("mercado pago: cartão vira checkout hospedado, com split e sem Pix nem boleto", async () => {
  const { calls, fake } = roteiro([
    { status: 201, body: { id: "pref-1", init_point: "https://mp.test/checkout/pref-1" } },
  ]);
  const created = await mp(fake).createCharge(
    { externalAccountId: "loja-mp", accessToken: "token-da-loja" },
    {
      reference: "pay_abc",
      idempotencyKey: "abc",
      method: "card",
      amountCents: 6000,
      platformFeeCents: 720,
      description: "Reserva",
      payer: { email: "cliente@vez.local" },
      expiresAt: new Date("2026-10-03T12:30:00Z"),
      notificationUrl: "https://vez.test/hook",
      returnUrl: "vezcliente://reserva/r1",
    },
  );

  // Não há cobrança ainda: só a página.
  assert.equal(created.id, null);
  assert.equal(created.checkoutId, "pref-1");
  assert.equal(created.checkoutUrl, "https://mp.test/checkout/pref-1");
  assert.equal(created.status, "pending");

  const call = calls[0]!;
  assert.equal(call.url, "https://api.mercadopago.com/checkout/preferences");
  assert.equal(call.headers.Authorization, "Bearer token-da-loja");
  const body = call.body as Record<string, unknown>;
  assert.deepEqual(body.items, [
    { title: "Reserva", quantity: 1, currency_id: "BRL", unit_price: 60 },
  ]);
  assert.equal(body.marketplace_fee, 7.2);
  assert.equal(body.external_reference, "pay_abc");
  assert.equal(body.binary_mode, true);
  assert.deepEqual(body.payment_methods, {
    excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }],
    installments: 1,
  });
  assert.deepEqual(body.back_urls, {
    success: "vezcliente://reserva/r1",
    pending: "vezcliente://reserva/r1",
    failure: "vezcliente://reserva/r1",
  });
});

test("mercado pago: acha a cobrança pela referência e prefere a aprovada", async () => {
  const { calls, fake } = roteiro([
    {
      body: {
        results: [
          { id: 3, status: "rejected", transaction_amount: 60, payment_type_id: "credit_card" },
          { id: 2, status: "approved", transaction_amount: 60, payment_type_id: "debit_card" },
        ],
      },
    },
    { body: { results: [] } },
  ]);
  const provider = mp(fake);
  const found = await provider.findCharge(null, "pay_abc");
  assert.equal(found?.id, "2");
  assert.equal(found?.status, "paid");
  assert.equal(found?.paidWith, "debit_card");
  assert.match(calls[0]!.url, /\/v1\/payments\/search\?external_reference=pay_abc/);
  assert.equal(await provider.findCharge(null, "pay_nada"), null);
});

test("mercado pago: fechar o checkout vence a página", async () => {
  const { calls, fake } = roteiro([{ body: { id: "pref-1" } }]);
  await mp(fake).cancelCheckout(null, "pref-1");
  assert.equal(calls[0]!.method, "PUT");
  assert.equal(calls[0]!.url, "https://api.mercadopago.com/checkout/preferences/pref-1");
  assert.equal((calls[0]!.body as { expires: boolean }).expires, true);
});

test("mercado pago: cobrança da própria Vez usa o token da Vez e não tem split", async () => {
  const { calls, fake } = roteiro([
    { status: 201, body: { id: 1, status: "pending", transaction_amount: 149 } },
  ]);
  await mp(fake).createCharge(null, {
    reference: "inv_1",
    idempotencyKey: "inv_1_a",
    method: "pix",
    amountCents: 14900,
    // Mesmo que alguém passe taxa, sem loja não existe split.
    platformFeeCents: 500,
    description: "Mensalidade",
    payer: { email: "dono@vez.local" },
    expiresAt: new Date("2026-10-03T12:30:00Z"),
    notificationUrl: "https://vez.test/hook",
  });
  assert.equal(calls[0]!.headers.Authorization, "Bearer token-da-vez");
  assert.equal("application_fee" in (calls[0]!.body as object), false);
});

test("mercado pago: método não ligado e erro da API viram ProviderError com código", async () => {
  const input = {
    reference: "pay_1",
    idempotencyKey: "1",
    amountCents: 3000,
    platformFeeCents: 0,
    description: "Sinal",
    payer: { email: "c@vez.local" },
    expiresAt: new Date(),
    notificationUrl: "https://vez.test/hook",
  };
  await assert.rejects(
    mp(roteiro([]).fake).createCharge(null, { ...input, method: "wallet" }),
    (error) => error instanceof ProviderError && error.code === "unsupported",
  );
  await assert.rejects(
    mp(roteiro([{ status: 401, body: { message: "invalid token" } }]).fake).getCharge(null, "1"),
    (error) => error instanceof ProviderError && error.code === "unauthorized",
  );
  await assert.rejects(
    mp(roteiro([{ status: 503, body: {} }]).fake).getCharge(null, "1"),
    (error) => error instanceof ProviderError && error.code === "unavailable",
  );
});

test("mercado pago: cancelar cobrança já paga devolve o estado real", async () => {
  const { fake } = roteiro([
    { status: 400, body: { message: "cannot cancel" } },
    { body: { id: 1, status: "approved", transaction_amount: 30 } },
  ]);
  assert.equal((await mp(fake).cancelCharge(null, "1")).status, "paid");
});

test("mercado pago: estorno manda o valor em reais e a chave de idempotência", async () => {
  const { calls, fake } = roteiro([
    { status: 201, body: { id: 9 } },
    { body: { id: 1, status: "refunded", transaction_amount: 30 } },
  ]);
  const result = await mp(fake).refund(null, "1", 3000, "refund_x_3000");
  assert.equal(result.status, "refunded");
  assert.equal(calls[0]!.url, "https://api.mercadopago.com/v1/payments/1/refunds");
  assert.equal(calls[0]!.headers["X-Idempotency-Key"], "refund_x_3000");
  assert.deepEqual(calls[0]!.body, { amount: 30 });
});

test("mercado pago: webhook só passa com a assinatura certa", async () => {
  const provider = mp(roteiro([]).fake);
  const url =
    "https://vez.test/functions/v1/payment-webhook?provider=mercadopago&data.id=555&type=payment";
  const body = JSON.stringify({
    id: 42,
    type: "payment",
    action: "payment.updated",
    user_id: 77,
    data: { id: "555" },
  });
  const v1 = await hmacHex("segredo-webhook", "id:555;request-id:req-1;ts:1700000000;");
  const headers = (signature: string) =>
    new Headers({ "x-signature": signature, "x-request-id": "req-1" });

  assert.deepEqual(
    await provider.verifyWebhook({ url, body, headers: headers(`ts=1700000000,v1=${v1}`) }),
    {
      kind: "charge",
      eventId: "42",
      chargeId: "555",
      accountId: "77",
    },
  );

  for (const bad of [`ts=1700000001,v1=${v1}`, `ts=1700000000,v1=${"0".repeat(64)}`, ""]) {
    await assert.rejects(
      provider.verifyWebhook({ url, body, headers: headers(bad) }),
      (error) => error instanceof ProviderError && error.code === "invalid_signature",
    );
  }
  // Mesma assinatura, outra cobrança na URL: o id faz parte do que é assinado.
  await assert.rejects(
    provider.verifyWebhook({
      url: url.replace("data.id=555", "data.id=556"),
      body,
      headers: headers(`ts=1700000000,v1=${v1}`),
    }),
    (error) => error instanceof ProviderError && error.code === "invalid_signature",
  );
});

test("mercado pago: aviso assinado de outro assunto é ignorado", async () => {
  const provider = mp(roteiro([]).fake);
  const v1 = await hmacHex("segredo-webhook", "id:9;request-id:req-2;ts:1;");
  const event = await provider.verifyWebhook({
    url: "https://vez.test/hook?data.id=9&type=merchant_order",
    body: JSON.stringify({ id: 5, type: "merchant_order", data: { id: "9" } }),
    headers: new Headers({ "x-signature": `ts=1,v1=${v1}`, "x-request-id": "req-2" }),
  });
  assert.deepEqual(event, { kind: "ignored", eventId: "5" });
});

test("mercado pago: OAuth monta a URL e troca o código por conta conectada", async () => {
  const { calls, fake } = roteiro([
    {
      body: {
        access_token: "tok-loja",
        refresh_token: "ref-loja",
        user_id: 77,
        expires_in: 15_552_000,
      },
    },
  ]);
  const provider = mp(fake);

  const url = new URL(
    provider.authorizeUrl("estado", "https://vez.test/functions/v1/payment-connect"),
  );
  assert.equal(url.origin, "https://auth.mercadopago.com.br");
  assert.equal(url.searchParams.get("client_id"), "app-1");
  assert.equal(url.searchParams.get("state"), "estado");

  const account = await provider.exchangeCode(
    "codigo",
    "https://vez.test/functions/v1/payment-connect",
  );
  assert.equal(account.externalAccountId, "77");
  assert.equal(account.accessToken, "tok-loja");
  assert.equal(account.refreshToken, "ref-loja");
  assert.ok(account.expiresAt && account.expiresAt.getTime() > Date.now());
  assert.deepEqual(calls[0]!.body, {
    client_id: "app-1",
    client_secret: "segredo-app",
    grant_type: "authorization_code",
    code: "codigo",
    redirect_uri: "https://vez.test/functions/v1/payment-connect",
  });
});
