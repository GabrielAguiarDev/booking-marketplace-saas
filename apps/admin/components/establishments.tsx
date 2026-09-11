"use client";

import { useMemo, useState } from "react";

import {
  Check,
  ChevronRight,
  DocIcon,
  SearchIcon,
  Stars,
  StatusChip,
  TriangleAlert,
} from "./blocks";
import { downloadCsv, toCsv } from "./csv";
import { ESTAB_TABS, STATUS, decimal, signed, type Chip, type EstabTab } from "./data";
import { DiscountDialog, PlanDialog, TextDialog, useRun } from "./dialogs";
import {
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
  brl,
  count,
  day,
  competence,
  planText,
  stamp,
  type AccessSession,
  type Establishment,
} from "./model";
import { useAdmin } from "./store";

const PAGE = 8;

/** Rótulos dos 12 meses de `usage`, do mais antigo ao atual. */
function usageMonths(): string[] {
  const now = new Date();
  const format = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  return Array.from({ length: 12 }, (_, i) =>
    format.format(new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)).replace(".", ""),
  );
}

/** A etiqueta de situação: suspensa ganha de inadimplente, que ganha de ativa. */
function statusChip(e: Establishment): Chip {
  if (e.status === "suspended") return STATUS.suspenso;
  if (e.status === "pending") return STATUS.pendente;
  if (e.overdue) return STATUS.vencido;
  return STATUS.ativo;
}

type Bulk = "plan" | "discount" | "suspend" | null;

export function Establishments({ onOpen }: { onOpen: (id: string) => void }) {
  const { data } = useAdmin();
  const commission = data.plans.find((p) => p.kind === "commission")?.commissionPercent ?? 12;

  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState<Bulk>(null);

  const options = useMemo(
    () => ({
      cities: [...new Set(data.establishments.map((e) => e.city))].sort(),
      categories: [...new Set(data.establishments.map((e) => e.category))].sort(),
    }),
    [data.establishments],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.establishments
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .filter((e) => !city || e.city === city)
      .filter((e) => !plan || e.plan === plan)
      .filter((e) => !category || e.category === category)
      .filter((e) => {
        if (!status) return true;
        if (status === "overdue") return e.overdue && e.status === "active";
        if (status === "active") return e.status === "active" && !e.overdue;
        return e.status === status;
      })
      .filter((e) => !riskOnly || e.risk)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [data.establishments, query, city, plan, status, category, riskOnly]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE, current * PAGE + PAGE);

  // mudar filtro volta para a primeira página
  const filter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(0);
    };

  const toggle = (id: string) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.concat([id])));

  const exportCsv = () =>
    downloadCsv(
      `vez-estabelecimentos-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        [
          "Estabelecimento",
          "Cidade",
          "Categoria",
          "Plano",
          "Situação",
          "Agend./mês",
          "Receita p/ plataforma",
          "Entrada",
          "Risco",
        ],
        rows.map((e) => [
          e.name,
          e.city,
          e.category,
          planText(e.plan, commission),
          statusChip(e).label,
          String(e.appointmentsMonth),
          brl(e.platformRevenueCents),
          day(e.since),
          e.risk ?? "",
        ]),
      ),
    );

  return (
    <div className="stack tight">
      <div className="filter-bar">
        <div className="search light">
          <SearchIcon />
          <input
            aria-label="Buscar por nome"
            id="estab-search"
            onChange={(event) => filter(setQuery)(event.target.value)}
            placeholder="Buscar por nome"
            value={query}
          />
        </div>
        <select
          aria-label="Cidade"
          id="estab-city"
          onChange={(e) => filter(setCity)(e.target.value)}
          value={city}
        >
          <option value="">Todas as cidades</option>
          {options.cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Plano"
          id="estab-plan"
          onChange={(e) => filter(setPlan)(e.target.value)}
          value={plan}
        >
          <option value="">Todos os planos</option>
          <option value="monthly">Mensalidade</option>
          <option value="commission">Comissão</option>
        </select>
        <select
          aria-label="Situação"
          id="estab-status"
          onChange={(e) => filter(setStatus)(e.target.value)}
          value={status}
        >
          <option value="">Todas as situações</option>
          <option value="active">Ativo</option>
          <option value="overdue">Inadimplente</option>
          <option value="suspended">Suspenso</option>
        </select>
        <select
          aria-label="Categoria"
          id="estab-category"
          onChange={(e) => filter(setCategory)(e.target.value)}
          value={category}
        >
          <option value="">Todas as categorias</option>
          {options.categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          aria-pressed={riskOnly}
          className={riskOnly ? "ghost danger pressed" : "ghost danger"}
          onClick={() => filter(setRiskOnly)(!riskOnly)}
          type="button"
        >
          Só com risco
        </button>
        <div className="spacer" />
        <button className="ghost" disabled={!rows.length} onClick={exportCsv} type="button">
          Exportar CSV
        </button>
      </div>

      {selected.length > 0 ? (
        <div className="bulk-bar">
          <code>
            {selected.length} {selected.length === 1 ? "selecionado" : "selecionados"}
          </code>
          <span className="divider" />
          <button className="link" onClick={() => setBulk("plan")} type="button">
            Trocar plano
          </button>
          <button className="link" onClick={() => setBulk("discount")} type="button">
            Aplicar desconto
          </button>
          <button className="link danger" onClick={() => setBulk("suspend")} type="button">
            Suspender
          </button>
          <div className="spacer" />
          <button className="link muted" onClick={() => setSelected([])} type="button">
            Limpar seleção
          </button>
        </div>
      ) : null}

      <div className="card clip">
        <div className="table-wrap">
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
              {visible.map((est) => {
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
                    <td>{est.category}</td>
                    <td>{planText(est.plan, commission)}</td>
                    <td>
                      <StatusChip chip={statusChip(est)} />
                    </td>
                    <td className="right mono">{count(est.appointmentsMonth)}</td>
                    <td className="right mono">{brl(est.platformRevenueCents)}</td>
                    <td className="right mono muted">{day(est.since)}</td>
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
        </div>
        {rows.length === 0 ? (
          <p className="table-empty">Nenhum estabelecimento com esses filtros.</p>
        ) : null}
        <div className="table-foot">
          <span>
            Mostrando{" "}
            <code>
              {rows.length ? current * PAGE + 1 : 0}–{current * PAGE + visible.length}
            </code>{" "}
            de <code>{count(rows.length)}</code>
          </span>
          <div className="pager">
            <button
              className="ghost small"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              type="button"
            >
              Anterior
            </button>
            <button
              className="ghost small"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              type="button"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {bulk === "plan" ? (
        <PlanDialog
          current={null}
          ids={selected}
          onClose={() => {
            setBulk(null);
            setSelected([]);
          }}
        />
      ) : null}
      {bulk === "discount" ? (
        <DiscountDialog
          ids={selected}
          onClose={() => {
            setBulk(null);
            setSelected([]);
          }}
        />
      ) : null}
      {bulk === "suspend" ? (
        <SuspendDialog
          ids={selected}
          onClose={() => setBulk(null)}
          onDone={() => setSelected([])}
        />
      ) : null}
    </div>
  );
}

function SuspendDialog({
  ids,
  onClose,
  onDone,
}: {
  ids: string[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const { data, actions } = useAdmin();
  const list = data.establishments.filter((e) => ids.includes(e.id));
  const label = list.length === 1 ? list[0]!.name : `${list.length} estabelecimentos`;
  return (
    <TextDialog
      confirmLabel="Suspender"
      danger
      description="O perfil sai da busca do app e ninguém consegue agendar. A agenda já marcada é preservada."
      id="suspend"
      label="Motivo"
      onClose={onClose}
      onConfirm={async (reason) => {
        await actions.suspendEstablishments(ids, reason);
        onDone?.();
      }}
      placeholder="Ex.: 16 dias de inadimplência, sem resposta aos avisos"
      success={{ title: "Suspenso", sub: `${label} saiu da busca do app.` }}
      title={`Suspender ${label}`}
    />
  );
}

type DetailModal = "plan" | "discount" | "suspend" | "contact" | null;

export function EstablishmentDetail({
  estabId,
  onBack,
  onAccess,
  activeAccess,
  canAccessAccount,
  onOpenConsole,
  onOpenTicket,
}: {
  estabId: string;
  onBack: () => void;
  onAccess: () => void;
  activeAccess: AccessSession | null;
  canAccessAccount: boolean;
  onOpenConsole: (session: AccessSession) => void;
  onOpenTicket: (id: string) => void;
}) {
  const { data, actions } = useAdmin();
  const [tab, setTab] = useState<EstabTab>("visão geral");
  const [modal, setModal] = useState<DetailModal>(null);
  const reactivate = useRun();
  const est = data.establishments.find((item) => item.id === estabId);
  if (!est) {
    return (
      <div className="stack detail">
        <button className="back" onClick={onBack} type="button">
          Todos os estabelecimentos
        </button>
        <p className="hint">Este estabelecimento não existe mais.</p>
      </div>
    );
  }

  const commission = data.plans.find((p) => p.kind === "commission")?.commissionPercent ?? 12;
  const invoices = data.invoices.filter((i) => i.establishmentId === est.id);
  const suspended = est.status === "suspended";
  const usageMax = Math.max(1, ...est.usage);
  const recent = est.usage.slice(-1)[0] ?? 0;
  const baseline = est.usage.slice(-7, -1);
  const average = baseline.length ? baseline.reduce((a, b) => a + b, 0) / baseline.length : 0;
  const trend = average ? Math.round(((recent - average) / average) * 100) : 0;
  const months = usageMonths();
  const reviews = data.panorama.find((p) => p.establishmentId === est.id);
  const recentReviews = reviews ? (data.recentReviews[reviews.id] ?? []) : [];
  const tickets = data.tickets.filter((ticket) => ticket.establishmentId === est.id);

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
            <StatusChip chip={statusChip(est)} />
          </div>
          <p className="detail-sub">
            {est.city} · {est.category} · {planText(est.plan, commission)}
            {est.discountPercent ? ` · ${est.discountPercent}% de desconto` : ""} · na plataforma
            desde {day(est.since)}
          </p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setModal("plan")} type="button">
            Trocar plano
          </button>
          <button className="ghost" onClick={() => setModal("discount")} type="button">
            Aplicar desconto
          </button>
          {suspended ? (
            <button
              className="ghost"
              disabled={reactivate.pending}
              onClick={() =>
                void reactivate.run(() => actions.reactivateEstablishment(est.id), {
                  title: "Reativado",
                  sub: `${est.name} voltou a aparecer na busca do app.`,
                })
              }
              type="button"
            >
              Reativar
            </button>
          ) : (
            <button className="ghost danger" onClick={() => setModal("suspend")} type="button">
              Suspender
            </button>
          )}
          {canAccessAccount ? (
            activeAccess ? (
              <button className="primary" onClick={() => onOpenConsole(activeAccess)} type="button">
                Reabrir console
              </button>
            ) : (
              <button className="primary" onClick={onAccess} type="button">
                Registrar acesso
              </button>
            )
          ) : null}
        </div>
      </div>

      {est.risk ? (
        <div className="banner danger">
          <TriangleAlert />
          <span>Sinalizado como risco: {est.risk}</span>
          <div className="spacer" />
          <button className="ghost small danger" onClick={() => setModal("contact")} type="button">
            Registrar contato
          </button>
        </div>
      ) : null}

      {activeAccess ? (
        <div className="banner account-access-active">
          <span className="account-console-lock" aria-hidden="true">
            <svg fill="none" height="15" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
              <path d="M7 10V7a5 5 0 0110 0v3M5 10h14v10H5z" />
            </svg>
          </span>
          <span>
            Sessão somente leitura ativa até {stamp(activeAccess.expiresAt)} · {activeAccess.reason}
          </span>
          <div className="spacer" />
          <button className="ghost small" onClick={() => onOpenConsole(activeAccess)} type="button">
            Abrir console
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
              <code className="kpi-number sm">{count(est.appointmentsMonth)}</code>
              <small className={trend < 0 ? "kpi-note danger" : "kpi-note"}>
                {average
                  ? `${trend > 0 ? "+" : trend < 0 ? "−" : ""}${Math.abs(trend)}% vs. média de 6 meses`
                  : "Sem histórico para comparar"}
              </small>
            </div>
            <div className="card pad">
              <p className="kpi-label">Receita gerada no mês</p>
              <code className="kpi-number sm">{brl(est.platformRevenueCents)}</code>
              <small className="kpi-note">
                {est.plan === "monthly"
                  ? "Mensalidade fixa · sem comissão"
                  : `Comissão de ${commission}%`}
              </small>
            </div>
            <div className="card pad">
              <p className="kpi-label">Pagamento no app</p>
              <code className="kpi-number sm">
                {est.plan === "commission" ? "Ligado" : "Desligado"}
              </code>
              <small className="kpi-note">
                {est.plan === "commission"
                  ? "Obrigatório no plano de comissão"
                  : "Nenhum agendamento gera transação"}
              </small>
            </div>
          </div>

          <div className="detail-split">
            <div className="card pad">
              <h3 className="card-title">Uso da plataforma · 12 meses</h3>
              <div className="usage-bars">
                {est.usage.map((value, i) => {
                  const height = Math.round((value / usageMax) * 92);
                  // mês abaixo de 60% do pico é queda: vermelho, como no canvas
                  const drop = value < usageMax * 0.6;
                  return (
                    <div key={months[i] ?? i} title={`${value} agendamentos`}>
                      <span
                        className={drop ? "bar danger" : "bar"}
                        style={{ height: `${Math.max(2, height)}px` }}
                      />
                      <code>{months[i]}</code>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card pad">
              <h3 className="card-title">Dados cadastrais</h3>
              <div className="field-list">
                <div>
                  <small>CNPJ</small>
                  <code>{est.cnpj}</code>
                </div>
                <div>
                  <small>Endereço</small>
                  <p>{est.address}</p>
                </div>
                <div>
                  <small>Responsável</small>
                  <p>{est.responsible}</p>
                </div>
                <div>
                  <small>Profissionais ativos</small>
                  <code>{est.professionals}</code>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {tab === "cobranças" ? (
        <div className="card clip">
          {invoices.length ? (
            <div className="table-wrap">
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
                  {invoices.map((row) => (
                    <tr key={row.id}>
                      <td className="strong">{competence(row.competence)}</td>
                      <td>
                        <StatusChip
                          chip={
                            row.status === "paid"
                              ? STATUS.paga
                              : row.status === "pending"
                                ? STATUS.pend
                                : { ...STATUS.vencido, label: "Vencida" }
                          }
                        />
                      </td>
                      <td className="right mono">{brl(row.amountCents)}</td>
                      <td className="right mono muted">{row.paidAt ? day(row.paidAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="table-empty">Nenhuma cobrança emitida para este estabelecimento.</p>
          )}
        </div>
      ) : null}

      {tab === "uso da plataforma" ? (
        <div className="card clip">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="right">Agendamentos</th>
                  <th className="right">Variação</th>
                </tr>
              </thead>
              <tbody>
                {est.usage
                  .map((value, i) => ({ value, month: months[i], previous: est.usage[i - 1] }))
                  .reverse()
                  .map((row) => (
                    <tr key={row.month}>
                      <td className="strong">{row.month}</td>
                      <td className="right mono">{count(row.value)}</td>
                      <td className="right mono muted">
                        {row.previous
                          ? `${row.value >= row.previous ? "+" : "−"}${Math.abs(Math.round(((row.value - row.previous) / row.previous) * 100))}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "avaliações" ? (
        reviews && reviews.total > 0 ? (
          <div className="stack tight">
            <div className="kpi-grid three">
              <div className="card pad">
                <p className="kpi-label">Nota média</p>
                <code className="kpi-number sm">{decimal(reviews.average)}</code>
                <small className="kpi-note">{signed(reviews.delta30)} em 30 dias</small>
              </div>
              <div className="card pad">
                <p className="kpi-label">Avaliações</p>
                <code className="kpi-number sm">{count(reviews.total)}</code>
                <small className="kpi-note">{count(reviews.month)} no mês</small>
              </div>
              <div className="card pad">
                <p className="kpi-label">Denúncias abertas pela loja</p>
                <code className="kpi-number sm">{count(reviews.reports)}</code>
                <small className="kpi-note">decididas em Avaliações</small>
              </div>
            </div>
            <div className="card pad">
              <h3 className="card-title">Avaliações recentes</h3>
              {recentReviews.length ? (
                <div className="recent-list">
                  {recentReviews.map((review, i) => (
                    <div key={`${review.who}-${i}`}>
                      <div className="recent-head">
                        <Stars size="sm" value={review.rating} />
                        <code>{decimal(review.rating)}</code>
                        <small>
                          {review.who} · {stamp(review.at).slice(0, 6)}
                        </small>
                      </div>
                      <p>{review.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hint">Nenhuma avaliação nos últimos 30 dias.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-card">
            <DocIcon />
            <strong>Nenhuma avaliação ainda</strong>
            <p>As avaliações aparecem aqui depois do primeiro atendimento avaliado.</p>
          </div>
        )
      ) : null}

      {tab === "chamados" ? (
        !data.supportAccess ? (
          <div className="empty-card">
            <DocIcon />
            <strong>Chamados ficam com Suporte e Operações</strong>
            <p>O seu papel não tem acesso às conversas de suporte desta loja.</p>
          </div>
        ) : tickets.length ? (
          <div className="card clip">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Chamado</th>
                    <th>Situação</th>
                    <th>Prioridade</th>
                    <th>Responsável</th>
                    <th className="right">Última mensagem</th>
                    <th className="chevron" />
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <button
                          className="row-link"
                          onClick={() => onOpenTicket(ticket.id)}
                          type="button"
                        >
                          #{ticket.number} · {ticket.subject}
                        </button>
                        <p className="hint">{ticket.requesterName}</p>
                      </td>
                      <td>{TICKET_STATUS_LABEL[ticket.status]}</td>
                      <td>{TICKET_PRIORITY_LABEL[ticket.priority]}</td>
                      <td>{ticket.assignee ?? "Sem responsável"}</td>
                      <td className="right mono muted">{stamp(ticket.lastMessageAt)}</td>
                      <td className="right">
                        <button
                          aria-label={`Abrir chamado #${ticket.number}`}
                          className="icon-button"
                          onClick={() => onOpenTicket(ticket.id)}
                          type="button"
                        >
                          <ChevronRight />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="empty-card">
            <DocIcon />
            <strong>Nenhum chamado desta loja</strong>
            <p>
              Quando uma pessoa da loja ou um cliente abrir um pedido relacionado, ele aparece aqui.
            </p>
          </div>
        )
      ) : null}

      {modal === "plan" ? (
        <PlanDialog current={est.plan} ids={[est.id]} onClose={() => setModal(null)} />
      ) : null}
      {modal === "discount" ? (
        <DiscountDialog ids={[est.id]} onClose={() => setModal(null)} />
      ) : null}
      {modal === "suspend" ? <SuspendDialog ids={[est.id]} onClose={() => setModal(null)} /> : null}
      {modal === "contact" ? (
        <TextDialog
          confirmLabel="Registrar contato"
          description="Fica no registro de auditoria, junto do sinal de risco que motivou o contato."
          id="contact"
          label="O que foi conversado"
          onClose={() => setModal(null)}
          onConfirm={(note) => actions.registerContact(est.id, note)}
          placeholder="Ex.: dona disse que a queda é reforma da loja; volta em outubro"
          success={{ title: "Contato registrado", sub: `Anotado na ficha de ${est.name}.` }}
          title={`Contato com ${est.name}`}
        />
      ) : null}
    </div>
  );
}
