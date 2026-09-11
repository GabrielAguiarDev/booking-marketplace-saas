"use client";

import { useState } from "react";

import { TextDialog, useRun } from "./dialogs";
import { day, noShowRate, stamp } from "./model";
import { useAdmin } from "./store";
import { AMBER, GREEN, RED } from "./tokens";

const rateTone = (rate: number) => (rate >= 30 ? RED : rate >= 10 ? AMBER : GREEN);
const pct = (rate: number) => `${rate.toFixed(1).replace(".", ",")}%`;
const DAY_MS = 24 * 3600 * 1000;

export function Customers({ focusId }: { focusId?: string }) {
  const { data, actions } = useAdmin();
  const [selected, setSelected] = useState(
    focusId ??
      data.customers.find((c) => c.name === "Rogério Tavares")?.id ??
      data.customers[0]?.id ??
      "",
  );
  const [dialog, setDialog] = useState<"contact" | "block" | null>(null);
  const unblock = useRun();
  const customer = data.customers.find((c) => c.id === selected) ?? data.customers[0];

  const threshold = data.params.find((p) => p.key === "no_show_block_threshold")?.value ?? 3;

  return (
    <div className="customers-grid">
      <div className="card clip">
        <div className="table-wrap">
          <table className="rows">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Cidade</th>
                <th className="right">Cadastro</th>
                <th className="right">Agendamentos</th>
                <th className="right">Não comparecimento</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c) => {
                const rate = noShowRate(c);
                return (
                  <tr
                    aria-selected={c.id === customer?.id}
                    className={c.id === customer?.id ? "picked" : undefined}
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(c.id);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="marker strong">
                      {c.name}
                      {c.blocked ? <span className="tag-strong blocked">bloqueado</span> : null}
                    </td>
                    <td className="muted">{c.city}</td>
                    <td className="right mono muted">{day(c.since)}</td>
                    <td className="right mono">{c.appointments}</td>
                    <td className="right mono strong" style={{ color: rateTone(rate) }}>
                      {pct(rate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {customer ? (
        <aside className="card inspector static">
          <div className="inspector-head">
            <div className="avatar-row">
              <b>
                {customer.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </b>
              <div>
                <h3>{customer.name}</h3>
                <small>
                  {customer.city} · cliente desde {day(customer.since)}
                </small>
              </div>
            </div>
          </div>

          <div className="stat-row">
            <div>
              <code>{customer.appointments}</code>
              <small>Agendamentos</small>
            </div>
            <div>
              <code style={{ color: rateTone(noShowRate(customer)) }}>
                {pct(noShowRate(customer))}
              </code>
              <small>Não comparecimento</small>
            </div>
          </div>

          <div className="inspector-block">
            <p className="field-group-label">Últimas faltas</p>
            {customer.misses.length ? (
              <div className="miss-list">
                {customer.misses.map((miss, i) => (
                  <div key={`${miss.establishment}-${i}`}>
                    <span>{miss.establishment}</span>
                    <code>{stamp(miss.at).slice(0, 6)}</code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">Nenhuma falta registrada.</p>
            )}
          </div>

          <div className="inspector-block last">
            {(() => {
              const recent = customer.misses.filter(
                (m) => Date.now() - new Date(m.at).getTime() <= 30 * DAY_MS,
              ).length;
              if (customer.blocked) {
                return (
                  <p className="callout red">
                    Novos agendamentos bloqueados. As reservas já feitas continuam valendo.
                  </p>
                );
              }
              if (customer.misses.length >= threshold) {
                return (
                  <p className="callout amber">
                    {customer.misses.length} faltas
                    {recent === customer.misses.length ? " em 30 dias" : ""} — acima do parâmetro de
                    bloqueio automático ({threshold}).
                  </p>
                );
              }
              return null;
            })()}
            <div className="button-stack">
              <button className="ghost" onClick={() => setDialog("contact")} type="button">
                Registrar atendimento
              </button>
              {customer.blocked ? (
                <button
                  className="ghost"
                  disabled={unblock.pending}
                  onClick={() =>
                    void unblock.run(() => actions.setCustomerBlocked(customer.id, false, ""), {
                      title: "Cliente desbloqueado",
                      sub: `${customer.name} volta a poder agendar.`,
                    })
                  }
                  type="button"
                >
                  Desbloquear novos agendamentos
                </button>
              ) : (
                <button
                  className="ghost danger strong"
                  onClick={() => setDialog("block")}
                  type="button"
                >
                  Bloquear novos agendamentos
                </button>
              )}
            </div>
          </div>
        </aside>
      ) : null}

      {dialog === "contact" && customer ? (
        <TextDialog
          confirmLabel="Registrar"
          description="Fica no registro de auditoria. Use para contato de suporte, reclamação ou acordo."
          id="customer-contact"
          label="O que foi conversado"
          onClose={() => setDialog(null)}
          onConfirm={(note) => actions.registerCustomerContact(customer.id, note)}
          placeholder="Ex.: explicou as faltas; combinamos avisar com antecedência"
          success={{
            title: "Atendimento registrado",
            sub: `Anotado no histórico de ${customer.name}.`,
          }}
          title={`Atendimento a ${customer.name}`}
        />
      ) : null}
      {dialog === "block" && customer ? (
        <TextDialog
          confirmLabel="Bloquear"
          danger
          description="A pessoa não consegue mais agendar pelo app. O que já está marcado continua valendo."
          id="customer-block"
          label="Motivo"
          onClose={() => setDialog(null)}
          onConfirm={(reason) => actions.setCustomerBlocked(customer.id, true, reason)}
          placeholder="Ex.: 3 faltas em 30 dias sem aviso"
          success={{
            title: "Cliente bloqueado",
            sub: `${customer.name} não consegue mais agendar.`,
          }}
          title={`Bloquear ${customer.name}`}
        />
      ) : null}
    </div>
  );
}
