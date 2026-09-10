"use client";

import { useState } from "react";

import {
  appointmentsOf,
  CUSTOMERS,
  DAY_HOURS,
  findService,
  hourLabel,
  ICON_BLOCKED,
  ICON_PAID,
  KIND_STYLE,
  occupancy,
  pro,
  PROS,
  WEEK_DAYS,
  type Appointment,
  type AppointmentKind,
  type Created,
} from "./data";
import type { Notify } from "./portal";
import { AMBER, CORAL, FAINT, GREEN, GREEN_DARK, INK, MONO, MUTED, SANS } from "./tokens";

export type AgendaView = "day" | "week" | "team";

export type NewAppointmentSeed = {
  origin: string;
  pro: number | null;
  day: number;
  hour: number | null;
};

/** O que o painel lateral mostra: um bloco da grade, identificado por dia, pessoa e hora. */
export type Selection = {
  key: string;
  day: number;
  pro: number;
  start: number;
  dur: number;
  customer: string;
  service: string;
  kind: AppointmentKind;
};

/** O que a equipe fez com um bloco nesta sessão. Cancelado some da grade. */
type Change = "confirmed" | "done" | "noshow" | "cancelled";

const keyOf = (day: number, proIndex: number, start: number) => `${day}:${proIndex}:${start}`;

type Placed = {
  selection: Selection;
  top: number;
  height: number;
  bg: string;
  bd: string;
  fg: string;
  icon: string | null;
  hour: string;
  customer: string;
  service: string;
  compact: boolean;
  showHour: boolean;
  showName: boolean;
  showService: boolean;
  pad: string;
  tip: string;
  fresh: boolean;
};

function place(
  items: Appointment[],
  narrow: boolean,
  day: number,
  proIndex: number,
  changes: Record<string, Change>,
  serviceFilter: string,
): Placed[] {
  return applyChanges(items, day, proIndex, changes, serviceFilter).map((a) => {
    // colunas de semana têm ~100px: nome encurtado e, nos blocos de 30min, sem a hora
    const parts = a.customer.split(" ");
    const name =
      narrow && parts.length > 1 ? `${parts[0]} ${(parts[1] ?? "").charAt(0)}.` : a.customer;
    const style = KIND_STYLE[a.kind];
    const end = a.start + a.dur;
    return {
      selection: {
        key: keyOf(day, proIndex, a.start),
        day,
        pro: proIndex,
        start: a.start,
        dur: a.dur,
        customer: a.customer,
        service: a.service,
        kind: a.kind,
      },
      top: Math.round(a.start * 60) + 2,
      height: Math.round(a.dur * 60) - 5,
      bg: style.bg,
      bd: style.bd,
      fg: style.fg,
      icon: style.icon,
      hour: hourLabel(a.start),
      customer: name,
      service: a.service,
      // bloco de 30min tem 25px: hora e nome dividem uma única linha
      compact: a.dur < 1,
      showHour: !(narrow && a.dur < 1),
      showName: a.dur >= 1,
      showService: a.dur >= 1.5 && !narrow,
      pad: a.dur < 1 ? "3px 8px" : "5px 8px",
      tip: `${hourLabel(a.start)} — ${hourLabel(end)} · ${a.customer} · ${a.service}`,
      fresh: !!a.fresh,
    };
  });
}

function applyChanges(
  items: Appointment[],
  day: number,
  proIndex: number,
  changes: Record<string, Change>,
  serviceFilter: string,
): Appointment[] {
  const out: Appointment[] = [];
  for (const a of items) {
    // bloqueio não é serviço: continua visível com qualquer filtro
    if (serviceFilter !== "all" && a.kind !== "blocked" && a.service !== serviceFilter) continue;
    const change = changes[keyOf(day, proIndex, a.start)];
    if (change === "cancelled") continue;
    if (change === "done") out.push({ ...a, kind: "done" });
    else if (change === "noshow") out.push({ ...a, kind: "noshow" });
    else if (change === "confirmed" && a.kind === "pending") out.push({ ...a, kind: "ok" });
    else out.push(a);
  }
  return out;
}

function withCreated(day: number, proIndex: number, created: Created[], flash: Created | null) {
  const extras: Appointment[] = created
    .filter((c) => c.day === day && c.pro === proIndex)
    .map((c) => ({
      start: c.start,
      dur: c.dur,
      kind: c.blocked ? ("blocked" as const) : ("ok" as const),
      customer: c.customer,
      service: c.service,
      fresh: !!(flash && flash.day === day && flash.pro === proIndex && flash.start === c.start),
    }));
  return appointmentsOf(day, proIndex).concat(extras);
}

function occupancyColor(value: number): string {
  if (!value) return FAINT;
  if (value > 80) return GREEN_DARK;
  if (value < 60) return AMBER;
  return MUTED;
}

const LEGEND = [
  { label: "confirmado", bg: "#F2F2F3", bd: "#E4E5E6" },
  { label: "aguardando aprovação", bg: "#FFFBF0", bd: "#EFDFB0" },
  { label: "conflito", bg: "#FEF3F2", bd: "#F2C7C2" },
];

const STATUS_LABEL: Record<AppointmentKind, string> = {
  ok: "Confirmado",
  paid: "Confirmado · sinal pago",
  pending: "Aguardando aprovação",
  conflict: "Conflito de horário",
  blocked: "Período bloqueado",
  done: "Atendimento concluído",
  noshow: "Não compareceu",
};

const DOW_FULL: Record<string, string> = {
  Seg: "segunda",
  Ter: "terça",
  Qua: "quarta",
  Qui: "quinta",
  Sex: "sexta",
  Sáb: "sábado",
};

/** No protótipo, "hoje" é a terça 8 — a coluna com a linha do agora. */
const TODAY = 1;

function dayLabel(day: number): string {
  const d = WEEK_DAYS[day];
  if (!d) return "";
  return `${DOW_FULL[d.dow] ?? d.dow}, ${Number(d.day)} de setembro`;
}

const brl = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** O agendamento que o canvas abre no painel: a reserva do Marcos, esperando aprovação. */
const SEED: Selection = {
  key: "seed",
  day: TODAY,
  pro: 0,
  start: 9.5,
  dur: 1.5,
  customer: "Marcos Vieira",
  service: "Corte + barba",
  kind: "pending",
};

const DETAIL_ROWS = [
  { k: "Quando", v: "hoje, 17:30 — 18:20", ff: MONO, fg: INK },
  { k: "Serviço", v: "Corte + barba", ff: SANS, fg: INK },
  { k: "Profissional", v: "Bruno", ff: SANS, fg: INK },
  { k: "Valor", v: "R$ 90,00", ff: MONO, fg: INK },
  { k: "Sinal", v: "R$ 20,00 pago no app", ff: MONO, fg: GREEN },
  { k: "Restante", v: "R$ 70,00 no balcão", ff: MONO, fg: AMBER },
];

const DETAIL_SUMMARY = [
  { k: "visitas em 12 meses", v: "12", fg: INK },
  { k: "faltas", v: "1", fg: AMBER },
  { k: "gasto no ano", v: "R$ 980", fg: INK },
];

const DETAIL_HISTORY = [
  { date: "12 ago", service: "Corte + barba", value: "R$ 90" },
  { date: "22 jul", service: "Corte social", value: "R$ 55" },
  { date: "28 jun", service: "Corte + barba", value: "R$ 85" },
];

function Glyph({ d, color }: { d: string; color: string }) {
  return (
    <svg fill="none" height="12" stroke={color} viewBox="0 0 16 16" width="12">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function Agenda({
  view,
  setView,
  weekPro,
  setWeekPro,
  created,
  flash,
  openNew,
  notify,
  onBlock,
}: {
  view: AgendaView;
  setView: (view: AgendaView) => void;
  weekPro: string;
  setWeekPro: (name: string) => void;
  created: Created[];
  flash: Created | null;
  openNew: (seed: NewAppointmentSeed) => void;
  notify: Notify;
  onBlock: (period: Created) => void;
}) {
  const proIndex = Math.max(
    0,
    PROS.findIndex((p) => p.name === weekPro),
  );

  const [dayIndex, setDayIndex] = useState(TODAY);
  const [selected, setSelected] = useState<Selection | null>(SEED);
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [serviceFilter, setServiceFilter] = useState("all");
  const [blocking, setBlocking] = useState(false);

  const change = (target: Selection, next: Change, title: string, sub: string) => {
    const before = changes[target.key];
    setChanges((all) => ({ ...all, [target.key]: next }));
    if (next === "cancelled") setSelected(null);
    notify({
      title,
      sub,
      undo: () => {
        setChanges((all) => {
          const copy = { ...all };
          if (before) copy[target.key] = before;
          else delete copy[target.key];
          return copy;
        });
        setSelected(target);
      },
    });
  };

  // o estado do bloco selecionado leva em conta o que a equipe já fez com ele
  const current: Selection | null = selected
    ? (() => {
        const c = changes[selected.key];
        if (c === "done") return { ...selected, kind: "done" };
        if (c === "noshow") return { ...selected, kind: "noshow" };
        if (c === "confirmed" && selected.kind === "pending") return { ...selected, kind: "ok" };
        return selected;
      })()
    : null;

  const clickToBook =
    (day: number, column: number, origin: (hour: string) => string) =>
    (event: React.MouseEvent<HTMLDivElement>) => {
      const y = event.nativeEvent.offsetY;
      const t = Math.max(1, Math.round((y / 60) * 2) / 2);
      openNew({ origin: origin(hourLabel(t)), pro: column, day, hour: t });
    };

  const columns =
    view === "day"
      ? PROS.map((p, i) => {
          const value = occupancy(i, dayIndex);
          const d = WEEK_DAYS[dayIndex];
          return {
            key: p.name,
            title: p.name,
            sub: i === 2 ? "química" : "barbeiro",
            occupancyLabel: value ? `${value}%` : "folga",
            occupancyFg: occupancyColor(value),
            headBg: "#F7F7F8",
            today: dayIndex === TODAY,
            blocks: value
              ? place(
                  withCreated(dayIndex, i, created, flash),
                  false,
                  dayIndex,
                  i,
                  changes,
                  serviceFilter,
                )
              : [],
            onPick: clickToBook(dayIndex, i, (hour) => `${d?.dow ?? ""} ${d?.day ?? ""}, ${hour} · ${p.name}`),
          };
        })
      : WEEK_DAYS.map((d, di) => {
          const value = occupancy(proIndex, di);
          return {
            key: d.day,
            title: d.dow,
            sub: d.day,
            occupancyLabel: value ? `${value}%` : "folga",
            occupancyFg: occupancyColor(value),
            headBg: di === 1 ? "#FFFFFF" : "#F7F7F8",
            today: di === 1,
            blocks: value
              ? place(
                  withCreated(di, proIndex, created, flash),
                  true,
                  di,
                  proIndex,
                  changes,
                  serviceFilter,
                )
              : [],
            onPick: clickToBook(di, proIndex, (hour) => `${d.dow} ${d.day}, ${hour} · ${weekPro}`),
          };
        });

  return (
    <div className="agenda">
      <div className="agenda-main">
        <div className="agenda-toolbar">
          <div className="segmented">
            {(
              [
                ["day", "Dia"],
                ["week", "Semana"],
                ["team", "Equipe"],
              ] as [AgendaView, string][]
            ).map(([id, label]) => (
              <button
                className={view === id ? "active" : undefined}
                key={id}
                onClick={() => setView(id)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {/* o protótipo tem uma semana de agenda: no dia, as setas andam dentro dela */}
          <button
            aria-label="Período anterior"
            className="square"
            disabled={view !== "day" || dayIndex === 0}
            onClick={() => setDayIndex((d) => Math.max(0, d - 1))}
            title={view === "day" ? undefined : "O protótipo tem só esta semana"}
            type="button"
          >
            ‹
          </button>
          <button
            aria-label="Próximo período"
            className="square"
            disabled={view !== "day" || dayIndex === WEEK_DAYS.length - 1}
            onClick={() => setDayIndex((d) => Math.min(WEEK_DAYS.length - 1, d + 1))}
            title={view === "day" ? undefined : "O protótipo tem só esta semana"}
            type="button"
          >
            ›
          </button>
          <code className="period">{view === "day" ? dayLabel(dayIndex) : "7 — 12 de setembro"}</code>
          <button
            className="link"
            disabled={view === "day" && dayIndex === TODAY}
            onClick={() => setDayIndex(TODAY)}
            type="button"
          >
            Hoje
          </button>

          {view === "week" ? (
            <div className="pro-filter">
              <span>Profissional</span>
              {PROS.map((p) => {
                const on = p.name === weekPro;
                return (
                  <button
                    className={on ? "pro-chip active" : "pro-chip"}
                    key={p.name}
                    onClick={() => setWeekPro(p.name)}
                    type="button"
                  >
                    <i style={{ background: on ? CORAL : "#C4C6C9" }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="toolbar-end">
            <select
              aria-label="Filtrar serviços"
              id="agenda-service-filter"
              onChange={(event) => setServiceFilter(event.target.value)}
              value={serviceFilter}
            >
              <option value="all">Todos os serviços</option>
              <option>Corte + barba</option>
              <option>Barba na navalha</option>
            </select>
            <button className="ghost" onClick={() => setBlocking(true)} type="button">
              Bloquear período
            </button>
          </div>
        </div>

        {view !== "team" ? (
          <div className="agenda-legend">
            {LEGEND.map((l) => (
              <span key={l.label}>
                <i style={{ background: l.bg, borderColor: l.bd }} />
                {l.label}
              </span>
            ))}
            <i className="legend-divider" />
            <span>
              <Glyph color={MUTED} d={ICON_PAID} />
              pago pelo app
            </span>
            <span>
              <Glyph color={MUTED} d={ICON_BLOCKED} />
              bloqueado
            </span>
            <code>
              {view === "day"
                ? "arraste um bloco para remarcar · clique para abrir o detalhe"
                : "uma pessoa por vez, para caber o nome do cliente"}
            </code>
          </div>
        ) : null}

        {view !== "team" ? (
          <section className="calendar">
            {view === "week" ? (
              <header className="calendar-title">
                <i>{pro(proIndex).initial}</i>
                <strong>{weekPro}, semana inteira</strong>
                <span>
                  {proIndex === 2
                    ? "química · em férias de quarta a sábado"
                    : "barbeiro · 6 dias na escala"}
                </span>
              </header>
            ) : null}

            <div className="calendar-scroll">
              <div className="calendar-head">
                <div className="gutter" />
                {columns.map((c) => (
                  <div key={c.key} style={{ background: c.headBg }}>
                    <strong>{c.title}</strong>
                    <code>{c.sub}</code>
                    <b style={{ color: c.occupancyFg }}>{c.occupancyLabel}</b>
                  </div>
                ))}
              </div>

              <div className="calendar-body">
                <div className="gutter">
                  {DAY_HOURS.map((h) => (
                    <div key={h}>{h}</div>
                  ))}
                </div>
                {columns.map((c) => (
                  <div
                    className="calendar-column"
                    key={c.key}
                    onClick={c.onPick}
                    title="clique num espaço vazio para agendar aqui"
                  >
                    {c.blocks.map((b) => (
                      <div
                        aria-pressed={current?.key === b.selection.key}
                        className={
                          (b.fresh ? "slot fresh" : "slot") +
                          (current?.key === b.selection.key ? " picked" : "")
                        }
                        key={`${c.key}-${b.top}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(b.selection);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelected(b.selection);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        style={{
                          top: b.top,
                          height: b.height,
                          padding: b.pad,
                          background: b.bg,
                          borderColor: b.bd,
                          borderLeft: `3px solid ${b.fg}`,
                        }}
                        title={b.tip}
                      >
                        <div className="slot-head">
                          {b.showHour ? <code style={{ color: b.fg }}>{b.hour}</code> : null}
                          {b.icon ? <Glyph color={b.fg} d={b.icon} /> : null}
                          {b.compact ? <strong>{b.customer}</strong> : null}
                        </div>
                        {b.showName ? <div className="slot-name">{b.customer}</div> : null}
                        {b.showService ? <div className="slot-service">{b.service}</div> : null}
                      </div>
                    ))}
                    {c.today ? <i className="now-line" /> : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {view === "team" ? (
          <section className="panel">
            <header className="panel-head">
              <h2>Ocupação por profissional</h2>
              <span>
                Quanto da jornada de cada um já está vendida. Clique num dia para abrir a agenda
                dele.
              </span>
            </header>
            <div className="table-scroll wide">
              <div className="team-grid-head">
                <div>PROFISSIONAL</div>
                {WEEK_DAYS.map((d) => (
                  <div key={d.day}>{`${d.dow} ${d.day}`}</div>
                ))}
                <div className="right">MÉDIA</div>
              </div>
              {PROS.map((p, pi) => {
                const days = WEEK_DAYS.map((_, di) => occupancy(pi, di));
                const active = days.filter((x) => x > 0);
                const average = Math.round(
                  active.reduce((a, b) => a + b, 0) / (active.length || 1),
                );
                return (
                  <div className="team-grid-row" key={p.name}>
                    <div className="team-grid-name">
                      <i>{p.initial}</i>
                      <strong>{p.name}</strong>
                    </div>
                    {days.map((value, di) => (
                      <button
                        className="team-grid-day"
                        key={di}
                        onClick={() => {
                          setView("week");
                          setWeekPro(p.name);
                        }}
                        type="button"
                      >
                        <strong
                          style={{
                            color: !value
                              ? "#C4C6C9"
                              : value > 85
                                ? GREEN_DARK
                                : value < 60
                                  ? AMBER
                                  : INK,
                          }}
                        >
                          {value ? `${value}%` : "—"}
                        </strong>
                        <div className="mini-bar">
                          <i
                            style={{
                              width: `${value}%`,
                              background: !value
                                ? "#F2F2F3"
                                : value > 85
                                  ? GREEN
                                  : value < 60
                                    ? AMBER
                                    : "#8E9296",
                            }}
                          />
                        </div>
                        <small>
                          {value
                            ? `${Math.round(value * 0.11)} atend.`
                            : pi === 2
                              ? "férias"
                              : "folga"}
                        </small>
                      </button>
                    ))}
                    <div className="team-grid-average">
                      <strong
                        style={{ color: average > 80 ? GREEN_DARK : average < 60 ? AMBER : INK }}
                      >
                        {average}%
                      </strong>
                      <small>{active.length} dias na escala</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="detail">
        {current ? (
          <Detail
            onCancel={() =>
              change(
                current,
                "cancelled",
                current.kind === "blocked" ? "Período desbloqueado" : "Agendamento cancelado",
                current.kind === "blocked"
                  ? "O horário voltou a aparecer como vaga no app."
                  : `${current.customer} foi avisado e o horário voltou a ficar livre.`,
              )
            }
            onCharge={() =>
              notify({
                title: "Cobrança do sinal enviada",
                sub: `${current.customer} recebeu o link de pagamento pelo app.`,
              })
            }
            onClose={() => setSelected(null)}
            onDone={() =>
              change(
                current,
                "done",
                "Atendimento concluído",
                `${current.customer} vai receber o convite para avaliar.`,
              )
            }
            onNoShow={() =>
              change(
                current,
                "noshow",
                "Falta registrada",
                `Conta no histórico de ${current.customer}. O horário fica livre.`,
              )
            }
            onReschedule={() =>
              openNew({
                origin: `Remarcando ${current.customer} · ${current.service}`,
                pro: current.pro,
                day: current.day,
                hour: null,
              })
            }
            selection={current}
          />
        ) : (
          <div className="detail-empty">
            <code>NENHUM AGENDAMENTO SELECIONADO</code>
            <p>Clique num bloco da agenda para ver o cliente, o pagamento e as ações.</p>
          </div>
        )}
      </aside>

      {blocking ? (
        <BlockPeriod
          defaultDay={view === "day" ? dayIndex : TODAY}
          defaultPro={view === "week" ? proIndex : 0}
          onCancel={() => setBlocking(false)}
          onConfirm={(period) => {
            setBlocking(false);
            onBlock(period);
          }}
        />
      ) : null}
    </div>
  );
}

function Detail({
  selection,
  onClose,
  onDone,
  onReschedule,
  onCharge,
  onNoShow,
  onCancel,
}: {
  selection: Selection;
  onClose: () => void;
  onDone: () => void;
  onReschedule: () => void;
  onCharge: () => void;
  onNoShow: () => void;
  onCancel: () => void;
}) {
  const isSeed = selection.key === "seed";
  const customer = CUSTOMERS.find((c) => c.name === selection.customer) ?? null;
  const service = findService(selection.service);
  const blocked = selection.kind === "blocked";
  const closed = selection.kind === "done" || selection.kind === "noshow";
  const paid = selection.kind === "paid";
  const price = service?.price ?? 0;
  const deposit = Math.round(price * 0.3);

  // a reserva de abertura é a do canvas; as outras saem do bloco clicado
  const rows = isSeed
    ? DETAIL_ROWS
    : [
        {
          k: "Quando",
          v: `${dayLabel(selection.day)}, ${hourLabel(selection.start)} — ${hourLabel(selection.start + selection.dur)}`,
          ff: MONO,
          fg: INK,
        },
        { k: blocked ? "Motivo" : "Serviço", v: blocked ? selection.customer : selection.service, ff: SANS, fg: INK },
        { k: "Profissional", v: pro(selection.pro).name, ff: SANS, fg: INK },
        ...(blocked
          ? []
          : [
              { k: "Valor", v: price ? brl(price) : "—", ff: MONO, fg: INK },
              {
                k: "Sinal",
                v: paid ? `${brl(deposit)} pago no app` : "não cobrado",
                ff: MONO,
                fg: paid ? GREEN : MUTED,
              },
              {
                k: "Restante",
                v: price ? `${brl(paid ? price - deposit : price)} no balcão` : "—",
                ff: MONO,
                fg: AMBER,
              },
            ]),
      ];

  return (
    <>
      <header>
        <code>{blocked ? "PERÍODO SELECIONADO" : "AGENDAMENTO SELECIONADO"}</code>
        <button aria-label="Fechar detalhe" onClick={onClose} type="button">
          ×
        </button>
      </header>
      <div className="detail-status">
        <span>
          <i />
          {STATUS_LABEL[selection.kind]}
        </span>
        {isSeed ? <code>#8241</code> : null}
      </div>
      <strong className="detail-name">{blocked ? "Horário bloqueado" : selection.customer}</strong>
      {!blocked ? (
        <code className="detail-phone">{customer?.phone ?? "sem telefone no cadastro"}</code>
      ) : null}

      <div className="detail-rows">
        {rows.map((r) => (
          <div key={r.k}>
            <span>{r.k}</span>
            <strong style={{ fontFamily: r.ff, color: r.fg }}>{r.v}</strong>
          </div>
        ))}
      </div>

      {isSeed ? (
        <>
          <header className="detail-subhead">
            <h3>Histórico deste cliente</h3>
            <code>desde mar/2024</code>
          </header>
          <div className="detail-summary">
            {DETAIL_SUMMARY.map((r) => (
              <div key={r.k}>
                <strong style={{ color: r.fg }}>{r.v}</strong>
                <small>{r.k}</small>
              </div>
            ))}
          </div>
          {DETAIL_HISTORY.map((r) => (
            <div className="detail-history" key={r.date}>
              <code>{r.date}</code>
              <span>{r.service}</span>
              <code>{r.value}</code>
            </div>
          ))}
          <div className="detail-note">
            <strong>Observação da equipe</strong>
            <p>Máquina 2 nas laterais. Costuma chegar dez minutos antes.</p>
          </div>
        </>
      ) : customer ? (
        <>
          <header className="detail-subhead">
            <h3>Histórico deste cliente</h3>
          </header>
          <div className="detail-summary">
            <div>
              <strong style={{ color: INK }}>{customer.visits}</strong>
              <small>visitas</small>
            </div>
            <div>
              <strong style={{ color: customer.misses ? AMBER : INK }}>{customer.misses}</strong>
              <small>faltas</small>
            </div>
          </div>
          {customer.history.slice(0, 3).map((r) => (
            <div className="detail-history" key={`${r.date}-${r.service}`}>
              <code>{r.date}</code>
              <span>{r.service}</span>
              <code>{r.value}</code>
            </div>
          ))}
        </>
      ) : null}

      <div className="detail-actions">
        {blocked ? (
          <button className="ghost red wide" onClick={onCancel} type="button">
            Desbloquear período
          </button>
        ) : (
          <>
            <button className="primary wide" disabled={closed} onClick={onDone} type="button">
              Concluir atendimento
            </button>
            <button className="ghost" disabled={closed} onClick={onReschedule} type="button">
              Remarcar
            </button>
            <button className="ghost" disabled={closed || paid} onClick={onCharge} type="button">
              Cobrar sinal
            </button>
            <button className="ghost amber" disabled={closed} onClick={onNoShow} type="button">
              Não compareceu
            </button>
            <button className="ghost red" disabled={closed} onClick={onCancel} type="button">
              Cancelar
            </button>
          </>
        )}
      </div>
    </>
  );
}

/** Meia hora por passo, das 08:00 às 20:00 — a mesma escala da grade. */
const HALF_HOURS = Array.from({ length: 25 }, (_, i) => i / 2);

function BlockPeriod({
  defaultDay,
  defaultPro,
  onCancel,
  onConfirm,
}: {
  defaultDay: number;
  defaultPro: number;
  onCancel: () => void;
  onConfirm: (period: Created) => void;
}) {
  const [proIndex, setProIndex] = useState(defaultPro);
  const [day, setDay] = useState(defaultDay);
  const [from, setFrom] = useState(4);
  const [to, setTo] = useState(5);
  const [reason, setReason] = useState("");

  const valid = to > from;
  const clashes = valid
    ? appointmentsOf(day, proIndex).filter(
        (a) => a.kind !== "blocked" && a.start < to && a.start + a.dur > from,
      ).length
    : 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onConfirm({
      day,
      pro: proIndex,
      start: from,
      dur: to - from,
      customer: reason.trim() || "Bloqueio",
      service: "bloqueado pela equipe",
      blocked: true,
    });
  };

  return (
    <div className="dialog-scrim">
      <button aria-label="Fechar" className="dialog-backdrop" onClick={onCancel} type="button" />
      <form aria-labelledby="block-title" className="dialog" onSubmit={submit}>
        <h2 id="block-title">Bloquear período</h2>
        <p>Ninguém consegue marcar nesse intervalo, nem pelo app nem pelo balcão.</p>
        <div className="dialog-grid">
          <label>
            <span>Profissional</span>
            <select id="block-pro" onChange={(e) => setProIndex(Number(e.target.value))} value={proIndex}>
              {PROS.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Dia</span>
            <select id="block-day" onChange={(e) => setDay(Number(e.target.value))} value={day}>
              {WEEK_DAYS.map((d, i) => (
                <option key={d.day} value={i}>
                  {dayLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Das</span>
            <select id="block-from" onChange={(e) => setFrom(Number(e.target.value))} value={from}>
              {HALF_HOURS.slice(0, -1).map((t) => (
                <option key={t} value={t}>
                  {hourLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Até</span>
            <select id="block-to" onChange={(e) => setTo(Number(e.target.value))} value={to}>
              {HALF_HOURS.slice(1).map((t) => (
                <option key={t} value={t}>
                  {hourLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="span">
            <span>Motivo</span>
            <input
              id="block-reason"
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: consulta médica, manutenção da cadeira"
              value={reason}
            />
          </label>
        </div>
        {!valid ? <p className="dialog-warn">O fim precisa ser depois do início.</p> : null}
        {clashes ? (
          <p className="dialog-warn">
            {clashes === 1
              ? "Há 1 agendamento nesse intervalo. Ele continua marcado — remarque antes."
              : `Há ${clashes} agendamentos nesse intervalo. Eles continuam marcados — remarque antes.`}
          </p>
        ) : null}
        <footer>
          <button className="ghost" onClick={onCancel} type="button">
            Cancelar
          </button>
          <button className="primary" disabled={!valid} type="submit">
            Bloquear
          </button>
        </footer>
      </form>
    </div>
  );
}
