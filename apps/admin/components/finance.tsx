"use client";

import { useState } from "react";

import { StatusChip, Tabs } from "./blocks";
import {
  BILLING,
  chip,
  DEFAULT_STEPS,
  FINANCE_TABS,
  REVENUE_ROWS,
  TRANSFERS,
  type FinanceTab,
} from "./data";

export function Finance() {
  const [tab, setTab] = useState<FinanceTab>("Cobranças");

  return (
    <div className="stack detail">
      <Tabs
        active={tab}
        end={
          <button className="ghost small" type="button">
            Exportar CSV
          </button>
        }
        onSelect={setTab}
        tabs={FINANCE_TABS}
      />

      {tab === "Receita" ? (
        <div className="card clip">
          <table>
            <thead>
              <tr>
                <th>Competência</th>
                <th className="right">Mensalidade</th>
                <th className="right">Comissão</th>
                <th className="right">Total</th>
                <th className="right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {REVENUE_ROWS.map((row) => (
                <tr key={row.m}>
                  <td className="strong">{row.m}</td>
                  <td className="right mono">{row.mens}</td>
                  <td className="right mono coral">{row.com}</td>
                  <td className="right mono strong">{row.tot}</td>
                  <td className="right mono strong green">{row.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "Cobranças" ? (
        <div className="stack tight">
          <div className="kpi-grid three">
            <div className="card pad">
              <p className="kpi-label">Pagas em agosto</p>
              <code className="kpi-number xs">R$ 133.740</code>
              <small className="kpi-note green">798 cobranças</small>
            </div>
            <div className="card pad">
              <p className="kpi-label">Pendentes</p>
              <code className="kpi-number xs">R$ 2.847</code>
              <small className="kpi-note amber">9 cobranças a vencer</small>
            </div>
            <div className="card pad danger">
              <p className="kpi-label danger">Vencidas</p>
              <code className="kpi-number xs danger">R$ 3.160</code>
              <small className="kpi-note danger">4 cobranças · até 16 dias</small>
            </div>
          </div>

          <div className="card clip">
            <table className="rows">
              <thead>
                <tr>
                  <th>Estabelecimento</th>
                  <th>Cidade</th>
                  <th>Competência</th>
                  <th>Situação</th>
                  <th className="right">Valor</th>
                  <th className="right">Vencimento</th>
                  <th className="right">Atraso</th>
                  <th className="right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {BILLING.map((row) => (
                  <tr key={`${row.est}-${row.comp}`}>
                    <td className="strong">{row.est}</td>
                    <td className="muted">{row.city}</td>
                    <td className="mono">{row.comp}</td>
                    <td>
                      <StatusChip
                        chip={{
                          ...chip(row.st === "vencida" ? "vencido" : row.st),
                          label:
                            row.st === "vencida"
                              ? "Vencida"
                              : row.st === "pend"
                                ? "Pendente"
                                : "Paga",
                        }}
                      />
                    </td>
                    <td className="right mono strong">{row.val}</td>
                    <td className="right mono muted">{row.due}</td>
                    <td className="right mono strong danger">{row.days}</td>
                    <td className="right">
                      {row.st === "vencida" ? (
                        <button className="ghost small" type="button">
                          Reenviar cobrança
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "Repasses" ? (
        <div className="stack tight">
          <p className="lede">
            Só aparecem aqui os estabelecimentos que aceitam pagamento pelo app. Agendamentos sem
            pagamento integrado não geram repasse.
          </p>
          <div className="card clip">
            <table>
              <thead>
                <tr>
                  <th>Estabelecimento</th>
                  <th>Cidade</th>
                  <th className="right">Recebido no app</th>
                  <th className="right">Comissão retida</th>
                  <th className="right">A repassar</th>
                  <th>Situação</th>
                  <th className="right">Quando</th>
                </tr>
              </thead>
              <tbody>
                {TRANSFERS.map((row) => (
                  <tr key={row.est}>
                    <td className="strong">{row.est}</td>
                    <td className="muted">{row.city}</td>
                    <td className="right mono">{row.gross}</td>
                    <td className="right mono coral">{row.fee}</td>
                    <td className="right mono strong">{row.net}</td>
                    <td className="strong" style={{ color: row.tone, fontSize: "12px" }}>
                      {row.st}
                    </td>
                    <td className="right mono muted">{row.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "Inadimplência" ? (
        <div className="card pad wide-pad">
          <h3 className="card-title tight">Fluxo de carência e suspensão automática</h3>
          <p className="lede spaced">
            Contagem a partir do vencimento da cobrança. O número indica quantos estabelecimentos
            estão em cada etapa agora.
          </p>
          <div className="steps">
            {DEFAULT_STEPS.map((step) => (
              <div className="step" key={step.d} style={{ borderLeftColor: step.tone }}>
                <code style={{ color: step.tone }}>{step.d}</code>
                <strong>{step.label}</strong>
                <small>{step.meta}</small>
                <span className="step-count">
                  <code>{step.n}</code>
                  <small>estab.</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
