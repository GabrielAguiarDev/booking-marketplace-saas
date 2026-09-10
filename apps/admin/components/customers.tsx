"use client";

import { CUSTOMER_MISSES, CUSTOMERS } from "./data";

export function Customers() {
  return (
    <div className="customers-grid">
      <div className="card clip">
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
            {CUSTOMERS.map((customer) => (
              <tr key={customer.name}>
                <td className="strong">{customer.name}</td>
                <td className="muted">{customer.city}</td>
                <td className="right mono muted">{customer.since}</td>
                <td className="right mono">{customer.appt}</td>
                <td className="right mono strong" style={{ color: customer.tone }}>
                  {customer.ns}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="card inspector">
        <div className="inspector-head">
          <div className="avatar-row">
            <b>RT</b>
            <div>
              <h3>Rogério Tavares</h3>
              <small>São Paulo · cliente desde 02 set 2025</small>
            </div>
          </div>
        </div>

        <div className="stat-row">
          <div>
            <code>12</code>
            <small>Agendamentos</small>
          </div>
          <div>
            <code className="danger">41,7%</code>
            <small>Não comparecimento</small>
          </div>
        </div>

        <div className="inspector-block">
          <p className="field-group-label">Últimas faltas</p>
          <div className="miss-list">
            {CUSTOMER_MISSES.map((miss, i) => (
              <div key={`${miss.est}-${i}`}>
                <span>{miss.est}</span>
                <code>{miss.when}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="inspector-block last">
          <p className="callout amber">
            3 faltas em 30 dias — acima do parâmetro de bloqueio automático.
          </p>
          <div className="button-stack">
            <button className="ghost" type="button">
              Registrar atendimento
            </button>
            <button className="ghost danger strong" type="button">
              Bloquear novos agendamentos
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
