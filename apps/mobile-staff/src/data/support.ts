import { useAsync } from "@vez/mobile-kit/async";
import { hourMinute } from "@vez/mobile-kit/format";
import type { Database } from "@vez/supabase/types";

import { supabase } from "../../lib/supabase";

/**
 * Chamados da loja com a equipe da plataforma.
 *
 * Abrir e responder são as RPCs públicas do suporte (`open_support_ticket`,
 * `reply_support_ticket`); ler é consulta direta, porque a política
 * `support_tickets_select_member` já diz exatamente o que a loja pode ver:
 * chamado aberto em nome dela, por qualquer membro. Chamado que um cliente
 * abriu falando da loja não aparece aqui — e é de propósito.
 *
 * Quem responde pela equipe assina como "Equipe Vez": o nome de quem atendeu é
 * assunto interno do admin, e a loja fala com a plataforma, não com uma pessoa.
 *
 * Não há notificação: a resposta aparece quando o app lê de novo.
 */

export type TicketCategory = Database["public"]["Enums"]["support_ticket_category"];
export type TicketStatus = Database["public"]["Enums"]["support_ticket_status"];

/** O que a loja escolhe ao abrir. */
export const TICKET_CATEGORIES: { key: TicketCategory; label: string }[] = [
  { key: "booking", label: "Agenda e fila" },
  { key: "billing", label: "Plano e cobrança" },
  { key: "payment", label: "Pagamento de cliente" },
  { key: "account", label: "Conta e acesso" },
  { key: "technical", label: "Problema no app" },
  { key: "other", label: "Outro assunto" },
];

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  booking: "Agenda e fila",
  billing: "Plano e cobrança",
  payment: "Pagamento de cliente",
  account: "Conta e acesso",
  technical: "Problema no app",
  other: "Outro assunto",
};

/** De quem é a vez de falar, dito para a loja. */
export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "COM A EQUIPE",
  waiting_customer: "ESPERANDO VOCÊ",
  resolved: "RESOLVIDO",
};

export type Ticket = {
  id: string;
  number: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  createdAt: string;
  lastMessageAt: string;
  lastMessageFromStaff: boolean;
};

export type TicketMessage = {
  id: string;
  fromStaff: boolean;
  authorName: string;
  body: string;
  createdAt: string;
};

const COLUMNS =
  "id, number, subject, category, status, created_at, last_message_at, last_message_from_staff";

type Row = {
  id: string;
  number: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  created_at: string;
  last_message_at: string;
  last_message_from_staff: boolean;
};

function toTicket(row: Row): Ticket {
  return {
    id: row.id,
    number: row.number,
    subject: row.subject,
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    lastMessageFromStaff: row.last_message_from_staff,
  };
}

/** Os chamados da loja, do mais recente para o mais antigo. */
export function useTickets(establishmentId: string | null) {
  return useAsync(
    `tickets:${establishmentId}`,
    async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(COLUMNS)
        .eq("establishment_id", establishmentId!)
        .eq("requester_kind", "establishment")
        .order("last_message_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Row[]).map(toTicket);
    },
    { enabled: Boolean(establishmentId) },
  );
}

/** Um chamado e a conversa inteira. Nulo quando não é da loja ou não existe. */
export function useTicketThread(ticketId: string | null) {
  return useAsync(
    `ticket:${ticketId}`,
    async () => {
      const [ticket, messages] = await Promise.all([
        supabase.from("support_tickets").select(COLUMNS).eq("id", ticketId!).maybeSingle(),
        supabase
          .from("support_ticket_messages")
          .select("id, from_staff, author_name, body, created_at")
          .eq("ticket_id", ticketId!)
          .order("created_at"),
      ]);
      if (ticket.error) throw new Error(ticket.error.message);
      if (!ticket.data) return null;
      if (messages.error) throw new Error(messages.error.message);

      return {
        ticket: toTicket(ticket.data as Row),
        messages: (messages.data ?? []).map<TicketMessage>((message) => ({
          id: message.id,
          fromStaff: message.from_staff,
          // A equipe é uma só para quem está do lado de fora.
          authorName: message.from_staff ? "Equipe Vez" : message.author_name,
          body: message.body,
          createdAt: message.created_at,
        })),
      };
    },
    { enabled: Boolean(ticketId) },
  );
}

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * O banco valida e responde em português (`P0001`: assunto curto, mensagem
 * vazia, limite de cinco chamados em andamento). Fora isso, é rede ou sessão.
 */
function failure(error: { code?: string; message: string }, fallback: string): Result<never> {
  return { ok: false, message: error.code === "P0001" ? error.message : fallback };
}

export async function openTicket(input: {
  subject: string;
  body: string;
  category: TicketCategory;
  establishmentId: string;
}): Promise<Result<{ id: string; number: number }>> {
  const { data, error } = await supabase.rpc("open_support_ticket", {
    p_subject: input.subject,
    p_body: input.body,
    p_category: input.category,
    p_establishment_id: input.establishmentId,
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

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "HOJE · 14:20" no mesmo dia, "12 SET · 14:20" antes disso. */
export function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const hour = hourMinute(date);
  return sameDay
    ? `HOJE · ${hour}`
    : `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} · ${hour}`;
}
