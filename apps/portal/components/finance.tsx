"use client";

import { money } from "./cadastro-ui";
import { usePortal } from "./store";
import { AMBER_DARK, CORAL, GREEN_DARK, MUTED, MUTED_SOFT, RED, SURFACE_5 } from "./tokens";

/**
 * Financeiro do que existe.
 *
 * Tudo aqui sai de `appointments` com `status = 'completed'` e o `price_cents`
 * congelado no ato da reserva. Repasse, taxa e recebimento pelo app não
 * aparecem: `payments` nunca recebeu uma linha, e uma tabela vazia não vira
 * gráfico bonito (R7).
 */
export function Finance() {
  const { data } = usePortal();
  if (!data) return null;

  const finance = data.finance;
  const canSee = data.establishment.role !== "staff";
  if (!canSee) {
    return (
      <section className="empty-section">
        <span aria-hidden="true">!</span>
        <h2>Acesso restrito</h2>
        <p>O faturamento da loja é visível para dono e gerente.</p>
      </section>
    );
  }

  const peak = Math.max(1, ...finance.months.map((month) => month.cents));
  const delta =
    finance.previousCents === 0
      ? null
      : Math.round(((finance.monthCents - finance.previousCents) / finance.previousCents) * 100);
  const totalTop = finance.topServices.reduce((sum, item) => sum + item.cents, 0);

  return (
    <div className="page">
      <section
        className="kpis"
        style={{ "--gc": "repeat(4,minmax(0,1fr))" } as React.CSSProperties}
      >
        <article>
          <span>Faturamento do mês</span>
          <strong>{money(finance.monthCents)}</strong>
          <div>
            <b style={{ color: delta === null ? MUTED : delta >= 0 ? GREEN_DARK : RED }}>
              {delta === null ? "sem base" : `${delta >= 0 ? "+" : ""}${delta}%`}
            </b>
            <small>mês passado: {money(finance.previousCents)}</small>
          </div>
        </article>
        <article>
          <span>Atendimentos concluídos</span>
          <strong>{finance.monthCount}</strong>
          <div>
            <b style={{ color: MUTED }}>no mês</b>
            <small>
              {finance.queueCompleted} {finance.queueCompleted === 1 ? "veio" : "vieram"} da fila
            </small>
          </div>
        </article>
        <article>
          <span>Ticket médio</span>
          <strong>{money(finance.ticketCents)}</strong>
          <div>
            <b style={{ color: MUTED }}>preço congelado na reserva</b>
            <small>não é o preço da tabela de hoje</small>
          </div>
        </article>
        <article>
          <span>Sinal preso em reservas futuras</span>
          <strong>{money(finance.scheduledDepositCents)}</strong>
          <div>
            <b style={{ color: AMBER_DARK }}>calculado, não cobrado</b>
            <small>depende do provedor de pagamento</small>
          </div>
        </article>
      </section>

      <section className="chart-card">
        <header>
          <h2>Faturamento dos últimos seis meses</h2>
          <code>atendimentos concluídos, preço congelado na reserva</code>
        </header>
        {finance.months.every((month) => month.cents === 0) ? (
          <p className="empty-state" style={{ padding: 20 }}>
            Nenhum atendimento concluído nos últimos seis meses. O gráfico enche sozinho quando a
            equipe marcar as reservas como concluídas.
          </p>
        ) : (
          <div className="chart-bars">
            {finance.months.map((month, index) => (
              <div
                key={index}
                title={`${month.label} · ${money(month.cents)} · ${month.count} atend.`}
              >
                <i
                  style={{
                    height: `${Math.round((month.cents / peak) * 100)}%`,
                    background: index === finance.months.length - 1 ? CORAL : "#C4C6C9",
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <footer>
          {finance.months.map((month, index) => (
            <span key={index}>{month.label}</span>
          ))}
        </footer>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Por profissional</h2>
          <span>mês corrente</span>
        </header>
        {finance.byProfessional.length === 0 ? (
          <p className="empty-state" style={{ padding: 20 }}>
            Nenhum atendimento concluído neste mês.
          </p>
        ) : (
          <div className="table-scroll">
            <div
              className="table-head block-table"
              style={{ "--gc": "1.8fr .8fr 1fr 1fr" } as React.CSSProperties}
            >
              <div>PROFISSIONAL</div>
              <div style={{ textAlign: "right" }}>ATEND.</div>
              <div style={{ textAlign: "right" }}>TICKET</div>
              <div style={{ textAlign: "right" }}>FATUROU</div>
            </div>
            {finance.byProfessional.map((row) => (
              <div
                className="table-row block-table"
                key={row.name}
                style={{ "--gc": "1.8fr .8fr 1fr 1fr" } as React.CSSProperties}
              >
                <div className="table-cell">
                  <div style={{ fontWeight: 600 }}>{row.name}</div>
                </div>
                <div className="table-cell" style={{ textAlign: "right" }}>
                  <div>{row.count}</div>
                </div>
                <div className="table-cell" style={{ textAlign: "right" }}>
                  <div>{money(Math.round(row.cents / row.count))}</div>
                </div>
                <div className="table-cell" style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 600 }}>{money(row.cents)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Serviços mais vendidos</h2>
          <span>e o quanto cada um pesa no mês</span>
        </header>
        {finance.topServices.length === 0 ? (
          <p className="empty-state" style={{ padding: 20 }}>
            Nenhum atendimento concluído neste mês.
          </p>
        ) : (
          <div className="table-scroll">
            <div
              className="table-head block-table"
              style={{ "--gc": "2fr .8fr 1fr .9fr 1.4fr" } as React.CSSProperties}
            >
              <div>SERVIÇO</div>
              <div style={{ textAlign: "right" }}>VEZES</div>
              <div style={{ textAlign: "right" }}>FATUROU</div>
              <div style={{ textAlign: "right" }}>% DO MÊS</div>
              <div />
            </div>
            {finance.topServices.map((row) => {
              const share = totalTop === 0 ? 0 : Math.round((row.cents / totalTop) * 100);
              return (
                <div
                  className="table-row block-table"
                  key={row.name}
                  style={{ "--gc": "2fr .8fr 1fr .9fr 1.4fr" } as React.CSSProperties}
                >
                  <div className="table-cell">
                    <div style={{ fontWeight: 600 }}>{row.name}</div>
                  </div>
                  <div className="table-cell" style={{ textAlign: "right" }}>
                    <div>{row.count}</div>
                  </div>
                  <div className="table-cell" style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600 }}>{money(row.cents)}</div>
                  </div>
                  <div className="table-cell" style={{ textAlign: "right" }}>
                    <div>{share}%</div>
                  </div>
                  <div className="table-cell">
                    <div className="cell-bar">
                      <i style={{ background: MUTED_SOFT, width: `${share}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <footer className="card-foot" style={{ background: SURFACE_5 }}>
          Não há linha de repasse, taxa ou recebimento pelo app: a Vez ainda não escolheu o provedor
          de pagamento, e nenhum dinheiro passa por ela hoje. O que a loja recebe no balcão não
          entra aqui — o portal só sabe o que foi vendido pelo app.
        </footer>
      </section>
    </div>
  );
}
