"use client";

import { useCallback, useEffect, useState } from "react";

import type { Notify } from "./portal";
import { AMBER, CORAL, GREEN_DARK, INK, INK_SOFT, MUTED, RED } from "./tokens";

const ORIGINS = {
  desk: { label: "balcão", fg: INK_SOFT },
  qr: { label: "QR code no local", fg: GREEN_DARK },
  app: { label: "app remoto", fg: CORAL },
} as const;

type OriginId = keyof typeof ORIGINS;

const QUEUE: [string, string, string, string, string, string, OriginId, boolean][] = [
  ["1", "Caio Bertoldo", "Corte social", "Léo", "14:01", "31min", "qr", true],
  ["2", "Everton Lima", "Barba na navalha", "Bruno", "14:14", "18min", "desk", false],
  ["3", "Rui Antunes", "Corte + barba", "qualquer um", "14:23", "9min", "app", false],
  ["4", "Jonas Bonfim", "Corte social", "Sérgio", "14:27", "5min", "desk", false],
  ["5", "Pedro Aguiar", "Máquina", "qualquer um", "14:30", "2min", "qr", false],
];

const HISTORY: [string, string, string, string, string, string, boolean][] = [
  ["seg 07", "24", "23", "19min", "38min", "18:30", false],
  ["sáb 05", "41", "38", "34min", "1h12", "11:00", true],
  ["sex 04", "33", "33", "26min", "54min", "18:00", true],
  ["qui 03", "22", "22", "14min", "29min", "19:00", false],
  ["qua 02", "19", "18", "12min", "24min", "12:30", false],
  ["ter 01", "21", "20", "17min", "31min", "17:30", false],
];

const PRE_QUEUE = [
  {
    name: "Fábio Duarte",
    service: "Corte + barba",
    deadline: "confirma até 14:45",
    warned: "14:20",
  },
  { name: "Nelson Castro", service: "Barba", deadline: "confirma até 15:10", warned: "14:28" },
];

const SOURCES = [
  { label: "QR code no balcão", n: "14", pct: 52, c: GREEN_DARK },
  { label: "Atendente no balcão", n: "8", pct: 30, c: INK_SOFT },
  { label: "App, antes de chegar", n: "5", pct: 18, c: CORAL },
];

type Entry = {
  id: string;
  name: string;
  service: string;
  professional: string;
  entered: string;
  wait: string;
  origin: OriginId;
};

type Pending = (typeof PRE_QUEUE)[number];

const INITIAL: Entry[] = QUEUE.map(([pos, name, service, professional, entered, wait, origin]) => ({
  id: `q${pos}`,
  name,
  service,
  professional,
  entered,
  wait,
  origin,
}));

const DESK_SERVICES = ["Corte social", "Corte + barba", "Barba na navalha", "Máquina", "Pezinho"];

/** Hora de agora no formato da tabela, para quem entra pelo balcão ou confirma chegada. */
function nowLabel(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Devolve `item` à posição `index` — o desfazer de quem saiu da fila. */
function reinsert<T>(list: T[], item: T, index: number): T[] {
  const next = list.slice();
  next.splice(Math.min(index, next.length), 0, item);
  return next;
}

export function Queue({ notify }: { notify: Notify }) {
  const [queue, setQueue] = useState<Entry[]>(INITIAL);
  const [pending, setPending] = useState<Pending[]>(PRE_QUEUE);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftService, setDraftService] = useState(DESK_SERVICES[0] ?? "");

  const callNext = useCallback(() => {
    const first = queue[0];
    if (!first) return;
    setQueue((list) => list.slice(1));
    notify({
      title: `Chamando ${first.name}`,
      sub: first.origin === "app" ? "Avisado pelo app." : "Chame pelo nome no salão.",
      undo: () => setQueue((list) => reinsert(list, first, 0)),
    });
  }, [queue, notify]);

  // ↵ chama o próximo, como o atalho do botão promete — fora de campo de texto.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName ?? "";
      if (event.key === "Enter" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        callNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [callNext]);

  const move = (index: number, delta: -1 | 1) => {
    setQueue((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = list.slice();
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const markAbsent = (entry: Entry, index: number) => {
    setQueue((list) => list.filter((e) => e.id !== entry.id));
    notify({
      title: `${entry.name} marcado como ausente`,
      sub: "Saiu da fila. Conta como falta no histórico dele.",
      undo: () => setQueue((list) => reinsert(list, entry, index)),
    });
  };

  const addAtDesk = (event: React.FormEvent) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    const entry: Entry = {
      id: `desk-${Date.now()}`,
      name,
      service: draftService,
      professional: "qualquer um",
      entered: nowLabel(),
      wait: "0min",
      origin: "desk",
    };
    setQueue((list) => list.concat([entry]));
    setDraftName("");
    setAdding(false);
    notify({
      title: `${name} entrou na fila`,
      sub: `Posição ${queue.length + 1}, pelo balcão.`,
      undo: () => setQueue((list) => list.filter((e) => e.id !== entry.id)),
    });
  };

  const confirmArrival = (person: Pending) => {
    const entry: Entry = {
      id: `app-${person.name}`,
      name: person.name,
      service: person.service,
      professional: "qualquer um",
      entered: nowLabel(),
      wait: "0min",
      origin: "app",
    };
    setPending((list) => list.filter((p) => p.name !== person.name));
    setQueue((list) => list.concat([entry]));
    notify({
      title: `${person.name} chegou`,
      sub: `Entrou na fila na posição ${queue.length + 1}.`,
      undo: () => {
        setQueue((list) => list.filter((e) => e.id !== entry.id));
        setPending((list) => list.concat([person]));
      },
    });
  };

  const removePending = (person: Pending, index: number) => {
    setPending((list) => list.filter((p) => p.name !== person.name));
    notify({
      title: `${person.name} saiu da pré-fila`,
      sub: "Ele recebe um aviso pelo app.",
      undo: () => setPending((list) => reinsert(list, person, index)),
    });
  };

  return (
    <div className="page queue">
      <div className="queue-column">
        <section className="panel">
          <header className="panel-head">
            <i className="live-dot" />
            <h2>Fila aberta</h2>
            <code>
              {queue.length} esperando · média de hoje 21min
            </code>
            <button className="primary" disabled={!queue.length} onClick={callNext} type="button">
              Chamar próximo <kbd>↵</kbd>
            </button>
            <button className="ghost" onClick={() => setAdding((on) => !on)} type="button">
              {adding ? "Fechar" : "Adicionar no balcão"}
            </button>
          </header>
          {adding ? (
            <form className="desk-add" onSubmit={addAtDesk}>
              <input
                aria-label="Nome de quem chegou"
                autoFocus
                id="desk-add-name"
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Nome de quem chegou"
                value={draftName}
              />
              <select
                aria-label="Serviço"
                id="desk-add-service"
                onChange={(event) => setDraftService(event.target.value)}
                value={draftService}
              >
                {DESK_SERVICES.map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
              <button className="primary" disabled={!draftName.trim()} type="submit">
                Colocar na fila
              </button>
            </form>
          ) : null}
          <div className="table-scroll">
            <div className="table-head queue-grid">
              <div>#</div>
              <div>CLIENTE</div>
              <div>SERVIÇO</div>
              <div>ENTROU</div>
              <div className="right">ESPERA</div>
              <div />
            </div>
            {queue.length === 0 ? (
              <p className="queue-empty">Ninguém esperando agora.</p>
            ) : null}
            {queue.map((entry, index) => {
              const first = index === 0;
              return (
                <div
                  className="table-row queue-grid"
                  key={entry.id}
                  style={{ background: first ? "#FFFBF7" : "#fff" }}
                >
                  <code className="queue-pos" style={{ color: first ? CORAL : "#A2A5A9" }}>
                    {index + 1}
                  </code>
                  <div>
                    <strong>{entry.name}</strong>
                    <small className="origin">
                      <i style={{ background: ORIGINS[entry.origin].fg }} />
                      {ORIGINS[entry.origin].label}
                    </small>
                  </div>
                  <div>
                    <span>{entry.service}</span>
                    <code>{entry.professional}</code>
                  </div>
                  <code>{entry.entered}</code>
                  <code
                    className="queue-wait"
                    style={{
                      color: first ? RED : parseInt(entry.wait, 10) > 15 ? AMBER : INK,
                    }}
                  >
                    {entry.wait}
                  </code>
                  <div className="row-actions">
                    <button
                      aria-label={`Subir ${entry.name}`}
                      className="ghost small icon"
                      disabled={first}
                      onClick={() => move(index, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Descer ${entry.name}`}
                      className="ghost small icon"
                      disabled={index === queue.length - 1}
                      onClick={() => move(index, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                    <button
                      className="ghost small amber"
                      onClick={() => markAbsent(entry, index)}
                      type="button"
                    >
                      Ausente
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2>Filas anteriores</h2>
            <span>onde a espera estourou e em que horário</span>
          </header>
          <div className="table-scroll">
            <div className="table-head history-grid">
              <div>DIA</div>
              <div className="right">ENTRARAM</div>
              <div className="right">ATENDIDOS</div>
              <div className="right">MÉDIA</div>
              <div className="right">PIOR ESPERA</div>
              <div className="right">HORÁRIO DO PICO</div>
            </div>
            {HISTORY.map(([day, entered, served, average, worst, peak, hot]) => (
              <div className="table-row history-grid" key={day}>
                <strong>{day}</strong>
                <code className="right">{entered}</code>
                <code className="right">{served}</code>
                <code className="right strong" style={{ color: hot ? RED : INK }}>
                  {average}
                </code>
                <code className="right strong" style={{ color: hot ? RED : MUTED }}>
                  {worst}
                </code>
                <code className="right muted">{peak}</code>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="queue-column">
        <section className="panel">
          <header className="panel-head stacked">
            <div className="head-row">
              <h2>Pré-fila</h2>
              <b className="count amber">{pending.length}</b>
            </div>
            <p>
              Entraram pelo app e ainda não confirmaram que chegaram. Só entram na fila de verdade
              depois de confirmar.
            </p>
          </header>
          {pending.length === 0 ? (
            <p className="queue-empty">Ninguém aguardando confirmação.</p>
          ) : null}
          {pending.map((p, index) => (
            <div className="pre-queue" key={p.name}>
              <div>
                <strong>{p.name}</strong>
                <code>{p.deadline}</code>
              </div>
              <small>
                {p.service} · avisado {p.warned}
              </small>
              <div className="row-actions start">
                <button className="soft small" onClick={() => confirmArrival(p)} type="button">
                  Confirmar chegada
                </button>
                <button
                  className="ghost small danger-hover"
                  onClick={() => removePending(p, index)}
                  type="button"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="panel padded">
          <h2 className="card-title">Como as pessoas entraram hoje</h2>
          <div className="sources">
            {SOURCES.map((o) => (
              <div key={o.label}>
                <div className="source-head">
                  <i style={{ background: o.c }} />
                  <strong>{o.label}</strong>
                  <code>{o.n}</code>
                </div>
                <div className="mini-bar">
                  <i style={{ width: `${o.pct}%`, background: o.c }} />
                </div>
              </div>
            ))}
          </div>
          <p className="card-foot">Das 08:00 até agora.</p>
        </section>
      </div>
    </div>
  );
}
