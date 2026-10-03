import { supabase } from "../../lib/supabase";
import { useAsync } from "@vez/mobile-kit/async";
import { readErrorBody } from "./appointments";

export type PaymentStatus =
  "pending" | "authorized" | "paid" | "partially_refunded" | "refunded" | "failed" | "cancelled";

/** Quanto: só o sinal, ou o valor inteiro da reserva. */
export type PaymentScope = "deposit" | "full";
/** Por onde: código Pix, ou a página de cartão do provedor. */
export type PaymentMethod = "pix" | "card";

export type DepositPayment = {
  id: string;
  appointment_id: string;
  status: PaymentStatus;
  amount_cents: number;
  refunded_cents: number;
  scope: PaymentScope;
  method: PaymentMethod;
  /** Página de pagamento do provedor; só vem enquanto a cobrança espera. */
  checkout_url: string | null;
  /** Só vem enquanto a cobrança espera pagamento. */
  pix_copy_paste: string | null;
  expires_at: string | null;
  paid_at: string | null;
};

const COLUMNS =
  "id, appointment_id, status, amount_cents, refunded_cents, scope, provider_checkout_id, checkout_url, pix_copy_paste, expires_at, paid_at";

/** Cobrança que ainda vale: esperando pagamento, paga, ou paga com devolução parcial. */
const LIVE: PaymentStatus[] = ["pending", "authorized", "paid", "partially_refunded"];

/**
 * A loja cobra o sinal pelo app? Quem responde é o banco
 * (`establishment_accepts_app_payment`): a loja precisa ter sinal configurado,
 * pagamento pelo app ligado e conta de recebimento conectada.
 *
 * Erro vira "não": na dúvida, a tela diz que o pagamento é no estabelecimento,
 * que é o que acontece de fato quando a cobrança pelo app não está disponível.
 */
export function useAcceptsAppPayment(establishmentId: string | null) {
  return useAsync(
    `accepts-app-payment:${establishmentId}`,
    async () => {
      const { data, error } = await supabase.rpc("establishment_accepts_app_payment", {
        p_establishment_id: establishmentId!,
      });
      return !error && data === true;
    },
    { enabled: establishmentId !== null },
  );
}

/**
 * O sinal de uma reserva, lido direto do banco (a RLS só devolve o do próprio
 * cliente). É a leitura barata, usada para acompanhar: não fala com o provedor.
 */
export async function readDepositPayment(appointmentId: string): Promise<DepositPayment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select(COLUMNS)
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { provider_checkout_id, ...row } = data;
  const waiting = row.status === "pending" || row.status === "authorized";
  return {
    ...row,
    scope: row.scope as PaymentScope,
    method: provider_checkout_id ? "card" : "pix",
    checkout_url: waiting ? row.checkout_url : null,
    pix_copy_paste: waiting ? row.pix_copy_paste : null,
  };
}

export function useDepositPayment(appointmentId: string | null) {
  return useAsync(`deposit-payment:${appointmentId}`, () => readDepositPayment(appointmentId!), {
    enabled: appointmentId !== null,
  });
}

export const isLivePayment = (payment: DepositPayment | null) =>
  payment !== null && LIVE.includes(payment.status);

export type DepositResult =
  { ok: true; payment: DepositPayment } | { ok: false; code: string; message: string };

/**
 * Pede a cobrança de uma reserva — ou confere a que já existe. A Edge Function
 * decide o valor, quem recebe e a taxa; o app escolhe só entre sinal e valor
 * inteiro, e entre Pix e cartão.
 *
 * Sem `options` é a pergunta "já paguei?": com cobrança viva, ela consulta o
 * provedor e devolve a mesma. Com `options` diferentes da cobrança que espera,
 * a anterior é encerrada e nasce outra.
 */
export async function requestDepositPayment(
  appointmentId: string,
  options?: { method: PaymentMethod; scope: PaymentScope },
): Promise<DepositResult> {
  const { data, error } = await supabase.functions.invoke("payment-create", {
    body: { appointment_id: appointmentId, ...options },
  });

  if (error) {
    const body = await readErrorBody(error);
    return {
      ok: false,
      code: body?.code ?? "network",
      message: body?.message ?? "Não foi possível iniciar o pagamento.",
    };
  }
  return { ok: true, payment: (data as { payment: DepositPayment }).payment };
}
