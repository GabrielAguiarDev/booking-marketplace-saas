import type { Charge, ChargeMethod, ChargeStatus, PaidWith } from "./types.ts";

/**
 * As regras de dinheiro que não dependem de provedor nem de banco.
 *
 * Nada aqui importa Deno nem Supabase: é o que `packages/supabase/test` roda
 * em Node, sem chave e sem rede.
 */

/** Pix expira; depois disso o cliente pede outro. */
export const PIX_TTL_MINUTES = 30;

/** Abaixo disto a tarifa do provedor come a cobrança. */
export const MIN_CHARGE_CENTS = 100;

export type ChargeScope = "deposit" | "full";

/** O que o app pode pedir. Valor desconhecido cai no padrão, não em erro. */
export function parseChargeRequest(body: { method?: unknown; scope?: unknown }): {
  method: ChargeMethod;
  scope: ChargeScope;
} {
  return {
    method: body.method === "card" ? "card" : "pix",
    scope: body.scope === "full" ? "full" : "deposit",
  };
}

/**
 * Quanto cobrar. Os dois valores vêm congelados da reserva — o app escolhe
 * entre eles, nunca o número.
 */
export function chargeAmountCents(
  appointment: { price_cents: number; deposit_cents: number },
  scope: ChargeScope,
): number {
  return scope === "full" ? appointment.price_cents : appointment.deposit_cents;
}

export type PlanForFee = {
  kind: "monthly" | "commission";
  commission_percent: number | string | null;
} | null;

/**
 * A parte da Vez num pagamento feito pelo app.
 *
 * Plano de comissão: o percentual do plano sobre o que passou pelo app. Plano
 * de mensalidade: zero — a loja já paga a fatura do mês. Loja sem plano não
 * paga taxa: quem define plano é o admin, e não é o cliente que deve ser
 * impedido de pagar por isso.
 */
export function platformFeeCents(amountCents: number, plan: PlanForFee): number {
  if (!plan || plan.kind !== "commission") return 0;
  const percent = Number(plan.commission_percent ?? 0);
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * percent) / 100));
}

export type PaymentState = {
  status: ChargeStatus;
  refunded_cents: number;
};

export type PaymentPatch = {
  status: ChargeStatus;
  refunded_cents: number;
  provider_fee_cents?: number;
  paid_at?: string;
  refunded_at?: string;
  method?: PaidWith;
};

// Quanto mais alto, mais "adiante" no ciclo. O provedor pode entregar avisos
// fora de ordem (o "pendente" chegando depois do "pago"); só se anda para a
// frente.
const RANK: Record<ChargeStatus, number> = {
  pending: 0,
  authorized: 1,
  failed: 2,
  cancelled: 2,
  paid: 3,
  partially_refunded: 4,
  refunded: 5,
};

/**
 * O que muda na nossa linha diante do que o provedor respondeu — ou `null` se
 * nada muda. Aplicar a mesma resposta duas vezes dá `null` na segunda: é isso
 * que torna webhook reentregue e conciliação inofensivos.
 */
export function nextPaymentState(
  current: PaymentState,
  charge: Charge,
  now: Date = new Date(),
  options: { hosted?: boolean } = {},
): PaymentPatch | null {
  // Em checkout hospedado, cartão recusado não encerra nada: o cliente tenta
  // outro cartão na mesma página. A cobrança só morre quando a página vence.
  if (options.hosted && charge.status === "failed") return null;

  const refunded = Math.max(current.refunded_cents, charge.refundedCents);
  const forward = RANK[charge.status] > RANK[current.status];
  if (!forward && refunded === current.refunded_cents) return null;

  const status = forward ? charge.status : current.status;
  const patch: PaymentPatch = { status, refunded_cents: refunded };

  if (charge.providerFeeCents !== null) patch.provider_fee_cents = charge.providerFeeCents;
  if (forward && RANK[status] >= RANK.paid) {
    patch.paid_at = charge.paidAt ?? now.toISOString();
    if (charge.paidWith) patch.method = charge.paidWith;
  }
  if (refunded > current.refunded_cents) patch.refunded_at = now.toISOString();
  return patch;
}

/** Quanto ainda falta devolver ao cliente. */
export function refundDueCents(payment: {
  status: ChargeStatus;
  refund_requested_cents: number;
  refunded_cents: number;
}): number {
  if (payment.status !== "paid" && payment.status !== "partially_refunded") return 0;
  return Math.max(0, payment.refund_requested_cents - payment.refunded_cents);
}

// ── assinatura HMAC ─────────────────────────────────────────────────────────

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  return Array.from(await hmac(secret, message), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante: não revela, pelo tempo, quantos caracteres bateram. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...encoder.encode(text)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const fromBase64Url = (text: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0)),
  );

export type ConnectState = { establishmentId: string; userId: string };

/**
 * O `state` do OAuth. Ele volta do provedor pelo navegador do dono, então é
 * assinado: sem isso, qualquer um montaria uma URL de retorno ligando a própria
 * conta de recebimento à loja de outra pessoa.
 */
export async function signConnectState(
  secret: string,
  state: ConnectState,
  ttlSeconds = 900,
  now: Date = new Date(),
): Promise<string> {
  const payload = toBase64Url(
    JSON.stringify({
      e: state.establishmentId,
      u: state.userId,
      x: Math.floor(now.getTime() / 1000) + ttlSeconds,
    }),
  );
  return `${payload}.${await hmacHex(secret, payload)}`;
}

export async function verifyConnectState(
  secret: string,
  token: string,
  now: Date = new Date(),
): Promise<ConnectState | null> {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;
  if (!safeEqual(signature, await hmacHex(secret, payload))) return null;
  try {
    const data = JSON.parse(fromBase64Url(payload)) as { e?: string; u?: string; x?: number };
    if (!data.e || !data.u || typeof data.x !== "number") return null;
    if (data.x < Math.floor(now.getTime() / 1000)) return null;
    return { establishmentId: data.e, userId: data.u };
  } catch {
    return null;
  }
}
