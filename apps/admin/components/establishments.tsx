"use client";

import { useState } from "react";

import { Check, ChevronRight, DocIcon, SearchIcon, StatusChip, TriangleAlert } from "./blocks";
import {
  chip,
  ESTAB_BILLING,
  ESTAB_TABS,
  ESTABLISHMENTS,
  USAGE_BARS,
  USAGE_MONTHS,
  type EstabTab,
} from "./data";

export function Establishments({ onOpen }: { onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.concat([id])));

  return (
    <div className="stack tight">
      <div className="filter-bar">
        <div className="search light">
          <SearchIcon />
          <input placeholder="Buscar por nome" />
        </div>
        <select defaultValue="Todas as cidades">
          <option>Todas as cidades</option>
          <option>São Paulo</option>
          <option>Campinas</option>
          <option>Curitiba</option>
        </select>
        <select defaultValue="Todos os planos">
          <option>Todos os planos</option>
          <option>Mensalidade</option>
          <option>Comissão</option>
        </select>
        <select defaultValue="Todas as situações">
          <option>Todas as situações</option>
          <option>Ativo</option>
          <option>Inadimplente</option>
          <option>Suspenso</option>
        </select>
        <select defaultValue="Todas as categorias">
          <option>Todas as categorias</option>
          <option>Barbearia</option>
          <option>Salão</option>
          <option>Estética</option>
        </select>
        <button className="ghost danger" type="button">
          Só com risco
        </button>
        <div className="spacer" />
        <button className="ghost" type="button">
          Exportar CSV
        </button>
      </div>

      {selected.length > 0 ? (
        <div className="bulk-bar">
          <code>{selected.length} selecionados</code>
          <span className="divider" />
          <button className="link" type="button">
            Trocar plano
          </button>
          <button className="link" type="button">
            Aplicar desconto
          </button>
          <button className="link danger" type="button">
            Suspender
          </button>
          <div className="spacer" />
          <button className="link muted" onClick={() => setSelected([])} type="button">
            Limpar seleção
          </button>
        </div>
      ) : null}

      <div className="card clip">
        <table className="rows">
          <thead>
            <tr>
              <th className="check" />
              <th>Estabelecimento ↓</th>
              <th>Cidade</th>
              <th>Categoria</th>
              <th>Plano</th>
              <th>Assinatura</th>
              <th className="right">Agend./mês</th>
              <th className="right">Receita p/ plataforma</th>
              <th className="right">Entrada</th>
              <th className="chevron" />
            </tr>
          </thead>
          <tbody>
            {ESTABLISHMENTS.map((est) => {
              const checked = selected.includes(est.id);
              return (
                <tr className={checked ? "selected" : undefined} key={est.id}>
                  <td className="check top">
                    <button
                      aria-label={`Selecionar ${est.name}`}
                      aria-pressed={checked}
                      className={checked ? "checkbox on" : "checkbox"}
                      onClick={() => toggle(est.id)}
                      type="button"
                    >
                      <Check size={9} width={3.5} />
                    </button>
                  </td>
                  <td>
                    <button className="row-link" onClick={() => onOpen(est.id)} type="button">
                      {est.name}
                    </button>
                    {est.risk ? (
                      <p className="risk">
                        <TriangleAlert size={11} />
                        {est.risk}
                      </p>
                    ) : null}
                  </td>
                  <td className="muted">{est.city}</td>
                  <td>{est.cat}</td>
                  <td>{est.plan}</td>
                  <td>
                    <StatusChip chip={chip(est.st)} />
                  </td>
                  <td className="right mono">{est.appt}</td>
                  <td className="right mono">{est.rev}</td>
                  <td className="right mono muted">{est.since}</td>
                  <td className="right">
                    <button
                      aria-label={`Abrir ${est.name}`}
                      className="icon-button"
                      onClick={() => onOpen(est.id)}
                      type="button"
                    >
                      <ChevronRight />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="table-foot">
          <span>
            Mostrando <code>1–8</code> de <code>1.361</code>
          </span>
          <div className="pager">
            <button className="ghost small disabled" type="button">
              Anterior
            </button>
            <button className="ghost small" type="button">
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EstablishmentDetail({
  estabId,
  onBack,
  onAccess,
}: {
  estabId: string;
  onBack: () => void;
  onAccess: () => void;
}) {
  const [tab, setTab] = useState<EstabTab>("visão geral");
  const est = ESTABLISHMENTS.find((item) => item.id === estabId) ?? ESTABLISHMENTS[0]!;

  return (
    <div className="stack detail">
      <button className="back" onClick={onBack} type="button">
        <svg
          fill="none"
          height="13"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="13"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Todos os estabelecimentos
      </button>

      <div className="entity-head">
        <div className="entity-avatar">
          <svg fill="none" height="22" strokeWidth="1.6" viewBox="0 0 24 24" width="22">
            <path d="M3 9l1.6-5h14.8L21 9M4.5 9v11h15V9M9 20v-6h6v6" />
          </svg>
        </div>
        <div className="entity-body">
          <div className="title-row">
            <h2>{est.name}</h2>
            <StatusChip chip={chip(est.st)} />
          </div>
          <p className="detail-sub">
            {est.city} · {est.cat} · {est.plan} · na plataforma desde {est.since}
          </p>
        </div>
        <div className="actions">
          <button className="ghost" type="button">
            Trocar plano
          </button>
          <button className="ghost" type="button">
            Aplicar desconto
          </button>
          <button className="ghost danger" type="button">
            Suspender
          </button>
          <button className="primary" onClick={onAccess} type="button">
            Acessar conta
          </button>
        </div>
      </div>

      {est.risk ? (
        <div className="banner danger">
          <TriangleAlert />
          <span>Sinalizado como risco: {est.risk}</span>
          <div className="spacer" />
          <button className="ghost small danger" type="button">
            Registrar contato
          </button>
        </div>
      ) : null}

      <div className="tabs">
        {ESTAB_TABS.map((name) => {
          const key = name.toLowerCase() as EstabTab;
          return (
            <button
              className={key === tab ? "tab active" : "tab"}
              key={name}
              onClick={() => setTab(key)}
              type="button"
            >
              {name}
            </button>
          );
        })}
      </div>

      {tab === "visão geral" ? (
        <>
          <div className="kpi-grid three">
            <div className="card pad">
              <p className="kpi-label">Agendamentos no mês</p>
              <code className="kpi-number sm">{est.appt}</code>
              <small className="kpi-note danger">−68% vs. média de 6 meses</small>
            </div>
            <div className="card pad">
              <p className="kpi-label">Receita gerada no mês</p>
              <code className="kpi-number sm">{est.rev}</code>
              <small className="kpi-note">Mensalidade fixa · sem comissão</small>
            </div>
            <div className="card pad">
              <p className="kpi-label">Pagamento no app</p>
              <code className="kpi-number sm">Desligado</code>
              <small className="kpi-note">Nenhum agendamento gera transação</small>
            </div>
          </div>

          <div className="detail-split">
            <div className="card pad">
              <h3 className="card-title">Uso da plataforma · 12 meses</h3>
              <div className="usage-bars">
                {USAGE_BARS.map((height, i) => (
                  <div key={USAGE_MONTHS[i]}>
                    {/* Os meses da queda ficam em vermelho, como no canvas. */}
                    <span
                      className={i >= 6 && i < 10 ? "bar danger" : "bar"}
                      style={{ height: `${height}px` }}
                    />
                    <code>{USAGE_MONTHS[i]}</code>
                  </div>
                ))}
              </div>
            </div>
            <div className="card pad">
              <h3 className="card-title">Dados cadastrais</h3>
              <div className="field-list">
                <div>
                  <small>CNPJ</small>
                  <code>32.774.019/0001-58</code>
                </div>
                <div>
                  <small>Endereço</small>
                  <p>R. Teodoro Sampaio, 1420 — Pinheiros, São Paulo/SP</p>
                </div>
                <div>
                  <small>Responsável</small>
                  <p>Lorena Prado · (11) 98221-7740</p>
                </div>
                <div>
                  <small>Profissionais ativos</small>
                  <code>6</code>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {tab === "cobranças" ? (
        <div className="card clip">
          <table>
            <thead>
              <tr>
                <th>Competência</th>
                <th>Situação</th>
                <th className="right">Valor</th>
                <th className="right">Pago em</th>
              </tr>
            </thead>
            <tbody>
              {ESTAB_BILLING.map((row) => (
                <tr key={row.comp}>
                  <td className="strong">{row.comp}</td>
                  <td>
                    <StatusChip chip={chip(row.st)} />
                  </td>
                  <td className="right mono">{row.val}</td>
                  <td className="right mono muted">{row.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "chamados" || tab === "avaliações" || tab === "uso da plataforma" ? (
        <div className="empty-card">
          <DocIcon />
          <strong>
            {tab === "chamados"
              ? "Chamados deste estabelecimento"
              : tab === "avaliações"
                ? "Avaliações recebidas"
                : "Uso detalhado"}
          </strong>
          <p>Esta aba reusa os mesmos componentes de lista; não detalhada nesta rodada.</p>
        </div>
      ) : null}
    </div>
  );
}
