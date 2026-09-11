"use client";

import { useState } from "react";

import { Tabs } from "./blocks";
import { SETTINGS_TABS, type SettingsTab } from "./data";
import { FormError, useRun } from "./dialogs";
import { ago, paramText, stamp, type AuditEntry, type Param } from "./model";
import { useAdmin } from "./store";
import { AMBER, AMBER_DARK, AMBER_SOFT, LINE_DARK, MUTED, NEUTRAL_SOFT } from "./tokens";

type Kind = "" | "access" | "approvals" | "billing";

/** Em que grupo do filtro cada linha da auditoria cai. */
function kindOf(a: AuditEntry): Exclude<Kind, ""> | "other" {
  if (a.accountAccess) return "access";
  if (/^(Aprovou|Recusou|Pediu correção)/.test(a.action)) return "approvals";
  if (/cobrança|desconto|plano|cota/i.test(a.action)) return "billing";
  return "other";
}

export function Settings() {
  const { data } = useAdmin();
  const [tab, setTab] = useState<SettingsTab>("Registro de auditoria");
  const [kind, setKind] = useState<Kind>("");
  const [who, setWho] = useState("");

  const audit = data.audit.filter((a) => (!kind || kindOf(a) === kind) && (!who || a.who === who));
  const people = [...new Set(data.audit.map((a) => a.who))].sort();

  return (
    <div className="stack detail">
      <Tabs active={tab} onSelect={setTab} tabs={SETTINGS_TABS} />

      {tab === "Equipe e acessos" ? (
        <div className="card clip">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Nível de acesso</th>
                  <th>Alcance</th>
                  <th className="right">Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {data.team.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong className="cell-title">{member.name}</strong>
                      <small className="cell-sub">{member.email}</small>
                    </td>
                    <td className="strong">{member.role}</td>
                    <td className="muted">{member.scope}</td>
                    <td className="right mono muted">
                      {member.id === data.me.id ? "agora" : ago(member.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "Parâmetros da plataforma" ? (
        <div className="card params">
          {data.params.map((param) => (
            <ParamRow key={param.key} param={param} />
          ))}
        </div>
      ) : null}

      {tab === "Registro de auditoria" ? (
        <div className="stack tight">
          <div className="filter-bar">
            <select
              aria-label="Tipo de ação"
              id="audit-kind"
              onChange={(e) => setKind(e.target.value as Kind)}
              value={kind}
            >
              <option value="">Todas as ações</option>
              <option value="access">Acessos a contas</option>
              <option value="approvals">Aprovações</option>
              <option value="billing">Cobranças e planos</option>
            </select>
            <select
              aria-label="Pessoa"
              id="audit-who"
              onChange={(e) => setWho(e.target.value)}
              value={who}
            >
              <option value="">Toda a equipe</option>
              {people.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <span className="hint">Acessos a contas de estabelecimentos aparecem destacados.</span>
          </div>

          <div className="card clip">
            {audit.length === 0 ? (
              <p className="table-empty">Nenhuma ação com esses filtros.</p>
            ) : null}
            {audit.map((entry) => (
              <div
                className="audit-row"
                key={entry.id}
                style={{
                  background: entry.accountAccess ? "#FFFBF2" : "#FFFFFF",
                  borderLeftColor: entry.accountAccess ? AMBER : LINE_DARK,
                }}
              >
                <div>
                  <div className="audit-title">
                    <strong>{entry.action}</strong>
                    <b
                      style={{
                        background: entry.accountAccess ? AMBER_SOFT : NEUTRAL_SOFT,
                        color: entry.accountAccess ? AMBER_DARK : MUTED,
                      }}
                    >
                      {entry.accountAccess ? "Acesso a conta" : "Ação administrativa"}
                    </b>
                  </div>
                  <small>{entry.meta}</small>
                </div>
                <div className="audit-side">
                  <strong>{entry.who}</strong>
                  <code>{stamp(entry.at)}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ParamRow({ param }: { param: Param }) {
  const { actions } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(param.value));
  const { pending, error, run } = useRun(() => setEditing(false));

  if (!editing) {
    return (
      <div className="param-row">
        <span>{param.label}</span>
        <code>{paramText(param)}</code>
        <button
          className="ghost small"
          onClick={() => {
            setValue(String(param.value));
            setEditing(true);
          }}
          type="button"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <form
      className="param-row editing"
      onSubmit={(event) => {
        event.preventDefault();
        void run(() => actions.updateParam(param.key, Number(value)), {
          title: "Parâmetro salvo",
          sub: `${param.label}: ${paramText({ ...param, value: Number(value) })}.`,
        });
      }}
    >
      <span>{param.label}</span>
      <label className="param-input">
        <input
          aria-label={param.label}
          autoFocus
          className="mono-input"
          id={`param-${param.key}`}
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
          value={value}
        />
        <small>{param.unit}</small>
      </label>
      <button className="ghost small" onClick={() => setEditing(false)} type="button">
        Cancelar
      </button>
      <button className="primary small" disabled={pending || value === ""} type="submit">
        {pending ? "Salvando…" : "Salvar"}
      </button>
      <FormError message={error} />
    </form>
  );
}
