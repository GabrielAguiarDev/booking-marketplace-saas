/**
 * Regras de quando o cliente pode remarcar ou cancelar, espelhando o banco.
 *
 * Quem decide de verdade é `customer_reschedule_appointment()` (migration
 * `20260917120000_cliente_conta.sql`) e a Edge Function `cancel-appointment`.
 * Esta cópia só existe para a tela não oferecer um botão que o servidor vai
 * recusar — e para explicar o porquê antes do toque.
 *
 * Módulo puro (sem React Native) para rodar nos testes com `node --test`.
 */

export type ActiveStatus = "scheduled" | "confirmed";

export type RescheduleCheck =
  | { ok: true; deadline: Date }
  | { ok: false; reason: "not_active" | "past" | "outside_window"; deadline: Date | null };

const ACTIVE: readonly string[] = ["scheduled", "confirmed"];

/** Pode remarcar enquanto faltar pelo menos a janela sem custo da loja. */
export function rescheduleCheck(
  appointment: { status: string; starts_at: string },
  cancellationWindowMinutes: number,
  now: Date = new Date(),
): RescheduleCheck {
  const start = new Date(appointment.starts_at);
  const deadline = new Date(start.getTime() - cancellationWindowMinutes * 60_000);

  if (!ACTIVE.includes(appointment.status))
    return { ok: false, reason: "not_active", deadline: null };
  if (start.getTime() <= now.getTime()) return { ok: false, reason: "past", deadline: null };
  if (now.getTime() > deadline.getTime()) return { ok: false, reason: "outside_window", deadline };
  return { ok: true, deadline };
}

/** Cancelar sem custo: mesma janela. Fora dela o cancelamento acontece, mas marcado. */
export function cancelIsFree(
  appointment: { starts_at: string },
  cancellationWindowMinutes: number,
  now: Date = new Date(),
): boolean {
  const minutesUntil = (new Date(appointment.starts_at).getTime() - now.getTime()) / 60_000;
  return minutesUntil >= cancellationWindowMinutes;
}

/** "2 h", "30 min", "1 dia". Para frases como "até 2 h antes". */
export function windowLabel(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const d = minutes / 1440;
    return d === 1 ? "1 dia" : `${d} dias`;
  }
  if (minutes >= 60) return `${Math.round(minutes / 60)} h`;
  return `${minutes} min`;
}

/**
 * Mensagem para cada código estável que a RPC devolve em `hint`.
 * Código desconhecido cai na mensagem do servidor, e sem ela no genérico.
 */
export const RESCHEDULE_ERRORS: Record<string, string> = {
  unauthorized: "Entre de novo para remarcar.",
  not_found: "Reserva não encontrada.",
  not_reschedulable: "Esta reserva não pode mais ser remarcada.",
  customer_blocked: "Sua conta está bloqueada para novos horários. Fale com o suporte.",
  establishment_unavailable: "Esta loja não está disponível agora.",
  outside_window: "O prazo para remarcar já passou. Fale com a loja ou cancele.",
  invalid_date: "Escolha um horário futuro.",
  same_slot: "Esse já é o horário da sua reserva.",
  slot_unavailable: "Esse horário não está mais livre. Escolha outro.",
  slot_taken: "Alguém acabou de reservar esse horário. Escolha outro.",
};

/** Códigos em que a grade de horários precisa ser recarregada. */
export const RESCHEDULE_REFRESH_SLOTS = new Set(["slot_unavailable", "slot_taken", "same_slot"]);

export function rescheduleMessage(code: string | null | undefined, fallback?: string): string {
  return (
    (code && RESCHEDULE_ERRORS[code]) || fallback || "Não foi possível remarcar. Tente de novo."
  );
}
