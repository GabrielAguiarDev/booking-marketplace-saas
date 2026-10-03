import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { nextPaymentState } from "./core.ts";
import { createMercadoPago } from "./mercadopago.ts";
import type { Charge, ChargeStatus, Merchant, PaidWith, PaymentProvider } from "./types.ts";

/**
 * Onde o contrato de provedor encontra o ambiente e o banco.
 *
 * Trocar de provedor é: escrever o adaptador, registrá-lo em `BUILDERS` e mudar
 * o secret `PAYMENT_PROVIDER`. Cobranças novas nascem no provedor novo; as
 * antigas continuam sendo consultadas e estornadas pelo adaptador de quem as
 * criou, porque cada linha guarda o próprio `provider`.
 */

const env = (name: string) => (Deno.env.get(name) ?? "").trim();

const BUILDERS: Record<string, () => PaymentProvider | null> = {
  mercadopago: () => {
    const accessToken = env("MERCADOPAGO_ACCESS_TOKEN");
    const clientId = env("MERCADOPAGO_CLIENT_ID");
    const clientSecret = env("MERCADOPAGO_CLIENT_SECRET");
    const webhookSecret = env("MERCADOPAGO_WEBHOOK_SECRET");
    if (!accessToken || !clientId || !clientSecret || !webhookSecret) return null;
    return createMercadoPago({ accessToken, clientId, clientSecret, webhookSecret });
  },
};

export const activeProviderName = () => env("PAYMENT_PROVIDER").toLowerCase() || "mercadopago";

/** `null` quando o provedor não existe ou não está configurado por secret. */
export function providerByName(name: string): PaymentProvider | null {
  return BUILDERS[name]?.() ?? null;
}

export const activeProvider = () => providerByName(activeProviderName());

export const functionUrl = (name: string) => `${env("SUPABASE_URL")}/functions/v1/${name}`;

export const webhookUrl = (provider: string) =>
  `${functionUrl("payment-webhook")}?provider=${encodeURIComponent(provider)}`;

// Token de loja vencendo em menos disto é renovado antes do uso.
const REFRESH_AHEAD_MS = 7 * 86_400_000;

/**
 * A conta da loja no provedor, com token válido — ou `null` se a loja não
 * conectou. Renova o token quando ele está perto de vencer.
 */
export async function merchantFor(
  admin: SupabaseClient,
  provider: PaymentProvider,
  establishmentId: string,
): Promise<Merchant> {
  const { data, error } = await admin.rpc("payment_account_credentials", {
    p_establishment_id: establishmentId,
    p_provider: provider.name,
  });
  if (error) throw new Error(`payment_account_credentials: ${error.message}`);

  const row = (data ?? [])[0] as
    | {
        external_account_id: string;
        access_token: string | null;
        refresh_token: string | null;
        token_expires_at: string | null;
      }
    | undefined;
  if (!row?.access_token) return null;

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : null;
  if (expiresAt !== null && expiresAt - Date.now() < REFRESH_AHEAD_MS && row.refresh_token) {
    try {
      const fresh = await provider.refreshAccount(row.refresh_token);
      const { error: storeError } = await admin.rpc("payment_account_store", {
        p_establishment_id: establishmentId,
        p_provider: provider.name,
        p_external_account_id: fresh.externalAccountId,
        p_access_token: fresh.accessToken,
        p_refresh_token: fresh.refreshToken,
        p_token_expires_at: fresh.expiresAt?.toISOString() ?? null,
        p_connected_by: null,
      });
      if (storeError) throw new Error(storeError.message);
      return { externalAccountId: fresh.externalAccountId, accessToken: fresh.accessToken };
    } catch (error) {
      // Enquanto o token antigo valer, segue com ele; a próxima chamada tenta
      // renovar de novo.
      console.error("payments: renovação de token falhou", establishmentId, error);
      if (expiresAt <= Date.now()) return null;
    }
  }

  return { externalAccountId: row.external_account_id, accessToken: row.access_token };
}

export type PaymentRow = {
  id: string;
  appointment_id: string;
  establishment_id: string;
  customer_id: string;
  amount_cents: number;
  refunded_cents: number;
  refund_requested_cents: number;
  platform_fee_cents: number;
  status: ChargeStatus;
  provider: string | null;
  provider_charge_id: string | null;
  provider_checkout_id: string | null;
  method: PaidWith | "cash" | null;
  scope: "deposit" | "full";
  pix_copy_paste: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
};

export const PAYMENT_COLUMNS =
  "id, appointment_id, establishment_id, customer_id, amount_cents, refunded_cents," +
  " refund_requested_cents, platform_fee_cents, status, provider, provider_charge_id," +
  " provider_checkout_id, method, scope, pix_copy_paste, checkout_url, expires_at, paid_at";

/** O que o app do cliente recebe. Nada do provedor além do necessário para pagar. */
export function publicPayment(row: PaymentRow) {
  return {
    id: row.id,
    appointment_id: row.appointment_id,
    status: row.status,
    amount_cents: row.amount_cents,
    refunded_cents: row.refunded_cents,
    scope: row.scope,
    // Enquanto espera, o que importa é por onde se paga: página ou código.
    method: row.provider_checkout_id ? "card" : "pix",
    pix_copy_paste: row.status === "pending" ? row.pix_copy_paste : null,
    checkout_url: row.status === "pending" ? row.checkout_url : null,
    expires_at: row.expires_at,
    paid_at: row.paid_at,
  };
}

/**
 * Aplica à nossa linha o que o provedor respondeu. Idempotente: a mesma
 * resposta aplicada duas vezes não escreve nada na segunda.
 */
export async function applyCharge(
  admin: SupabaseClient,
  payment: PaymentRow,
  charge: Charge,
): Promise<PaymentRow> {
  const patch = nextPaymentState(payment, charge, new Date(), {
    hosted: payment.provider_checkout_id !== null,
  });
  // Checkout hospedado: a cobrança apareceu agora. Guardar o id dela mesmo sem
  // mudança de estado é o que faz o próximo webhook achar a linha direto.
  const attach =
    charge.id && !payment.provider_charge_id ? { provider_charge_id: charge.id } : null;
  if (!patch) {
    if (!attach) return payment;
    const { data: attached, error: attachError } = await admin
      .from("payments")
      .update(attach)
      .eq("id", payment.id)
      .select(PAYMENT_COLUMNS)
      .maybeSingle();
    if (attachError) throw new Error(`payments attach: ${attachError.message}`);
    return (attached as PaymentRow | null) ?? payment;
  }

  const justPaid = payment.status !== "paid" && patch.status === "paid";
  let refundRequested: number | undefined;
  if (justPaid) {
    // Pago depois de a reserva ter sido cancelada (o Pix estava na mão do
    // cliente): o dinheiro volta inteiro.
    const { data: appointment } = await admin
      .from("appointments")
      .select("status")
      .eq("id", payment.appointment_id)
      .maybeSingle();
    if (appointment && !["scheduled", "confirmed", "completed"].includes(appointment.status)) {
      refundRequested = payment.amount_cents;
    }
  }

  const { data, error } = await admin
    .from("payments")
    .update({
      ...patch,
      ...attach,
      provider_payload: charge.raw,
      last_synced_at: refundRequested === undefined ? new Date().toISOString() : null,
      ...(refundRequested === undefined ? {} : { refund_requested_cents: refundRequested }),
    })
    .eq("id", payment.id)
    // Outra execução pode ter andado com a linha; nesse caso não se escreve
    // por cima — quem chegou primeiro leu do mesmo provedor.
    .eq("status", payment.status)
    .select(PAYMENT_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`payments update: ${error.message}`);
  return (data as PaymentRow | null) ?? payment;
}

/**
 * O estado da cobrança no provedor, por onde der para achá-la: pelo id, ou —
 * em checkout hospedado ainda sem id — pela nossa referência. `null` quando o
 * cliente ainda não pagou nada na página.
 */
export function chargeOf(
  provider: PaymentProvider,
  merchant: Merchant,
  payment: PaymentRow,
): Promise<Charge | null> {
  return payment.provider_charge_id
    ? provider.getCharge(merchant, payment.provider_charge_id)
    : provider.findCharge(merchant, `pay_${payment.id}`);
}

/**
 * Encerra no provedor uma cobrança que ainda espera pagamento e devolve a linha
 * como ficou. Se o cliente pagou no meio do caminho, a linha volta paga.
 */
export async function closePending(
  admin: SupabaseClient,
  provider: PaymentProvider,
  merchant: Merchant,
  payment: PaymentRow,
): Promise<PaymentRow> {
  if (payment.provider_charge_id) {
    const charge = await provider.cancelCharge(merchant, payment.provider_charge_id);
    return applyCharge(admin, payment, charge);
  }
  if (payment.provider_checkout_id) {
    await provider.cancelCheckout(merchant, payment.provider_checkout_id);
    // Pode ter sido paga instantes antes de a página fechar.
    const charge = await provider.findCharge(merchant, `pay_${payment.id}`);
    if (charge && charge.status !== "failed" && charge.status !== "pending") {
      return applyCharge(admin, payment, charge);
    }
  }
  const { data, error } = await admin
    .from("payments")
    .update({ status: "cancelled", last_synced_at: new Date().toISOString() })
    .eq("id", payment.id)
    .eq("status", payment.status)
    .select(PAYMENT_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`payments close: ${error.message}`);
  return (data as PaymentRow | null) ?? payment;
}

/** Marca a fatura como paga a partir do que o provedor respondeu. */
export async function applyInvoiceCharge(
  admin: SupabaseClient,
  invoiceId: string,
  charge: Charge,
): Promise<void> {
  if (charge.status !== "paid") return;
  const { error } = await admin
    .from("billing_invoices")
    .update({
      status: "paid",
      paid_at: charge.paidAt ?? new Date().toISOString(),
      provider_payload: charge.raw,
      pix_copy_paste: null,
    })
    .eq("id", invoiceId)
    .eq("status", "open");
  if (error) throw new Error(`billing_invoices update: ${error.message}`);
}
