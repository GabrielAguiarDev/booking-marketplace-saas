"use client";

import { ChevronRight, QuotaCells } from "./blocks";
import {
  CHART_MONTHS,
  CITY_QUOTA,
  REVENUE_SERIES,
  VOLUME_SERIES,
  type NavId,
} from "./data";
import { AMBER, GREEN, INK, MUTED, RED } from "./tokens";

/** Geometria do gráfico combinado — mesmos números do canvas. */
const STEP = 620 / 6;
const MAX_REVENUE = 230;
const MAX_VOLUME = 13;

const DOTS = REVENUE_SERIES.map((value, i) => ({
  x: Math.round(STEP * i + STEP / 2),
  y: Math.round(160 - (value / MAX_REVENUE) * 140),
}));

const BARS = VOLUME_SERIES.map((value, i) => {
  const h = Math.round((value / MAX_VOLUME) * 140);
  return { x: Math.round(STEP * i + STEP / 2 - 23), y: 160 - h, h };
});

const LINE = DOTS.map((dot) => `${dot.x},${dot.y}`).join(" ");

export function Overview({ go, queueCount }: { go: (id: NavId) => void; queueCount: number }) {
  const queue = [
    { count: "7", label: "Aprovações aguardando", meta: "mais antiga há 2d 4h", tone: AMBER, to: "approvals" as const },
    { count: "5", label: "Chamados de suporte", meta: "2 com prioridade alta", tone: INK, to: "support" as const },
    { count: String(queueCount), label: "Avaliações denunciadas", meta: "aguardando decisão", tone: MUTED, to: "reviews" as const },
    { count: "4", label: "Cobranças vencidas", meta: "R$ 3.160 em atraso", tone: RED, to: "finance" as const },
  ];

  return (
    <div className="stack">
      <section>
        <div className="section-head">
          <h2>Fila de trabalho</h2>
          <span>Atualizado há 2 min</span>
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
            <code>R$ 214.380</code>
            <code className="delta up">+8,1%</code>
          </div>
          <div className="split-bar">
            <span style={{ width: "64%", background: INK }} />
            <span style={{ width: "36%", background: "var(--coral)" }} />
          </div>
          <div className="legend">
            <span>
              <i style={{ background: INK }} />
              Mensalidade
              <code>R$ 137.200</code>
            </span>
            <span>
              <i style={{ background: "var(--coral)" }} />
              Comissão
              <code>R$ 77.180</code>
            </span>
          </div>
        </div>

        <div className="card pad">
          <p className="kpi-label">Estabelecimentos ativos</p>
          <code className="kpi-number">1.284</code>
          <div className="kpi-foot">
            <div>
              <code style={{ color: GREEN }}>+47</code>
              <small>Novos no mês</small>
            </div>
            <div>
              <code style={{ color: RED }}>−12</code>
              <small>Cancelamentos</small>
            </div>
          </div>
        </div>

        <div className="card pad">
          <p className="kpi-label">Agendamentos no mês</p>
          <code className="kpi-number">121.043</code>
          <div className="kpi-foot column">
            <p className="inline-stat">
              <code>38,4%</code>
              <span>passaram pelo pagamento integrado</span>
            </p>
            <div className="split-bar thin">
              <span style={{ width: "38.4%", background: "var(--coral)" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="chart-grid">
        <div className="card">
          <div className="card-head">
            <h3>Receita e volume de agendamentos</h3>
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
              {BARS.map((bar, i) => (
                <rect fill="#EDEEEF" height={bar.h} key={i} rx="2" width="46" x={bar.x} y={bar.y} />
              ))}
              <polyline
                fill="none"
                points={LINE}
                stroke="var(--coral)"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              {DOTS.map((dot, i) => (
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
              {CHART_MONTHS.map((month) => (
                <code key={month}>{month}</code>
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
            {CITY_QUOTA.map((city) => {
              const left = city.total - city.used;
              const tone = left === 0 ? RED : left <= 3 ? AMBER : GREEN;
              return (
                <div className="quota-row" key={city.name}>
                  <div className="quota-name">
                    <strong>{city.name}</strong>
                    <small style={{ color: tone }}>
                      {left === 0 ? "esgotada · só comissão" : `${left} vagas restantes`}
                    </small>
                  </div>
                  <QuotaCells size="sm" total={city.total} used={city.used} />
                  <code className="quota-ratio">
                    {city.used}/{city.total}
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
