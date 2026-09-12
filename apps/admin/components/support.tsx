"use client";

import { useEffect, useState } from "react";

import { Check, StatusChip } from "./blocks";
import type { Chip } from "./data";
import { FormError, useRun } from "./dialogs";
import {
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  isLate,
  stamp,
  waited,
  type Ticket,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
} from "./model";
import { useAdmin } from "./store";
import {
  AMBER,
  AMBER_SOFT,
  FAINT,
  GREEN,
  GREEN_SOFT,
  MUTED,
  NEUTRAL_SOFT,
  RED,
  RED_SOFT,
} from "./tokens";

export const TICKET_STATUS_CHIP: Record<TicketStatus, Chip> = {
  open: { label: TICKET_STATUS_LABEL.open, fg: AMBER, bg: AMBER_SOFT },
  waiting_customer: { label: TICKET_STATUS_LABEL.waiting_customer, fg: MUTED, bg: NEUTRAL_SOFT },
  resolved: { label: TICKET_STATUS_LABEL.resolved, fg: GREEN, bg: GREEN_SOFT },
};

export const TICKET_PRIORITY_CHIP: Record<TicketPriority, Chip> = {
  high: { label: TICKET_PRIORITY_LABEL.high, fg: RED, bg: RED_SOFT },
  normal: { label: TICKET_PRIORITY_LABEL.normal, fg: MUTED, bg: NEUTRAL_SOFT },
  low: { label: TICKET_PRIORITY_LABEL.low, fg: FAINT, bg: NEUTRAL_SOFT },
};

const STATUS_RANK: Record<TicketStatus, number> = { open: 0, waiting_customer: 1, resolved: 2 };
const PRIORITY_RANK: Record<TicketPriority, number> = { high: 0, normal: 1, low: 2 };
const STATUSES: TicketStatus[] = ["open", "waiting_customer", "resolved"];
const PRIORITIES: TicketPriority[] = ["high", "normal", "low"];

/** Aberto antes, depois aguardando cliente; alta antes; quem espera há mais tempo antes. */
export function byQueue(a: Ticket, b: Ticket): number {
  return (
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.status === "resolved"
      ? (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "")
      : a.waitingSince.localeCompare(b.waitingSince))
  );
}

/** Quanto tempo o chamado está na situação atual, na cor da urgência. */
export function waitTone(ticket: Ticket): string {
  if (ticket.status === "resolved") return GREEN;
  if (ticket.status === "waiting_customer") return FAINT;
  return isLate(ticket.waitingSince) ? RED : AMBER;
}

/** "Barbearia Meia-Nove" ou "Ana Souza · cliente". */
export function requesterText(ticket: Ticket): string {
  return ticket.requesterKind === "establishment"
    ? (ticket.establishment ?? ticket.requesterName)
    : `${ticket.requesterName} · cliente`;
}

type StatusFilter = "queue" | TicketStatus | "all";
type OwnerFilter = "" | "me" | "none";

export function Support({
  focusId,
  onOpenEstablishment,
}: {
  focusId?: string;
  onOpenEstablishment: (id: string) => void;
}) {
  const { data } = useAdmin();
  const focused = data.tickets.find((t) => t.id === focusId);
  // quem chega pela busca ou pela ficha pode estar abrindo um chamado já resolvido
  const [status, setStatus] = useState<StatusFilter>(
    focused?.status === "resolved" ? "all" : "queue",
  );
  const [priority, setPriority] = useState<"" | TicketPriority>("");
  const [owner, setOwner] = useState<OwnerFilter>("");
  const [selected, setSelected] = useState(focusId ?? "");

  if (!data.supportAccess) {
    return (
      <div className="empty-queue">
        <span className="empty-mark neutral">
          <Check />
        </span>
        <strong>Chamados ficam com Suporte e Operações</strong>
        <p>
          O seu papel ({data.me.role}) não lê chamados: a conversa pode ter dados pessoais de
          clientes. Peça a um administrador se precisar acompanhar algum.
        </p>
      </div>
    );
  }

  const queue = data.tickets.slice().sort(byQueue);
  const visible = queue.filter(
    (t) =>
      (status === "all" ||
        (status === "queue" ? t.status !== "resolved" : t.status === status)) &&
      (!priority || t.priority === priority) &&
      (owner === "" || (owner === "me" ? t.assignedTo === data.me.id : t.assignedTo === null)),
  );
  const ticket = visible.find((t) => t.id === selected) ?? visible[0];

  if (data.tickets.length === 0) {
    return (
      <div className="empty-queue">
        <span className="empty-mark">
          <Check />
        </span>
        <strong>Nenhum chamado ainda</strong>
        <p>
          Chamados entram aqui quando uma loja ou um cliente abre um pedido de ajuda. O botão de
          abrir chamado no portal da loja e no app do cliente ainda será ligado.
        </p>
      </div>
    );
  }

  return (
    <div className="reports-grid">
      <div className="stack tight">
        <div className="filter-triple">
          <select
            aria-label="Situação"
            id="ticket-status"
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            value={status}
          >
            <option value="queue">Em andamento</option>
            <option value="open">Abertos</option>
            <option value="waiting_customer">Aguardando cliente</option>
            <option value="resolved">Resolvidos · 90 dias</option>
            <option value="all">Todos</option>
          </select>
          <select
            aria-label="Prioridade"
            id="ticket-priority"
            onChange={(e) => setPriority(e.target.value as "" | TicketPriority)}
            value={priority}
          >
            <option value="">Prioridade</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TICKET_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <select
            aria-label="Responsável"
            id="ticket-owner"
            onChange={(e) => setOwner(e.target.value as OwnerFilter)}
            value={owner}
          >
            <option value="">Responsável</option>
            <option value="me">Comigo</option>
            <option value="none">Sem responsável</option>
          </select>
        </div>

        <div className="card clip">
          <div className="list-head">
            <span>Fila · prioridade e espera</span>
            <code>{visible.length}</code>
          </div>
          {visible.length === 0 ? (
            <p className="table-empty">Nenhum chamado com esses filtros.</p>
          ) : null}
          {visible.map((item) => (
            <button
              className={item.id === ticket?.id ? "report-row active" : "report-row"}
              key={item.id}
              onClick={() => setSelected(item.id)}
              type="button"
            >
              <div className="report-row-top">
                <strong>
                  <code className="ticket-no">#{item.number}</code> {item.subject}
                </strong>
                <code style={{ color: waitTone(item) }}>
                  {waited(item.status === "resolved" ? (item.resolvedAt ?? item.waitingSince) : item.waitingSince)}
                </code>
              </div>
              <div className="ticket-row-mid">
                <small>{requesterText(item)}</small>
                {item.status === "open" ? (
                  <b style={{ color: TICKET_PRIORITY_CHIP[item.priority].fg }}>
                    {item.priority === "high" ? "Prioridade alta" : TICKET_PRIORITY_LABEL[item.priority]}
                  </b>
                ) : (
                  <b style={{ color: TICKET_STATUS_CHIP[item.status].fg }}>
                    {TICKET_STATUS_LABEL[item.status]}
                  </b>
                )}
              </div>
              <p className="report-snippet">
                {item.lastFromStaff ? "Equipe: " : ""}
                {item.preview}
              </p>
            </button>
          ))}
        </div>
      </div>

      {ticket ? (
        <TicketDetail
          key={ticket.id}
          onOpenEstablishment={onOpenEstablishment}
          ticket={ticket}
        />
      ) : (
        <div className="card pad hint">Nenhum chamado com esses filtros.</div>
      )}
    </div>
  );
}

function TicketDetail({
  ticket,
  onOpenEstablishment,
}: {
  ticket: Ticket;
  onOpenEstablishment: (id: string) => void;
}) {
  const { data, actions } = useAdmin();
  const [reply, setReply] = useState("");
  const answer = useRun(() => setReply(""));
  const change = useRun();
  const thread = useThread(ticket);
  const resolved = ticket.status === "resolved";
  const busy = answer.pending || change.pending;

  // Financeiro não atende; convite não aceito ainda não tem conta para trabalhar.
  const agents = data.team.filter(
    (m) => (m.roleKey !== "finance" && !m.pending) || m.id === ticket.assignedTo,
  );

  const send = (next: TicketStatus) =>
    void answer.run(() => actions.replyTicket(ticket.id, reply, next), {
      title: `Resposta registrada no #${ticket.number}`,
      sub:
        next === "resolved"
          ? "O chamado foi marcado como resolvido."
          : "O chamado agora aguarda a resposta de quem abriu.",
    });

  const since =
    ticket.status === "open"
      ? "esperando a equipe há"
      : ticket.status === "waiting_customer"
        ? "aguardando cliente há"
        : "resolvido há";

  return (
    <div className="card ticket-detail">
      <div className="detail-head">
        <div>
          <p className="field-group-label">
            Chamado #{ticket.number} ·{" "}
            {ticket.requesterKind === "establishment" ? "aberto pela loja" : "aberto por cliente"}
          </p>
          <div className="title-row">
            <h2 className="report-title">{ticket.subject}</h2>
          </div>
          <p className="detail-sub">
            {TICKET_CATEGORY_LABEL[ticket.category]} · aberto em {stamp(ticket.createdAt)} · {since}{" "}
            <code>
              {waited(resolved ? (ticket.resolvedAt ?? ticket.waitingSince) : ticket.waitingSince)}
            </code>
          </p>
        </div>
        <div className="actions">
          <StatusChip chip={TICKET_STATUS_CHIP[ticket.status]} />
          <StatusChip chip={TICKET_PRIORITY_CHIP[ticket.priority]} />
        </div>
      </div>

      <div className="report-body">
        <div className="report-main">
          <section>
            <p className="field-group-label">Conversa</p>
            <FormError message={thread.error} />
            {thread.messages === null ? (
              <p className="hint">Carregando a conversa…</p>
            ) : (
              <div className="thread">
                {thread.messages.map((message) => (
                  <div className={message.fromStaff ? "msg staff" : "msg"} key={message.id}>
                    <div className="msg-head">
                      <strong>{message.author}</strong>
                      <small>
                        {message.fromStaff
                          ? "equipe Vez"
                          : ticket.requesterKind === "establishment"
                            ? "loja"
                            : "cliente"}{" "}
                        · {stamp(message.at)}
                      </small>
                    </div>
                    <p>{message.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="last">
            <label className="field-group-label" htmlFor="ticket-reply">
              Responder
            </label>
            <textarea
              id="ticket-reply"
              maxLength={4000}
              onChange={(event) => setReply(event.target.value)}
              placeholder={
                resolved
                  ? "Responder reabre a conversa com a sua mensagem"
                  : "Escreva a resposta para quem abriu o chamado"
              }
              value={reply}
            />
            <FormError message={answer.error} />
            <div className="reply-actions">
              <p className="hint">
                O app do cliente mostra a conversa em Perfil › Ajuda, mas ninguém é avisado por
                e-mail ou push — a pessoa só lê quando abrir o app. O portal da loja ainda não
                mostra nada. Se for urgente, use o contato ao lado.
              </p>
              <button
                className="ghost"
                disabled={busy || !reply.trim()}
                onClick={() => send("resolved")}
                type="button"
              >
                Responder e resolver
              </button>
              <button
                className="primary"
                disabled={busy || !reply.trim()}
                onClick={() => send("waiting_customer")}
                type="button"
              >
                {answer.pending ? "Enviando…" : "Responder"}
              </button>
            </div>
          </section>
        </div>

        <div className="report-aside">
          <div className="aside-block">
            <p className="field-group-label">Situação</p>
            <div className="choice-group" role="group" aria-label="Situação">
              {STATUSES.map((s) => (
                <button
                  aria-pressed={ticket.status === s}
                  className={ticket.status === s ? "choice on" : "choice"}
                  disabled={busy}
                  key={s}
                  onClick={() =>
                    ticket.status !== s &&
                    void change.run(() => actions.setTicketStatus(ticket.id, s), {
                      title: `#${ticket.number}: ${TICKET_STATUS_LABEL[s].toLowerCase()}`,
                      sub:
                        s === "resolved"
                          ? "Saiu da fila. Uma nova mensagem de quem abriu reabre o chamado."
                          : s === "open"
                            ? "Voltou para a fila da equipe."
                            : "Fica fora da fila até quem abriu responder.",
                    })
                  }
                  type="button"
                >
                  {TICKET_STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            <p className="field-group-label spaced">Prioridade</p>
            <div className="choice-group" role="group" aria-label="Prioridade">
              {PRIORITIES.map((p) => (
                <button
                  aria-pressed={ticket.priority === p}
                  className={ticket.priority === p ? "choice on" : "choice"}
                  disabled={busy || resolved}
                  key={p}
                  onClick={() =>
                    ticket.priority !== p &&
                    void change.run(() => actions.setTicketPriority(ticket.id, p), {
                      title: `#${ticket.number}: prioridade ${TICKET_PRIORITY_LABEL[p].toLowerCase()}`,
                      sub: "A fila foi reordenada.",
                    })
                  }
                  title={resolved ? "Reabra o chamado para mudar a prioridade" : undefined}
                  type="button"
                >
                  {TICKET_PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>

            <label className="field-group-label spaced" htmlFor="ticket-assignee">
              Responsável
            </label>
            <div className="assign-row">
              <select
                disabled={busy}
                id="ticket-assignee"
                onChange={(event) => {
                  const next = event.target.value || null;
                  const person = agents.find((m) => m.id === next);
                  void change.run(() => actions.assignTicket(ticket.id, next), {
                    title: person ? `#${ticket.number} com ${person.name}` : "Atribuição retirada",
                    sub: person
                      ? "O chamado aparece em “Comigo” para essa pessoa."
                      : "O chamado volta para “Sem responsável”.",
                  });
                }}
                value={ticket.assignedTo ?? ""}
              >
                <option value="">Ninguém</option>
                {agents.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {ticket.assignedTo !== data.me.id && data.me.roleKey !== "finance" ? (
                <button
                  className="ghost small"
                  disabled={busy}
                  onClick={() =>
                    void change.run(() => actions.assignTicket(ticket.id, data.me.id), {
                      title: `#${ticket.number} com você`,
                      sub: "O chamado aparece em “Comigo”.",
                    })
                  }
                  type="button"
                >
                  Assumir
                </button>
              ) : null}
            </div>
            <FormError message={change.error} />
          </div>

          <div className="aside-block">
            <p className="field-group-label">Quem abriu</p>
            <div className="field-list">
              <div>
                <small>{ticket.requesterKind === "establishment" ? "Pela loja" : "Cliente"}</small>
                <p>{ticket.requesterName}</p>
              </div>
              <div>
                <small>E-mail da conta</small>
                <code>{ticket.requesterEmail || "—"}</code>
              </div>
              {ticket.establishment ? (
                <div>
                  <small>
                    {ticket.requesterKind === "establishment" ? "Estabelecimento" : "Fala da loja"}
                  </small>
                  <p>{ticket.establishment}</p>
                </div>
              ) : null}
            </div>
            {ticket.establishmentId ? (
              <button
                className="ghost full"
                onClick={() => onOpenEstablishment(ticket.establishmentId!)}
                type="button"
              >
                Abrir ficha da loja
              </button>
            ) : null}
          </div>

          <div className="aside-block">
            <p className="field-group-label">Tempos</p>
            <div className="field-list">
              <div>
                <small>Aberto em</small>
                <code>{stamp(ticket.createdAt)}</code>
              </div>
              <div>
                <small>Primeira resposta</small>
                <code>{ticket.firstResponseAt ? stamp(ticket.firstResponseAt) : "ainda não"}</code>
              </div>
              {ticket.resolvedAt ? (
                <div>
                  <small>Resolvido em</small>
                  <code>{stamp(ticket.resolvedAt)}</code>
                </div>
              ) : null}
              <div>
                <small>Mensagens</small>
                <code>{ticket.messages}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A conversa vem sob demanda. A chave muda quando chega mensagem nova (o
 * snapshot traz a contagem e a hora da última), e aí a conversa é relida.
 */
function useThread(ticket: Ticket) {
  const { actions } = useAdmin();
  const key = `${ticket.id}:${ticket.messages}:${ticket.lastMessageAt}`;
  const [state, setState] = useState<{
    key: string;
    messages: TicketMessage[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let live = true;
    actions.ticketMessages(ticket.id).then(
      (messages) => {
        if (live) setState({ key, messages, error: null });
      },
      (cause: unknown) => {
        if (live)
          setState({
            key,
            messages: [],
            error: cause instanceof Error ? cause.message : "A conversa não carregou.",
          });
      },
    );
    return () => {
      live = false;
    };
  }, [actions, key, ticket.id]);

  // Enquanto relê, mostra a versão anterior do mesmo chamado em vez de piscar.
  const shown = state && state.key.startsWith(`${ticket.id}:`) ? state : null;
  return { messages: shown?.messages ?? null, error: shown?.error ?? null };
}
