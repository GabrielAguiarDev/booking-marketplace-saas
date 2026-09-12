import { supabase } from "../../lib/supabase";
import { useAsync } from "@vez/mobile-kit/async";

/**
 * Chamados de ajuda do cliente.
 *
 * Abrir e responder são RPCs do suporte (`open_support_ticket`,
 * `reply_support_ticket`); ler é `customer_support_tickets` e
 * `customer_support_ticket_messages`, que devolvem só o que é da pessoa — sem
 * prioridade, atribuição nem o nome de quem da equipe respondeu (a equipe
 * assina como "Equipe Vez"). A equipe atende pela tela Suporte do admin.
 *
 * Não há notificação: a resposta só aparece quando o app lê de novo. As telas
 * recarregam sempre que ganham foco, e é isso que elas prometem ao usuário —
 * nada de "avisamos você", que hoje seria mentira.
 */

export type TicketCategory = "account" | "billing" | "booking" | "payment" | "technical" | "other";
export type TicketStatus = "open" | "waiting_customer" | "resolved";

/** O que o cliente escolhe ao abrir. `billing` é assinatura da loja: fica de fora. */
export const TICKET_CATEGORIES: { key: TicketCategory; label: string }[] = [
  { key: "booking", label: "Reserva" },
  { key: "payment", label: "Pagamento" },
  { key: "account", label: "Minha conta" },
  { key: "technical", label: "Problema no app" },
  { key: "other", label: "Outro assunto" },
];

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  booking: "Reserva",
  payment: "Pagamento",
  account: "Minha conta",
  technical: "Problema no app",
  billing: "Cobrança",
  other: "Outro assunto",
};

export type Ticket = {
  id: string;
  number: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  establishmentId: string | null;
  establishmentName: string | null;
  createdAt: string;
  lastMessageAt: string;
  lastMessageFromStaff: boolean;
  preview: string;
};

export type TicketMessage = {
  id: string;
  fromStaff: boolean;
  authorName: string;
  body: string;
  createdAt: string;
};

type TicketRow = {
  id: string;
  number: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  establishment_id: string | null;
  establishment_name: string | null;
  created_at: string;
  last_message_at: string;
  last_message_from_staff: boolean;
  preview: string;
};

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    number: row.number,
    subject: row.subject,
    category: row.category,
    status: row.status,
    establishmentId: row.establishment_id,
    establishmentName: row.establishment_name,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    lastMessageFromStaff: row.last_message_from_staff,
    preview: row.preview,
  };
}

/** Os chamados da pessoa: primeiro os que esperam resposta dela. */
export function useMyTickets(enabled: boolean) {
  return useAsync(
    "support-tickets",
    async () => {
      const { data, error } = await supabase.rpc("customer_support_tickets");
      if (error) throw new Error(error.message);
      return ((data ?? []) as TicketRow[]).map(toTicket);
    },
    { enabled },
  );
}

/** Um chamado e a conversa inteira. Nulo quando não é da pessoa ou não existe. */
export function useTicketThread(ticketId: string | null) {
  return useAsync(
    `support-thread:${ticketId}`,
    async () => {
      const [ticket, messages] = await Promise.all([
        supabase.rpc("customer_support_tickets", { p_ticket_id: ticketId! }),
        supabase.rpc("customer_support_ticket_messages", { p_ticket_id: ticketId! }),
      ]);
      if (ticket.error) throw new Error(ticket.error.message);
      const row = (ticket.data ?? [])[0] as TicketRow | undefined;
      if (!row) return null;
      if (messages.error) throw new Error(messages.error.message);

      return {
        ticket: toTicket(row),
        messages: (messages.data ?? []).map((m) => ({
          id: m.id,
          fromStaff: m.from_staff,
          authorName: m.author_name,
          body: m.body,
          createdAt: m.created_at,
        })) satisfies TicketMessage[],
      };
    },
    { enabled: Boolean(ticketId) },
  );
}

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * O banco valida e responde em português (`P0001`: assunto curto, mensagem
 * vazia, limite de chamados abertos). Fora isso, é rede ou sessão.
 */
function failure(error: { code?: string; message: string }, fallback: string): Result<never> {
  return { ok: false, message: error.code === "P0001" ? error.message : fallback };
}

export async function openTicket(input: {
  subject: string;
  body: string;
  category: TicketCategory;
  establishmentId: string | null;
}): Promise<Result<{ id: string; number: number }>> {
  const { data, error } = await supabase.rpc("open_support_ticket", {
    p_subject: input.subject,
    p_body: input.body,
    p_category: input.category,
    ...(input.establishmentId ? { p_establishment_id: input.establishmentId } : {}),
  });
  if (error) return failure(error, "Não foi possível abrir o chamado. Tente de novo.");
  const row = (data ?? [])[0];
  if (!row) return { ok: false, message: "Não foi possível abrir o chamado. Tente de novo." };
  return { ok: true, value: row };
}

export async function replyTicket(ticketId: string, body: string): Promise<Result<null>> {
  const { error } = await supabase.rpc("reply_support_ticket", {
    p_ticket_id: ticketId,
    p_body: body,
  });
  if (error) return failure(error, "Não foi possível enviar. Tente de novo.");
  return { ok: true, value: null };
}

/** De quem é a vez de falar, dito para o cliente. */
export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "COM A EQUIPE",
  waiting_customer: "ESPERANDO VOCÊ",
  resolved: "RESOLVIDO",
};

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "HOJE · 14:20" no mesmo dia, "12 SET · 14:20" antes disso. */
export function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hour = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (sameDay) return `HOJE · ${hour}`;
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} · ${hour}`;
}
