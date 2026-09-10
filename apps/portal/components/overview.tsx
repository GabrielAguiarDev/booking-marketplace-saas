"use client";

import { useState } from "react";

import { HOUR_RULER, type SectionId } from "./data";
import type { Notify } from "./portal";
import { AMBER, AMBER_LINE, GREEN, INK, RED, RED_LINE } from "./tokens";

const KPIS = [
  { label: "Atendimentos hoje", value: "19", delta: "+3", fg: GREEN, note: "de 24 vagas do dia" },
  {
    label: "Faturamento hoje",
    value: "R$ 1.480",
    delta: "+12%",
    fg: GREEN,
    note: "média de terça: R$ 1.320",
  },
  {
    label: "Ocupação da agenda",
    value: "78%",
    delta: "−4%",
    fg: AMBER,
    note: "2h15 livres até 20:00",
  },
  { label: "Na fila agora", value: "5", delta: "21min", fg: AMBER, note: "espera média de hoje" },
  { label: "Não comparecimento", value: "6,2%", delta: "+1,8", fg: RED, note: "últimos 30 dias" },
];

const ALERTS: {
  tag: string;
  title: string;
  text: string;
  action: string;
  to: SectionId;
  fg: string;
  bd: string;
}[] = [
  {
    tag: "CONFLITO",
    title: "Dois agendamentos às 16:30 com o Bruno",
    text: "Alguém marcou pelo app enquanto você lançava no balcão.",
    action: "Resolver na agenda",
    to: "agenda",
    fg: RED,
    bd: RED_LINE,
  },
  {
    tag: "COBRANÇA",
    title: "Assinatura com pendência",
    text: "O cartão foi recusado na cobrança de 05/09.",
    action: "Atualizar pagamento",
    to: "billing",
    fg: AMBER,
    bd: AMBER_LINE,
  },
];

const PENDING = [
  {
    customer: "Marcos Vieira",
    note: "cliente desde 2024 · 18 visitas",
    service: "Corte + barba",
    pro: "Bruno",
    dur: "50min",
    when: "hoje 17:30",
    value: "R$ 90",
  },
  {
    customer: "Diego Salles",
    note: "primeira vez aqui",
    service: "Corte social",
    pro: "Léo",
    dur: "30min",
    when: "qua 09:00",
    value: "R$ 55",
  },
  {
    customer: "Henrique Paz",
    note: "2 faltas nos últimos 6 meses",
    service: "Barba na navalha",
    pro: "Bruno",
    dur: "30min",
    when: "qua 11:30",
    value: "R$ 45",
  },
  {
    customer: "Tiago Ramos",
    note: "sinal de R$ 20 já pago",
    service: "Platinado",
    pro: "Ana",
    dur: "1h40",
    when: "qui 14:00",
    value: "R$ 210",
  },
];

const TRACK_STYLE = {
  booked: { bg: "#F2F2F3", bd: "#E4E5E6", fg: "#3F4347" },
  now: { bg: "#FFF1ED", bd: "#FFCDC0", fg: "#D9451F" },
  blocked: { bg: "#FAFAFB", bd: "#DCDCDE", fg: "#A2A5A9" },
} as const;

type BlockType = keyof typeof TRACK_STYLE;

const slot = (left: number, width: number, label: string, type: BlockType) => ({
  left,
  width,
  label,
  short: width >= 24 ? label : width >= 8 ? label.slice(0, 5) : "",
  show: width >= 8,
  ...TRACK_STYLE[type],
});

const TRACKS = [
  {
    name: "Bruno",
    blocks: [
      slot(0, 12, "08:00 Corte", "booked"),
      slot(13, 8, "09:30 Barba", "booked"),
      slot(33, 8, "12:00 Almoço", "blocked"),
      slot(46, 14, "13:30 Corte+barba", "now"),
      slot(75, 12, "17:00 Corte", "booked"),
    ],
  },
  {
    name: "Léo",
    blocks: [
      slot(4, 8, "08:30 Corte", "booked"),
      slot(25, 12, "11:00 Corte", "booked"),
      slot(50, 8, "14:00 Barba", "now"),
      slot(62, 20, "15:30 Coloração", "booked"),
    ],
  },
  {
    name: "Ana",
    blocks: [
      slot(0, 20, "08:00 Luzes", "booked"),
      slot(33, 8, "12:00 Almoço", "blocked"),
      slot(58, 16, "15:00 Platinado", "booked"),
    ],
  },
  {
    name: "Sérgio",
    blocks: [
      slot(8, 10, "09:00 Corte", "booked"),
      slot(29, 30, "11:30 Folga", "blocked"),
      slot(70, 14, "16:30 Corte+barba", "booked"),
    ],
  },
];

const WEEKS = [3.9, 4.2, 4.0, 4.6, 4.3, 5.1, 4.8, 5.4].map((revenue, i) => {
  const height = Math.round(46 + revenue * 11);
  return {
    week: `s${31 + i}`,
    revenue: `R$ ${revenue.toFixed(1).replace(".", ",")}k`,
    height,
    line: height - Math.round(revenue * 9),
  };
});

const QUEUE_PREVIEW = [
  {
    pos: "1",
    name: "Caio Bertoldo",
    service: "Corte social",
    origin: "QR code no balcão",
    wait: "31min",
    fg: RED,
  },
  { pos: "2", name: "Everton Lima", service: "Barba", origin: "balcão", wait: "18min", fg: AMBER },
  {
    pos: "3",
    name: "Rui Antunes",
    service: "Corte + barba",
    origin: "app remoto",
    wait: "9min",
    fg: INK,
  },
];

type Pending = (typeof PENDING)[number];

export function Overview({ go, notify }: { go: (section: SectionId) => void; notify: Notify }) {
  const [pending, setPending] = useState<Pending[]>(PENDING);

  /** Aprovar e recusar tiram a reserva da lista; o aviso de 5s permite voltar atrás. */
  const decide = (item: Pending, index: number, approved: boolean) => {
    setPending((list) => list.filter((p) => p.customer !== item.customer));
    notify({
      title: approved ? "Reserva aprovada" : "Reserva recusada",
      sub: approved
        ? `${item.customer} foi avisado pelo app. ${item.when}, ${item.service}.`
        : `${item.customer} foi avisado e o horário voltou a ficar livre.`,
      undo: () =>
        setPending((list) => {
          const next = list.slice();
          next.splice(Math.min(index, next.length), 0, item);
          return next;
        }),
    });
  };

  return (
    <div className="page">
      <section className="overview-kpis">
        {KPIS.map((k) => (
          <article key={k.label}>
            <span>{k.label}</span>
            <div>
              <strong>{k.value}</strong>
              <b style={{ color: k.fg }}>{k.delta}</b>
            </div>
            <small>{k.note}</small>
          </article>
        ))}
      </section>

      <div className="alerts">
        {ALERTS.map((a) => (
          <div
            className="alert"
            key={a.tag}
            style={{ borderColor: a.bd, borderLeft: `3px solid ${a.fg}` }}
          >
            <code style={{ color: a.fg }}>{a.tag}</code>
            <strong>{a.title}</strong>
            <span>{a.text}</span>
            <button onClick={() => go(a.to)} type="button">
              {a.action}
            </button>
          </div>
        ))}
      </div>

      <div className="overview-grid">
        <div>
          <section className="panel">
            <header className="panel-head">
              <h2>Aguardando sua aprovação</h2>
              <b className="count">{pending.length}</b>
              <span>Aprovação manual está ligada</span>
            </header>
            <div className="table-scroll">
              <div className="table-head pending-grid">
                <div>CLIENTE</div>
                <div>SERVIÇO</div>
                <div>QUANDO</div>
                <div style={{ textAlign: "right" }}>VALOR</div>
                <div />
              </div>
              {pending.length === 0 ? (
                <p className="queue-empty">Nenhuma reserva esperando aprovação.</p>
              ) : null}
              {pending.map((p, index) => (
                <div className="table-row pending-grid" key={p.customer}>
                  <div>
                    <strong>{p.customer}</strong>
                    <small>{p.note}</small>
                  </div>
                  <div>
                    <span>{p.service}</span>
                    <code>
                      {p.pro} · {p.dur}
                    </code>
                  </div>
                  <code>{p.when}</code>
                  <code className="right">{p.value}</code>
                  <div className="row-actions">
                    <button
                      className="primary small"
                      onClick={() => decide(p, index, true)}
                      type="button"
                    >
                      Aprovar
                    </button>
                    <button
                      className="ghost small danger-hover"
                      onClick={() => decide(p, index, false)}
                      type="button"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel padded">
            <header className="inline-head">
              <h2>Hoje, hora por hora</h2>
              <span>Os vãos claros são horários que você ainda pode vender.</span>
              <code>2h15 livres</code>
            </header>
            <div className="tracks">
              {TRACKS.map((t) => (
                <div className="track" key={t.name}>
                  <strong>{t.name}</strong>
                  <div className="track-bar">
                    {t.blocks.map((b) => (
                      <div
                        key={`${t.name}-${b.left}`}
                        style={{
                          left: `${b.left}%`,
                          width: `${b.width}%`,
                          background: b.bg,
                          borderColor: b.bd,
                        }}
                        title={b.label}
                      >
                        {b.show ? <span style={{ color: b.fg }}>{b.short}</span> : null}
                      </div>
                    ))}
                    <i className="now-line" />
                  </div>
                </div>
              ))}
              <div className="track-ruler">
                {HOUR_RULER.map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div>
          <section className="panel padded">
            <header className="inline-head">
              <h2>Últimas 8 semanas</h2>
              <div className="chart-legend">
                <span>
                  <i className="swatch-bar" />
                  agendamentos
                </span>
                <span>
                  <i className="swatch-line" />
                  faturamento
                </span>
              </div>
            </header>
            <div className="weeks">
              {WEEKS.map((w) => (
                <div key={w.week}>
                  <code>{w.revenue}</code>
                  <i style={{ height: w.height }}>
                    <b style={{ top: w.line }} />
                  </i>
                  <small>{w.week}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <h2>Na fila agora</h2>
              <button className="link" onClick={() => go("queue")} type="button">
                Abrir fila
              </button>
            </header>
            {QUEUE_PREVIEW.map((q) => (
              <div className="queue-preview" key={q.pos}>
                <code>{q.pos}</code>
                <div>
                  <strong>{q.name}</strong>
                  <small>
                    {q.service} · {q.origin}
                  </small>
                </div>
                <code style={{ color: q.fg }}>{q.wait}</code>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
