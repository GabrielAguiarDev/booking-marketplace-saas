"use client";

import { useMemo, useState } from "react";

import { Dialog, EmptyBox, ImpactWarning, dateLabel, hhmm, todayISO, useSave } from "./cadastro-ui";
import type { ScheduleImpact, TimeWindow } from "./model";
import { WEEKDAY_LABEL, WEEK_ORDER } from "./model";
import { usePortal } from "./store";
import { AMBER, AMBER_LINE, FAINT, GREEN_DARK, INK, LINE_STRONG, MUTED, SURFACE } from "./tokens";

type Target =
  | { kind: "establishment"; weekday: number }
  | { kind: "professional"; professionalId: string; name: string; weekday: number };

const rangeLabel = (window: TimeWindow) => `${hhmm(window.startsAt)}—${hhmm(window.endsAt)}`;

/* ── Editor de um dia ─────────────────────────────────────────────────────── */

/**
 * Turnos de um dia, do estabelecimento ou de uma pessoa.
 *
 * Antes de salvar, a tela pergunta ao Postgres o que a jornada proposta
 * deixaria de fora (`schedule_change_impact`) — regra R9. O cálculo não é
 * refeito aqui em TypeScript: fuso, turno partido e reserva que cruza a
 * meia-noite são exatamente onde a segunda implementação erraria.
 */
function DayDialog({
  target,
  initial,
  onClose,
}: {
  target: Target;
  initial: TimeWindow[];
  onClose: () => void;
}) {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();
  const [windows, setWindows] = useState<TimeWindow[]>(
    initial.map((window) => ({ startsAt: hhmm(window.startsAt), endsAt: hhmm(window.endsAt) })),
  );
  const [impact, setImpact] = useState<ScheduleImpact[] | null>(null);
  const [checking, setChecking] = useState(false);

  if (!data) return null;

  const label = WEEKDAY_LABEL[target.weekday] ?? "";
  const who = target.kind === "establishment" ? "a loja" : target.name;
  const broken = windows.some((window) => window.endsAt <= window.startsAt);

  const patch = (index: number, field: keyof TimeWindow, value: string) =>
    setWindows((list) =>
      list.map((window, position) => (position === index ? { ...window, [field]: value } : window)),
    );

  const check = async () => {
    setChecking(true);
    try {
      const rows = await actions.scheduleImpact({
        establishmentId: data.establishment.id,
        professionalId: target.kind === "professional" ? target.professionalId : null,
        weekday: target.weekday,
        windows,
      });
      setImpact(rows);
    } catch (error) {
      setImpact([]);
      // Sem a resposta do banco não dá para afirmar que nada quebra; o texto do
      // botão continua sendo o de confirmação, e o aviso abaixo diz o porquê.
      console.error(error);
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    const ok = await run(
      () =>
        target.kind === "establishment"
          ? actions.saveBusinessHours(data.establishment.id, target.weekday, windows)
          : actions.saveProfessionalSchedule(target.professionalId, target.weekday, windows),
      windows.length === 0 ? `${label}: fechado.` : `${label} atualizada.`,
    );
    if (ok) onClose();
  };

  return (
    <Dialog
      onCancel={onClose}
      sub={
        target.kind === "establishment"
          ? "Ninguém consegue agendar fora do funcionamento, nem entrar na fila."
          : "É a jornada de quem atende que gera horário; o funcionamento da loja só recorta."
      }
      title={`${label} · ${who}`}
    >
      <div className="drawer-body" style={{ padding: 0 }}>
        {windows.length === 0 ? (
          <EmptyBox
            body={
              target.kind === "establishment"
                ? "Sem turno, a loja fica fechada neste dia."
                : "Sem turno, esta pessoa folga neste dia."
            }
            title="Nenhum turno"
          />
        ) : (
          windows.map((window, index) => (
            <div className="desk-add" key={index} style={{ padding: "8px 0" }}>
              <input
                aria-label="Começa"
                onChange={(event) => patch(index, "startsAt", event.target.value)}
                type="time"
                value={window.startsAt}
              />
              <span style={{ color: MUTED }}>até</span>
              <input
                aria-label="Termina"
                onChange={(event) => patch(index, "endsAt", event.target.value)}
                type="time"
                value={window.endsAt}
              />
              <button
                className="ghost small"
                onClick={() => setWindows((list) => list.filter((_, i) => i !== index))}
                type="button"
              >
                Remover
              </button>
            </div>
          ))
        )}
        <button
          className="link add"
          onClick={() =>
            setWindows((list) =>
              list.concat({
                startsAt: list.length === 0 ? "09:00" : "13:00",
                endsAt: list.length === 0 ? "12:00" : "19:00",
              }),
            )
          }
          type="button"
        >
          <span>+</span> Acrescentar turno
        </button>
        <p className="form-note">
          Dois turnos no mesmo dia é como se fecha para o almoço: 09:00—12:00 e 13:00—19:00.
        </p>

        {broken ? (
          <p className="dialog-warn">O fim do turno precisa ser depois do começo.</p>
        ) : null}
        {impact ? <ImpactWarning impact={impact} /> : null}
        {impact !== null && impact.length === 0 ? (
          <p className="form-note" style={{ color: GREEN_DARK }}>
            Nenhuma reserva já vendida fica fora deste desenho.
          </p>
        ) : null}
      </div>

      <footer>
        <button className="ghost" onClick={onClose} type="button">
          Cancelar
        </button>
        {impact === null ? (
          <button
            className="primary"
            disabled={broken || checking}
            onClick={() => void check()}
            type="button"
          >
            {checking ? "Conferindo…" : "Conferir e salvar"}
          </button>
        ) : (
          <button
            className="primary"
            disabled={broken || pending}
            onClick={() => void save()}
            type="button"
          >
            {pending ? "Salvando…" : impact.length === 0 ? "Salvar" : "Salvar mesmo assim"}
          </button>
        )}
      </footer>
    </Dialog>
  );
}

/* ── Bloqueio e folga pontual ─────────────────────────────────────────────── */

function ExceptionForm({ onDone }: { onDone: () => void }) {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [allDay, setAllDay] = useState(true);
  const [startsAt, setStartsAt] = useState("12:00");
  const [endsAt, setEndsAt] = useState("13:00");
  const [isAvailable, setIsAvailable] = useState(false);
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<ScheduleImpact[] | null>(null);

  if (!data) return null;

  const times = allDay ? { startsAt: null, endsAt: null } : { startsAt, endsAt };
  const broken = !allDay && endsAt <= startsAt;

  const check = async () => {
    if (isAvailable) {
      // Abrir um dia extra não tira ninguém da agenda; não há o que quebrar.
      setImpact([]);
      return;
    }
    try {
      setImpact(
        await actions.blockImpact({
          establishmentId: data.establishment.id,
          professionalId: professionalId || null,
          date,
          startsAt: times.startsAt,
          endsAt: times.endsAt,
        }),
      );
    } catch {
      setImpact([]);
    }
  };

  const save = async () => {
    const ok = await run(
      () =>
        actions.saveException({
          establishmentId: data.establishment.id,
          professionalId: professionalId || null,
          date,
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          isAvailable,
          reason: reason.trim() || null,
        }),
      isAvailable ? "Período aberto." : "Período bloqueado.",
    );
    if (ok) onDone();
  };

  return (
    <div className="register">
      <strong>{isAvailable ? "Abrir um período fora da escala" : "Bloquear um período"}</strong>
      <div className="desk-add">
        <select
          aria-label="Quem"
          onChange={(event) => {
            setProfessionalId(event.target.value);
            setImpact(null);
          }}
          value={professionalId}
        >
          <option value="">A loja inteira</option>
          {data.professionals.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.displayName}
            </option>
          ))}
        </select>
        <input
          aria-label="Data"
          min={todayISO()}
          onChange={(event) => {
            setDate(event.target.value);
            setImpact(null);
          }}
          type="date"
          value={date}
        />
        <select
          aria-label="Tipo"
          onChange={(event) => {
            setIsAvailable(event.target.value === "open");
            setImpact(null);
          }}
          value={isAvailable ? "open" : "block"}
        >
          <option value="block">Fechado</option>
          <option value="open">Aberto fora da escala</option>
        </select>
      </div>
      <div className="desk-add">
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
          <input
            checked={allDay}
            onChange={(event) => {
              setAllDay(event.target.checked);
              setImpact(null);
            }}
            type="checkbox"
          />
          Dia inteiro
        </label>
        {allDay ? null : (
          <>
            <input
              aria-label="Começa"
              onChange={(event) => {
                setStartsAt(event.target.value);
                setImpact(null);
              }}
              type="time"
              value={startsAt}
            />
            <span style={{ color: MUTED }}>até</span>
            <input
              aria-label="Termina"
              onChange={(event) => {
                setEndsAt(event.target.value);
                setImpact(null);
              }}
              type="time"
              value={endsAt}
            />
          </>
        )}
        <input
          aria-label="Motivo"
          onChange={(event) => setReason(event.target.value)}
          placeholder="Motivo (aparece só para a equipe)"
          value={reason}
        />
      </div>

      {broken ? <p className="dialog-warn">O fim precisa ser depois do começo.</p> : null}
      {impact ? <ImpactWarning impact={impact} mode="block" /> : null}
      {impact !== null && impact.length === 0 && !isAvailable ? (
        <p className="form-note" style={{ color: GREEN_DARK }}>
          Nenhuma reserva já vendida cai neste período.
        </p>
      ) : null}

      <div className="register-actions">
        {impact === null ? (
          <button
            className="primary small"
            disabled={broken}
            onClick={() => void check()}
            type="button"
          >
            Conferir
          </button>
        ) : (
          <button
            className="primary small"
            disabled={broken || pending}
            onClick={() => void save()}
            type="button"
          >
            {pending ? "Salvando…" : impact.length === 0 ? "Salvar" : "Salvar mesmo assim"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Seção ────────────────────────────────────────────────────────────────── */

export function Hours() {
  const { data, actions } = usePortal();
  const { run, pending } = useSave();
  const [target, setTarget] = useState<{ target: Target; initial: TimeWindow[] } | null>(null);
  const [nonce, setNonce] = useState(0);

  const businessByDay = useMemo(() => {
    const map = new Map<number, TimeWindow[]>();
    for (const hour of data?.businessHours ?? []) {
      map.set(
        hour.weekday,
        (map.get(hour.weekday) ?? []).concat({ startsAt: hour.opensAt, endsAt: hour.closesAt }),
      );
    }
    return map;
  }, [data?.businessHours]);

  const scheduleByKey = useMemo(() => {
    const map = new Map<string, TimeWindow[]>();
    for (const item of data?.schedules ?? []) {
      const key = `${item.professionalId}:${item.weekday}`;
      map.set(key, (map.get(key) ?? []).concat({ startsAt: item.startsAt, endsAt: item.endsAt }));
    }
    return map;
  }, [data?.schedules]);

  if (!data) return null;
  const canWrite = data.establishment.role !== "staff";
  const professionals = data.professionals.filter((item) => item.isActive);

  const open = (next: Target, initial: TimeWindow[]) => {
    if (!canWrite) return;
    setTarget({ target: next, initial });
  };

  return (
    <div className="page" key={nonce}>
      <section className="panel">
        <header className="panel-head stacked">
          <h2>Funcionamento do estabelecimento</h2>
          <p>Ninguém consegue agendar nem entrar na fila fora destes horários.</p>
        </header>
        {WEEK_ORDER.map((weekday) => {
          const windows = (businessByDay.get(weekday) ?? [])
            .slice()
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          return (
            <div className="list-row" key={weekday}>
              <div>
                <strong>{WEEKDAY_LABEL[weekday]}</strong>
                <small>
                  {windows.length === 0
                    ? "Fechado. Nem fila, nem agendamento."
                    : windows.length === 1
                      ? "Turno único."
                      : `${windows.length} turnos — o intervalo entre eles fica fechado.`}
                </small>
              </div>
              <code style={{ color: windows.length === 0 ? FAINT : INK }}>
                {windows.length === 0 ? "fechado" : windows.map(rangeLabel).join(" · ")}
              </code>
              {canWrite ? (
                <button
                  className="ghost small"
                  onClick={() => open({ kind: "establishment", weekday }, windows)}
                  type="button"
                >
                  Editar
                </button>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Jornada de quem atende</h2>
          <div className="legend">
            <span>
              <i style={{ background: LINE_STRONG }} />
              trabalha
            </span>
            <span>
              <i style={{ background: SURFACE }} />
              folga
            </span>
            <span>
              <i style={{ background: AMBER_LINE }} />
              fora do funcionamento
            </span>
          </div>
        </header>
        {professionals.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyBox
              body="A jornada é de cada pessoa. Cadastre quem atende em Equipe e a grade aparece aqui."
              title="Ninguém na agenda"
            />
          </div>
        ) : (
          <div className="shift-body">
            <div className="shift-track">
              <div className="shift-days">
                <div className="shift-name" />
                {WEEK_ORDER.map((weekday) => (
                  <div key={weekday}>{(WEEKDAY_LABEL[weekday] ?? "").slice(0, 3)}</div>
                ))}
              </div>
              {professionals.map((professional) => (
                <div className="shift-row" key={professional.id}>
                  <div className="shift-name">{professional.displayName}</div>
                  {WEEK_ORDER.map((weekday) => {
                    const windows = (scheduleByKey.get(`${professional.id}:${weekday}`) ?? [])
                      .slice()
                      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
                    const shopOpen = (businessByDay.get(weekday) ?? []).length > 0;
                    const outside = windows.length > 0 && !shopOpen;
                    return (
                      <div className="shift-slot" key={weekday}>
                        <button
                          onClick={() =>
                            open(
                              {
                                kind: "professional",
                                professionalId: professional.id,
                                name: professional.displayName,
                                weekday,
                              },
                              windows,
                            )
                          }
                          style={{
                            background: outside ? "#FFFBF0" : windows.length ? "#F2F2F3" : SURFACE,
                            borderColor: outside ? AMBER_LINE : LINE_STRONG,
                            cursor: canWrite ? "pointer" : "default",
                            width: "100%",
                            border: "1px solid",
                            borderRadius: 7,
                            padding: "6px 4px",
                          }}
                          title={`${professional.displayName} · ${WEEKDAY_LABEL[weekday]}`}
                          type="button"
                        >
                          <span style={{ color: windows.length ? INK : FAINT, fontSize: 11.5 }}>
                            {windows.length === 0 ? "—" : windows.map(rangeLabel).join(" ")}
                          </span>
                          <small style={{ color: outside ? AMBER : MUTED, display: "block" }}>
                            {windows.length === 0 ? "folga" : outside ? "loja fechada" : ""}
                          </small>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
        <footer className="card-foot">
          A vaga que o cliente vê é o funcionamento menos quem não está na jornada, menos o que já
          está agendado. A conta é a mesma no portal e nos aplicativos.
        </footer>
      </section>

      <section className="panel">
        <header className="panel-head stacked">
          <h2>Folgas, feriados e bloqueios</h2>
          <p>Vale para uma data só, e ganha da jornada da semana.</p>
        </header>
        {data.exceptions.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyBox
              body="Nada marcado daqui para a frente. Feriado, férias e almoço fora de hora entram aqui."
              title="Nenhuma exceção"
            />
          </div>
        ) : (
          data.exceptions.map((exception) => {
            const professional = data.professionals.find(
              (item) => item.id === exception.professionalId,
            );
            return (
              <div className="list-row" key={exception.id}>
                <div>
                  <strong>
                    {dateLabel(exception.date)} ·{" "}
                    {professional ? professional.displayName : "loja inteira"}
                  </strong>
                  <small>
                    {exception.reason ??
                      (exception.isAvailable ? "aberto fora da escala" : "sem motivo anotado")}
                  </small>
                </div>
                <code style={{ color: exception.isAvailable ? GREEN_DARK : AMBER }}>
                  {exception.startsAt && exception.endsAt
                    ? `${hhmm(exception.startsAt)}—${hhmm(exception.endsAt)}`
                    : "dia inteiro"}
                  {exception.isAvailable ? " · aberto" : " · fechado"}
                </code>
                {canWrite ? (
                  <button
                    className="ghost small"
                    disabled={pending}
                    onClick={() =>
                      void run(() => actions.removeException(exception.id), "Exceção apagada.")
                    }
                    type="button"
                  >
                    Apagar
                  </button>
                ) : null}
              </div>
            );
          })
        )}
        {canWrite ? (
          <div style={{ padding: "14px 20px 20px" }}>
            <ExceptionForm onDone={() => setNonce((value) => value + 1)} />
          </div>
        ) : null}
      </section>

      {target ? (
        <DayDialog
          initial={target.initial}
          onClose={() => setTarget(null)}
          target={target.target}
        />
      ) : null}
    </div>
  );
}
