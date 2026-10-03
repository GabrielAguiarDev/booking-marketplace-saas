/**
 * O contrato entre a Vez e qualquer provedor de pagamento.
 *
 * Tudo o que as funções `payment-*` e `billing-*` sabem sobre um provedor está
 * nesta interface. Ela é deliberadamente pequena: só entra aqui o que TODO
 * provedor brasileiro sério oferece — criar cobrança, consultar, cancelar,
 * estornar, validar webhook e conectar a conta do lojista. Assinatura
 * recorrente, carteira de cliente e relatório ficam de fora: o ciclo é do
 * nosso banco (`billing_invoices`), justamente para que trocar de provedor
 * seja escrever um arquivo como `mercadopago.ts`, e não migrar dados.
 *
 * Dinheiro é sempre inteiro em centavos. Quem converte para a unidade do
 * provedor é o adaptador.
 */

/** Espelha o enum `payment_status` do banco. */
export type ChargeStatus =
  "pending" | "authorized" | "paid" | "partially_refunded" | "refunded" | "failed" | "cancelled";

/**
 * Como o cliente paga.
 *
 *   pix     código copia e cola; a cobrança nasce na hora
 *   card    checkout hospedado do provedor (cartão de crédito, débito e o que
 *           mais a página dele aceitar); a cobrança só nasce quando o cliente
 *           paga lá
 *   wallet  Apple Pay / Google Pay nativos. Nenhum adaptador implementa hoje
 *           (ver decisão 0009); existe no tipo para o que implementar não
 *           precisar mexer em quem chama.
 */
export type ChargeMethod = "pix" | "card" | "wallet";

/**
 * De quem é a conta que recebe. `null` é a conta da própria Vez (mensalidade);
 * com valor, é a conta do estabelecimento (sinal de reserva, com split).
 */
export type Merchant = {
  externalAccountId: string;
  accessToken: string;
} | null;

export type CreateChargeInput = {
  /** Nosso identificador (`pay_<uuid>` ou `inv_<uuid>`), devolvido pelo provedor. */
  reference: string;
  /** Repetir a chamada com a mesma chave não pode criar segunda cobrança. */
  idempotencyKey: string;
  method: ChargeMethod;
  amountCents: number;
  /** A parte da Vez, retida na origem. Só faz sentido com `merchant`. */
  platformFeeCents: number;
  description: string;
  payer: { email: string; name?: string | null };
  expiresAt: Date;
  notificationUrl: string;
  /** Checkout hospedado: para onde o provedor devolve o cliente ao terminar. */
  returnUrl?: string;
};

/** O método como o banco guarda (`payment_method`), quando o provedor informa. */
export type PaidWith = "pix" | "credit_card" | "debit_card" | "other";

export type Charge = {
  /** Nulo em checkout hospedado que ainda não foi pago: não há cobrança. */
  id: string | null;
  /** Identificador da página de checkout, quando o método usa uma. */
  checkoutId: string | null;
  paidWith: PaidWith | null;
  status: ChargeStatus;
  amountCents: number;
  refundedCents: number;
  /** Tarifa do provedor; nula enquanto ele não informar. */
  providerFeeCents: number | null;
  paidAt: string | null;
  expiresAt: string | null;
  pixCopyPaste: string | null;
  checkoutUrl: string | null;
  reference: string | null;
  /** Resposta crua, para auditoria quando o número não bater. */
  raw: unknown;
};

export type WebhookRequest = {
  url: string;
  headers: Headers;
  body: string;
};

export type WebhookEvent =
  /** Aviso sobre uma cobrança. O conteúdo NÃO é confiável: consulte a cobrança. */
  | { kind: "charge"; eventId: string; chargeId: string; accountId: string | null }
  /** Assinatura válida, mas de um assunto que não nos interessa. */
  | { kind: "ignored"; eventId: string | null };

export type ConnectedAccount = {
  externalAccountId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
};

export interface PaymentProvider {
  readonly name: string;
  readonly methods: readonly ChargeMethod[];

  createCharge(merchant: Merchant, input: CreateChargeInput): Promise<Charge>;
  getCharge(merchant: Merchant, chargeId: string): Promise<Charge>;
  /** Cancela cobrança ainda não paga. */
  cancelCharge(merchant: Merchant, chargeId: string): Promise<Charge>;
  /**
   * Checkout hospedado: a cobrança que nasceu daquela referência, se alguma.
   * Havendo mais de uma tentativa, vale a aprovada; senão, a mais recente.
   */
  findCharge(merchant: Merchant, reference: string): Promise<Charge | null>;
  /** Checkout hospedado: fecha a página para ela não poder mais ser paga. */
  cancelCheckout(merchant: Merchant, checkoutId: string): Promise<void>;
  refund(
    merchant: Merchant,
    chargeId: string,
    amountCents: number,
    idempotencyKey: string,
  ): Promise<Charge>;

  /** Lança `ProviderError("invalid_signature")` se a assinatura não fechar. */
  verifyWebhook(request: WebhookRequest): Promise<WebhookEvent>;

  /** Conexão da conta do lojista (OAuth). */
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<ConnectedAccount>;
  refreshAccount(refreshToken: string): Promise<ConnectedAccount>;
}

export type ProviderErrorCode =
  "invalid_signature" | "unauthorized" | "not_found" | "rejected" | "unavailable" | "unsupported";

/** Erro com código estável; a mensagem do provedor fica só no log. */
export class ProviderError extends Error {
  // Campos declarados à mão: os testes rodam em Node só removendo os tipos, e
  // propriedade de parâmetro não sobrevive a isso.
  readonly code: ProviderErrorCode;
  readonly detail: unknown;

  constructor(code: ProviderErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.detail = detail;
  }
}
