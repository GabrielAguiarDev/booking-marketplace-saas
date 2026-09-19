"use client";

/**
 * Quem preencheu o formulário da landing. Não é uma solicitação de cadastro: é
 * alguém que ainda não tem conta e pediu para a equipe ligar. A fila só serve
 * para uma coisa — saber para quem ligar e não ligar duas vezes.
 */

import { useState } from "react";

import { Check } from "./blocks";
import { TextDialog, useRun } from "./dialogs";
import { LEAD_STATUS_LABEL, stamp, waited, type Lead, type LeadStatus } from "./model";
import { useAdmin } from "./store";

type Filter = "queue" | LeadStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "queue", label: "Na fila" },
  { value: "contacted", label: "Já falamos" },
  { value: "discarded", label: "Descartados" },
  { value: "all", label: "Todos · 180 dias" },
];

export function Leads() {
  const { data, actions } = useAdmin();
  const [filter, setFilter] = useState<Filter>("queue");
  const [selected, setSelected] = useState("");
  const [dialog, setDialog] = useState<"discard" | null>(null);
  const contact = useRun();
  const requeue = useRun();

  if (data.leads.length === 0) {
    return (
      <div className="empty-queue">
        <span className="empty-mark">
          <Check />
        </span>
        <strong>Nenhum interessado ainda</strong>
        <p>
          Entra aqui quem preenche o formulário da landing. A pessoa não tem conta: o contato dela é
          o WhatsApp que ela digitou.
        </p>
      </div>
    );
  }

  const visible = data.leads.filter((lead) =>
    filter === "all" ? true : filter === "queue" ? lead.status === "new" : lead.status === filter,
  );
  const lead = visible.find((l) => l.id === selected) ?? visible[0];

  return (
    <div className="customers-grid">
      <div className="stack tight">
        <div className="filter-triple">
          <select
            aria-label="Situação"
            id="lead-status"
            onChange={(event) => setFilter(event.target.value as Filter)}
            value={filter}
          >
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="card clip">
          <div className="list-head">
            <span>Interessados · mais novos primeiro</span>
            <code>{visible.length}</code>
          </div>
          {visible.length === 0 ? (
            <p className="table-empty">Nenhum contato nesta situação.</p>
          ) : (
            <div className="table-wrap">
              <table className="rows">
                <thead>
                  <tr>
                    <th>Estabelecimento</th>
                    <th>Quem pediu</th>
                    <th>WhatsApp</th>
                    <th className="right">Esperando</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr
                      aria-selected={item.id === lead?.id}
                      className={item.id === lead?.id ? "picked" : undefined}
                      key={item.id}
                      onClick={() => setSelected(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(item.id);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="marker strong">
                        {item.establishmentName}
                        {item.status !== "new" ? (
                          <span className="tag-strong team-tag">
                            {LEAD_STATUS_LABEL[item.status]}
                          </span>
                        ) : null}
                      </td>
                      <td className="muted">
                        {item.name}
                        {item.category ? ` · ${item.category}` : ""}
                      </td>
                      <td className="mono">{item.contact}</td>
                      <td className="right mono muted">
                        {item.status === "new" ? waited(item.createdAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {lead ? (
        <LeadCard
          key={lead.id}
          lead={lead}
          onContact={() =>
            void contact.run(() => actions.setLeadStatus(lead.id, "contacted", ""), {
              title: "Contato marcado como falado",
              sub: `${lead.establishmentName} sai da fila.`,
            })
          }
          onDiscard={() => setDialog("discard")}
          onRequeue={() =>
            void requeue.run(() => actions.setLeadStatus(lead.id, "new", ""), {
              title: "Contato de volta na fila",
              sub: `${lead.establishmentName} volta a aparecer em "Na fila".`,
            })
          }
          pending={contact.pending || requeue.pending}
        />
      ) : null}

      {dialog === "discard" && lead ? (
        <TextDialog
          confirmLabel="Descartar"
          danger
          description="Some da fila e fica no registro de auditoria. Nada é apagado: o contato continua aqui em 'Descartados'."
          id="lead-discard"
          label="Por que descartar"
          onClose={() => setDialog(null)}
          onConfirm={(note) => actions.setLeadStatus(lead.id, "discarded", note)}
          placeholder="Ex.: número errado; ou não é do ramo que atendemos"
          success={{
            title: "Contato descartado",
            sub: `${lead.establishmentName} sai da fila.`,
          }}
          title={`Descartar ${lead.establishmentName}`}
        />
      ) : null}
    </div>
  );
}

function LeadCard({
  lead,
  onContact,
  onDiscard,
  onRequeue,
  pending,
}: {
  lead: Lead;
  onContact: () => void;
  onDiscard: () => void;
  onRequeue: () => void;
  pending: boolean;
}) {
  return (
    <aside className="card inspector static">
      <div className="inspector-head">
        <div>
          <h3>{lead.establishmentName}</h3>
          <small>
            {lead.name}
            {lead.category ? ` · ${lead.category}` : ""}
          </small>
        </div>
      </div>

      <div className="inspector-block">
        <p className="field-group-label">Contato</p>
        {/* O link abre a conversa já no número que a pessoa digitou. */}
        <p className="mono strong">{lead.contact}</p>
        <p className="hint">
          Enviado em {stamp(lead.createdAt)} · origem {lead.source}
        </p>
        {lead.previousAttempts > 0 ? (
          <p className="callout amber">
            Este número já tinha escrito {lead.previousAttempts}{" "}
            {lead.previousAttempts === 1 ? "vez" : "vezes"} antes. Veja se alguém já falou com ele.
          </p>
        ) : null}
      </div>

      <div className="inspector-block">
        <p className="field-group-label">O que escreveu</p>
        {lead.message ? <p>{lead.message}</p> : <p className="hint">Não escreveu nada.</p>}
      </div>

      {lead.status !== "new" ? (
        <div className="inspector-block">
          <p className="field-group-label">Triagem</p>
          <p>
            {LEAD_STATUS_LABEL[lead.status]}
            {lead.handledBy ? ` · ${lead.handledBy}` : ""}
            {lead.handledAt ? ` · ${stamp(lead.handledAt)}` : ""}
          </p>
          {lead.handledNote ? <p className="hint">{lead.handledNote}</p> : null}
        </div>
      ) : null}

      <div className="inspector-block last">
        <div className="button-stack">
          {lead.status === "new" ? (
            <>
              <button className="ghost" disabled={pending} onClick={onContact} type="button">
                Já falei com essa pessoa
              </button>
              <button className="ghost danger strong" onClick={onDiscard} type="button">
                Descartar contato
              </button>
            </>
          ) : (
            <button className="ghost" disabled={pending} onClick={onRequeue} type="button">
              Devolver para a fila
            </button>
          )}
        </div>
        <p className="hint">
          Nada é enviado daqui: o contato é você quem faz, pelo WhatsApp. Este painel só guarda o
          que já foi feito.
        </p>
      </div>
    </aside>
  );
}
