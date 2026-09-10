"use client";

import { useState } from "react";

import { Tabs } from "./blocks";
import { AUDIT, PARAMS, SETTINGS_TABS, TEAM, type SettingsTab } from "./data";
import { AMBER, AMBER_DARK, AMBER_SOFT, LINE_DARK, MUTED, NEUTRAL_SOFT } from "./tokens";

export function Settings() {
  const [tab, setTab] = useState<SettingsTab>("Registro de auditoria");

  return (
    <div className="stack detail">
      <Tabs active={tab} onSelect={setTab} tabs={SETTINGS_TABS} />

      {tab === "Equipe e acessos" ? (
        <div className="card clip">
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
              {TEAM.map((member) => (
                <tr key={member.email}>
                  <td>
                    <strong className="cell-title">{member.name}</strong>
                    <small className="cell-sub">{member.email}</small>
                  </td>
                  <td className="strong">{member.role}</td>
                  <td className="muted">{member.scope}</td>
                  <td className="right mono muted">{member.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "Parâmetros da plataforma" ? (
        <div className="card params">
          {PARAMS.map((param) => (
            <div className="param-row" key={param.label}>
              <span>{param.label}</span>
              <code>{param.val}</code>
              <button className="ghost small" type="button">
                Editar
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "Registro de auditoria" ? (
        <div className="stack tight">
          <div className="filter-bar">
            <select defaultValue="Todas as ações">
              <option>Todas as ações</option>
              <option>Acessos a contas</option>
              <option>Aprovações</option>
              <option>Cobranças</option>
            </select>
            <select defaultValue="Toda a equipe">
              <option>Toda a equipe</option>
              <option>Helena Reis</option>
              <option>Rafael Lima</option>
            </select>
            <span className="hint">
              Acessos a contas de estabelecimentos aparecem destacados.
            </span>
          </div>

          <div className="card clip">
            {AUDIT.map((entry, i) => (
              <div
                className="audit-row"
                key={`${entry.who}-${i}`}
                style={{
                  background: entry.flag ? "#FFFBF2" : "#FFFFFF",
                  borderLeftColor: entry.flag ? AMBER : LINE_DARK,
                }}
              >
                <div>
                  <div className="audit-title">
                    <strong>{entry.act}</strong>
                    <b
                      style={{
                        background: entry.flag ? AMBER_SOFT : NEUTRAL_SOFT,
                        color: entry.flag ? AMBER_DARK : MUTED,
                      }}
                    >
                      {entry.flag ? "Acesso a conta" : "Ação administrativa"}
                    </b>
                  </div>
                  <small>{entry.meta}</small>
                </div>
                <div className="audit-side">
                  <strong>{entry.who}</strong>
                  <code>{entry.when}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
