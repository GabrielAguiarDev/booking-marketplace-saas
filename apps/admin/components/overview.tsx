"use client";

import { ChevronRight, QuotaCells } from "./blocks";
import { type NavId } from "./data";
import { brlWhole, count, waited } from "./model";
import { useAdmin } from "./store";
import { AMBER, GREEN, INK, MUTED, RED } from "./tokens";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Overview({ go }: { go: (id: NavId) => void }) {
  const { data } = useAdmin();
  const series = data.overview.series.slice(-6);
  const revenue = series.map((point) => point.monthlyCents + point.commissionCents);
  const currentPoint = series.at(-1);
  const currentRevenue = revenue.at(-1) ?? 0;
  const previousRevenue = revenue.at(-2) ?? 0;
  const revenueDelta = previousRevenue
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
    : null;
  const monthlyRevenue = currentPoint?.monthlyCents ?? 0;
  const commissionRevenue = currentPoint?.commissionCents ?? 0;
  const monthlyShare = currentRevenue ? (monthlyRevenue / currentRevenue) * 100 : 0;
  const paidShare = data.overview.appointmentsMonth
    ? (data.overview.paidInAppMonth / data.overview.appointmentsMonth) * 100
    : 0;

  const step = 620 / Math.max(series.length, 1);
  const maxRevenue = Math.max(...revenue, 1);
  const maxVolume = Math.max(...series.map((point) => point.appointments), 1);
  const dots = revenue.map((value, index) => ({
    x: Math.round(step * index + step / 2),
    y: Math.round(160 - (value / maxRevenue) * 140),
  }));
  const bars = series.map((point, index) => {
    const height = Math.round((point.appointments / maxVolume) * 140);
    return { x: Math.round(step * index + step / 2 - 23), y: 160 - height, height };
  });
  const line = dots.map((dot) => `${dot.x},${dot.y}`).join(" ");
  const months = series.map((point) =>
    new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
      .format(new Date(point.month))
      .replace(".", ""),
  );

  const oldest = data.applications
    .map((a) => a.submittedAt)
    .sort()
    .at(0);
  const overdue = data.invoices.filter((i) => i.status === "overdue");
  const overdueCents = overdue.reduce((sum, i) => sum + i.amountCents, 0);
  const supportQueue = data.tickets.filter((ticket) => ticket.status !== "resolved");
  const highPriorityTickets = supportQueue.filter((ticket) => ticket.priority === "high");

  const queue = [
    {
      count: String(data.applications.length),
      label: "Aprovações aguardando",
      meta: oldest ? `mais antiga há ${waited(oldest)}` : "fila vazia",
      tone: AMBER,
      to: "approvals" as const,
    },
    {
      count: String(supportQueue.length),
      label: "Chamados de suporte",
      meta: highPriorityTickets.length
        ? plural(highPriorityTickets.length, "com prioridade alta", "com prioridade alta")
        : supportQueue.length
          ? "nenhum com prioridade alta"
          : "nenhum na fila",
      tone: highPriorityTickets.length ? RED : INK,
      to: "support" as const,
    },
    {
      count: String(data.reports.length),
      label: "Avaliações denunciadas",
      meta: data.reports.length ? "aguardando decisão" : "nenhuma na fila",
      tone: MUTED,
      to: "reviews" as const,
    },
    {
      count: String(overdue.length),
      label: "Cobranças vencidas",
      meta: overdue.length ? `${brlWhole(overdueCents)} em atraso` : "nada em atraso",
      tone: RED,
      to: "finance" as const,
    },
  ];

  const quotaCities = data.cities
    .filter((c) => c.quotaTotal > 0 && c.status === "active")
    .slice(0, 6);

  return (
    <div className="stack">
      <section>
        <div className="section-head">
          <h2>Fila de trabalho</h2>
          <span>Atualizado agora</span>
        </div>
        <div className="queue-grid">
          {queue.map((item) => (
            <button
              className="queue-card"
              key={item.label}
              onClick={() => go(item.to)}
              style={{ borderLeftColor: item.tone }}
              type="button"
            >
              <div>
                <code style={{ color: item.tone }}>{item.count}</code>
                <strong>{item.label}</strong>
                <small>{item.meta}</small>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
      </section>

      <section className="kpi-grid">
        <div className="card pad">
          <p className="kpi-label">Receita recorrente mensal</p>
          <div className="kpi-value">
            <code>{brlWhole(currentRevenue)}</code>
            {revenueDelta === null ? null : (
              <code className={revenueDelta >= 0 ? "delta up" : "delta down"}>
                {revenueDelta >= 0 ? "+" : ""}
                {revenueDelta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </code>
            )}
          </div>
          <div className="split-bar">
            <span style={{ width: `${monthlyShare}%`, background: INK }} />
            <span style={{ width: `${100 - monthlyShare}%`, background: "var(--coral)" }} />
          </div>
          <div className="legend">
            <span>
              <i style={{ background: INK }} />
              Mensalidade
              <code>{brlWhole(monthlyRevenue)}</code>
            </span>
            <span>
              <i style={{ background: "var(--coral)" }} />
              Comissão
              <code>{brlWhole(commissionRevenue)}</code>
            </span>
          </div>
        </div>

        <div className="card pad">
          <p className="kpi-label">Estabelecimentos ativos</p>
          <code className="kpi-number">{count(data.overview.activeEstablishments)}</code>
          <div className="kpi-foot">
            <div>
              <code style={{ color: GREEN }}>+{count(data.overview.approvedMonth)}</code>
              <small>Aprovados no mês</small>
            </div>
            <div>
              <code style={{ color: RED }}>−{count(data.overview.suspendedMonth)}</code>
              <small>Suspensos no mês</small>
            </div>
          </div>
        </div>

        <div className="card pad">
          <p className="kpi-label">Agendamentos no mês</p>
          <code className="kpi-number">{count(data.overview.appointmentsMonth)}</code>
          <div className="kpi-foot column">
            <p className="inline-stat">
              <code>{paidShare.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</code>
              <span>passaram pelo pagamento integrado</span>
            </p>
            <div className="split-bar thin">
              <span style={{ width: `${paidShare}%`, background: "var(--coral)" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="chart-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Receita e volume de agendamentos</h3>
              <small className="hint">Estimativa pelo plano atual, com descontos vigentes</small>
            </div>
            <div className="chart-legend">
              <span>
                <i className="line" />
                Receita
              </span>
              <span>
                <i className="square" />
                Agendamentos
              </span>
            </div>
          </div>
          <div className="chart-body">
            <svg height="180" preserveAspectRatio="none" viewBox="0 0 620 180" width="100%">
              <line stroke="#F2F2F3" x1="0" x2="620" y1="10" y2="10" />
              <line stroke="#F2F2F3" x1="0" x2="620" y1="60" y2="60" />
              <line stroke="#F2F2F3" x1="0" x2="620" y1="110" y2="110" />
              <line stroke="#ECECEC" x1="0" x2="620" y1="160" y2="160" />
              {bars.map((bar, i) => (
                <rect
                  fill="#EDEEEF"
                  height={bar.height}
                  key={i}
                  rx="2"
                  width="46"
                  x={bar.x}
                  y={bar.y}
                />
              ))}
              <polyline
                fill="none"
                points={line}
                stroke="var(--coral)"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              {dots.map((dot, i) => (
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  fill="#FFFFFF"
                  key={i}
                  r="3.5"
                  stroke="var(--coral)"
                  strokeWidth="2"
                />
              ))}
            </svg>
            <div className="chart-months">
              {months.map((month, index) => (
                <code key={`${series[index]?.month}-${month}`}>{month}</code>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h3>Vagas de mensalidade por cidade</h3>
              <p>Cada célula é uma vaga. Preenchida = ocupada.</p>
            </div>
            <button className="ghost small" onClick={() => go("quotas")} type="button">
              Gerir cotas
            </button>
          </div>
          <div className="quota-list">
            {quotaCities.map((city) => {
              const left = city.quotaTotal - city.quotaUsed;
              const tone = left === 0 ? RED : left <= 3 ? AMBER : GREEN;
              return (
                <div className="quota-row" key={city.id}>
                  <div className="quota-name">
                    <strong>{city.name}</strong>
                    <small style={{ color: tone }}>
                      {left === 0 ? "esgotada · só comissão" : `${left} vagas restantes`}
                    </small>
                  </div>
                  <QuotaCells size="sm" total={city.quotaTotal} used={city.quotaUsed} />
                  <code className="quota-ratio">
                    {city.quotaUsed}/{city.quotaTotal}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
