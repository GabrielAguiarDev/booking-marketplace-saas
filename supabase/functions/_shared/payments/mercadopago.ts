import { hmacHex, safeEqual } from "./core.ts";
import {
  type Charge,
  type ChargeStatus,
  type ConnectedAccount,
  type CreateChargeInput,
  type Merchant,
  type PaidWith,
  type PaymentProvider,
  ProviderError,
  type WebhookEvent,
  type WebhookRequest,
} from "./types.ts";

/**
 * Adaptador do Mercado Pago (API de Pagamentos + OAuth de marketplace).
 *
 * Tudo o que é específico do Mercado Pago mora neste arquivo: reais com
 * centavos em vez de inteiros, `application_fee` como nome do split, o formato
 * do `x-signature`. Fora daqui, ninguém sabe que provedor é.
 *
 * Split: a cobrança é criada com o token da LOJA (obtido no OAuth) e
 * `application_fee` com a parte da Vez. O dinheiro cai na conta da loja; a taxa
 * cai na conta da Vez. Sem token de loja (`merchant` nulo), a cobrança é da
 * própria Vez — é o caso da mensalidade.
 */

export type MercadoPagoConfig = {
  /** Token da conta da Vez. */
  accessToken: string;
  /** Credenciais da aplicação, para o OAuth das lojas. */
  clientId: string;
  clientSecret: string;
  /** Assinatura secreta dos webhooks, do painel da aplicação. */
  webhookSecret: string;
  apiUrl?: string;
  authUrl?: string;
  fetch?: typeof fetch;
};

type MpPreference = {
  id: string;
  init_point?: string | null;
  external_reference?: string | null;
};

type MpPayment = {
  id: number | string;
  status: string;
  payment_type_id?: string | null;
  transaction_amount: number;
  transaction_amount_refunded?: number | null;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  external_reference?: string | null;
  fee_details?: { type?: string; amount?: number }[] | null;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string | null; ticket_url?: string | null } | null;
  } | null;
};

type MpToken = {
  access_token: string;
  refresh_token?: string | null;
  user_id: number | string;
  expires_in?: number | null;
};

const toCents = (amount: number | null | undefined) => Math.round((amount ?? 0) * 100);
const toAmount = (cents: number) => Number((cents / 100).toFixed(2));

const STATUS: Record<string, ChargeStatus> = {
  pending: "pending",
  in_process: "pending",
  authorized: "authorized",
  approved: "paid",
  // Em disputa o dinheiro ainda está com a loja; só o desfecho muda o estado.
  in_mediation: "paid",
  refunded: "refunded",
  charged_back: "refunded",
  cancelled: "cancelled",
  rejected: "failed",
};

const PAID_WITH: Record<string, PaidWith> = {
  bank_transfer: "pix",
  credit_card: "credit_card",
  debit_card: "debit_card",
  prepaid_card: "debit_card",
};

export function chargeFromMercadoPago(payment: MpPayment): Charge {
  const amountCents = toCents(payment.transaction_amount);
  let status = STATUS[payment.status] ?? "pending";
  let refundedCents = toCents(payment.transaction_amount_refunded);
  if (status === "refunded") refundedCents = amountCents;
  // Estorno parcial não muda o `status` do Mercado Pago: continua "approved".
  if (status === "paid" && refundedCents > 0) {
    status = refundedCents >= amountCents ? "refunded" : "partially_refunded";
  }

  const fees = (payment.fee_details ?? []).filter((fee) => fee.type === "mercadopago_fee");
  const data = payment.point_of_interaction?.transaction_data;

  return {
    id: String(payment.id),
    checkoutId: null,
    paidWith:
      PAID_WITH[payment.payment_type_id ?? ""] ?? (payment.payment_type_id ? "other" : null),
    status,
    amountCents,
    refundedCents,
    providerFeeCents: fees.length ? fees.reduce((sum, fee) => sum + toCents(fee.amount), 0) : null,
    paidAt: payment.date_approved ?? null,
    expiresAt: payment.date_of_expiration ?? null,
    pixCopyPaste: data?.qr_code ?? null,
    checkoutUrl: data?.ticket_url ?? null,
    reference: payment.external_reference ?? null,
    raw: payment,
  };
}

export function createMercadoPago(config: MercadoPagoConfig): PaymentProvider {
  const apiUrl = config.apiUrl ?? "https://api.mercadopago.com";
  const authUrl = config.authUrl ?? "https://auth.mercadopago.com.br";
  const doFetch = config.fetch ?? fetch;

  async function call<T>(
    path: string,
    init: { method: string; token: string; body?: unknown; idempotencyKey?: string },
  ): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(`${apiUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${init.token}`,
          "Content-Type": "application/json",
          ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (error) {
      throw new ProviderError("unavailable", "Mercado Pago inacessível.", String(error));
    }

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (response.ok) return parsed as T;
    const code =
      response.status === 401 || response.status === 403
        ? "unauthorized"
        : response.status === 404
          ? "not_found"
          : response.status >= 500 || response.status === 429
            ? "unavailable"
            : "rejected";
    throw new ProviderError(code, `Mercado Pago respondeu ${response.status}.`, parsed);
  }

  const tokenOf = (merchant: Merchant) => merchant?.accessToken ?? config.accessToken;

  async function token(body: Record<string, string>): Promise<ConnectedAccount> {
    const data = await call<MpToken>("/oauth/token", {
      method: "POST",
      token: config.accessToken,
      body: { client_id: config.clientId, client_secret: config.clientSecret, ...body },
    });
    return {
      externalAccountId: String(data.user_id),
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  return {
    name: "mercadopago",
    methods: ["pix", "card"],

    async createCharge(merchant, input: CreateChargeInput) {
      if (input.method === "card") {
        // Checkout Pro: a página é do Mercado Pago, e o número do cartão nunca
        // passa por nós. Pix e boleto ficam de fora dela — Pix tem o caminho
        // próprio, sem sair do app, e boleto não compensa a tempo de uma reserva.
        const preference = await call<MpPreference>("/checkout/preferences", {
          method: "POST",
          token: tokenOf(merchant),
          body: {
            items: [
              {
                title: input.description,
                quantity: 1,
                currency_id: "BRL",
                unit_price: toAmount(input.amountCents),
              },
            ],
            payer: { email: input.payer.email },
            external_reference: input.reference,
            notification_url: input.notificationUrl,
            expires: true,
            expiration_date_to: input.expiresAt.toISOString(),
            // Aprovado ou recusado na hora; sem "em análise" segurando o horário.
            binary_mode: true,
            payment_methods: {
              excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }],
              installments: 1,
            },
            ...(input.returnUrl
              ? {
                  back_urls: {
                    success: input.returnUrl,
                    pending: input.returnUrl,
                    failure: input.returnUrl,
                  },
                  auto_return: "approved",
                }
              : {}),
            ...(merchant && input.platformFeeCents > 0
              ? { marketplace_fee: toAmount(input.platformFeeCents) }
              : {}),
          },
        });
        return {
          id: null,
          checkoutId: preference.id,
          paidWith: null,
          status: "pending",
          amountCents: input.amountCents,
          refundedCents: 0,
          providerFeeCents: null,
          paidAt: null,
          expiresAt: input.expiresAt.toISOString(),
          pixCopyPaste: null,
          checkoutUrl: preference.init_point ?? null,
          reference: input.reference,
          raw: preference,
        };
      }
      if (input.method !== "pix") {
        throw new ProviderError("unsupported", `Método ${input.method} ainda não ligado.`);
      }
      const payment = await call<MpPayment>("/v1/payments", {
        method: "POST",
        token: tokenOf(merchant),
        idempotencyKey: input.idempotencyKey,
        body: {
          transaction_amount: toAmount(input.amountCents),
          description: input.description,
          payment_method_id: "pix",
          external_reference: input.reference,
          notification_url: input.notificationUrl,
          date_of_expiration: input.expiresAt.toISOString(),
          payer: {
            email: input.payer.email,
            ...(input.payer.name ? { first_name: input.payer.name } : {}),
          },
          // Só existe em cobrança feita com token de loja.
          ...(merchant && input.platformFeeCents > 0
            ? { application_fee: toAmount(input.platformFeeCents) }
            : {}),
        },
      });
      return chargeFromMercadoPago(payment);
    },

    async getCharge(merchant, chargeId) {
      return chargeFromMercadoPago(
        await call<MpPayment>(`/v1/payments/${encodeURIComponent(chargeId)}`, {
          method: "GET",
          token: tokenOf(merchant),
        }),
      );
    },

    async cancelCharge(merchant, chargeId) {
      const path = `/v1/payments/${encodeURIComponent(chargeId)}`;
      try {
        return chargeFromMercadoPago(
          await call<MpPayment>(path, {
            method: "PUT",
            token: tokenOf(merchant),
            body: { status: "cancelled" },
          }),
        );
      } catch (error) {
        // Recusou cancelar: quase sempre porque já foi paga ou já expirou.
        // Quem chamou precisa do estado real, não do erro.
        if (error instanceof ProviderError && error.code === "rejected") {
          return this.getCharge(merchant, chargeId);
        }
        throw error;
      }
    },

    async findCharge(merchant, reference) {
      const query = new URLSearchParams({
        external_reference: reference,
        sort: "date_created",
        criteria: "desc",
      });
      const found = await call<{ results?: MpPayment[] }>(`/v1/payments/search?${query}`, {
        method: "GET",
        token: tokenOf(merchant),
      });
      const charges = (found.results ?? []).map(chargeFromMercadoPago);
      const settled = charges.find((charge) =>
        ["paid", "partially_refunded", "refunded"].includes(charge.status),
      );
      return settled ?? charges[0] ?? null;
    },

    async cancelCheckout(merchant, checkoutId) {
      // Não existe "cancelar preferência": vence-se a página agora.
      await call<unknown>(`/checkout/preferences/${encodeURIComponent(checkoutId)}`, {
        method: "PUT",
        token: tokenOf(merchant),
        body: { expires: true, expiration_date_to: new Date().toISOString() },
      });
    },

    async refund(merchant, chargeId, amountCents, idempotencyKey) {
      await call<unknown>(`/v1/payments/${encodeURIComponent(chargeId)}/refunds`, {
        method: "POST",
        token: tokenOf(merchant),
        idempotencyKey,
        body: { amount: toAmount(amountCents) },
      });
      return this.getCharge(merchant, chargeId);
    },

    async verifyWebhook(request: WebhookRequest): Promise<WebhookEvent> {
      const url = new URL(request.url);
      let body: {
        id?: number | string;
        type?: string;
        action?: string;
        user_id?: number | string;
        data?: { id?: number | string };
      } = {};
      try {
        body = request.body ? JSON.parse(request.body) : {};
      } catch {
        throw new ProviderError("invalid_signature", "Corpo do webhook ilegível.");
      }

      const dataId = url.searchParams.get("data.id") ?? String(body.data?.id ?? "");
      const parts = new Map(
        (request.headers.get("x-signature") ?? "").split(",").map((part) => {
          const [key, ...value] = part.trim().split("=");
          return [key ?? "", value.join("=")] as const;
        }),
      );
      const ts = parts.get("ts");
      const v1 = parts.get("v1");
      if (!ts || !v1) throw new ProviderError("invalid_signature", "Webhook sem assinatura.");

      // O manifesto é o do Mercado Pago, na ordem dele; partes ausentes somem.
      const requestId = request.headers.get("x-request-id");
      const manifest =
        (dataId ? `id:${dataId.toLowerCase()};` : "") +
        (requestId ? `request-id:${requestId};` : "") +
        `ts:${ts};`;
      if (!safeEqual(v1, await hmacHex(config.webhookSecret, manifest))) {
        throw new ProviderError("invalid_signature", "Assinatura do webhook não confere.");
      }

      const type = body.type ?? url.searchParams.get("type");
      const eventId = body.id ? String(body.id) : null;
      if (type !== "payment" || !dataId) return { kind: "ignored", eventId };
      return {
        kind: "charge",
        // Sem id de notificação, o par cobrança+ação identifica o evento.
        eventId: eventId ?? `${dataId}:${body.action ?? "payment"}`,
        chargeId: dataId,
        accountId: body.user_id ? String(body.user_id) : null,
      };
    },

    authorizeUrl(state, redirectUri) {
      const query = new URLSearchParams({
        client_id: config.clientId,
        response_type: "code",
        platform_id: "mp",
        state,
        redirect_uri: redirectUri,
      });
      return `${authUrl}/authorization?${query}`;
    },

    exchangeCode(code, redirectUri) {
      return token({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
    },

    refreshAccount(refreshToken) {
      return token({ grant_type: "refresh_token", refresh_token: refreshToken });
    },
  };
}
