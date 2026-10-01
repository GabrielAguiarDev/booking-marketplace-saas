"use client";

import { useMemo, useState } from "react";

import {
  APPOINTMENT_STATUS,
  dateLabel,
  duration,
  localDay,
  money,
  phoneLabel,
  timeLabel,
} from "./operation-format";
import { Drawer } from "./drawer";
import type { OperationAppointment } from "./operation-model";
import styles from "./operation.module.css";
import type { Notify } from "./portal";
import { usePortal } from "./store";

export type NewAppointmentSeed = { appointment?: OperationAppointment };

export function Agenda({
  notify,
  openNew,
}: {
  notify: Notify;
  openNew: (seed: NewAppointmentSeed) => void;
}) {
  const { data, actions } = usePortal();
  const operation = data?.operation;
  const [day, setDay] = useState(operation?.summary.localDay ?? "");
  const [professionalId, setProfessionalId] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const appointments = useMemo(() => {
    if (!operation) return [];
    return operation.appointments.filter(
      (item) =>
        localDay(item.startsAt, operation.summary.timezone) === day &&
        (professionalId === "all" || item.professionalId === professionalId),
    );
  }, [day, operation, professionalId]);
  const selected = operation?.appointments.find((item) => item.id === selectedId) ?? null;

  if (!operation) return null;

  const act = async (action: () => Promise<void>, title: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      notify({ title, sub: "A agenda já está atualizada para toda a equipe." });
      setSelectedId(null);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a agenda.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const active = selected?.status === "scheduled" || selected?.status === "confirmed";

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.toolbar}>
          <h2>{dateLabel(day)}</h2>
          <label className={styles.field}>
            <span className={styles.subtle}>Data</span>
            <input onChange={(event) => setDay(event.target.value)} type="date" value={day} />
          </label>
          <label className={styles.field}>
            <span className={styles.subtle}>Profissional</span>
            <select
              onChange={(event) => setProfessionalId(event.target.value)}
              value={professionalId}
            >
              <option value="all">Toda a equipe</option>
              {operation.professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
          </label>
        </header>

        {error && !selected ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.list}>
          {appointments.length === 0 ? (
            <p className={styles.empty}>Nenhum agendamento nesta data.</p>
          ) : (
            appointments.map((item) => (
              <button
                className={styles.row}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setCancelling(false);
                  setReason("");
                  setError("");
                }}
                style={{
                  borderInline: 0,
                  borderBottom: 0,
                  background: "transparent",
                  textAlign: "left",
                }}
                type="button"
              >
                <div className={styles.rowMeta} style={{ minWidth: 72, textAlign: "left" }}>
                  <strong>
                    {timeLabel(item.startsAt, operation.summary.timezone)} –{" "}
                    {timeLabel(item.endsAt, operation.summary.timezone)}
                  </strong>
                  <code>{duration(item.serviceMinutes)}</code>
                </div>
                <div className={styles.rowMain}>
                  <strong>{item.customerName}</strong>
                  <span>
                    {item.serviceName} · {item.professionalName}
                  </span>
                  <code>{phoneLabel(item.customerPhone)}</code>
                </div>
                <div className={styles.rowMeta}>
                  <span
                    className={`${styles.badge} ${
                      item.status === "scheduled"
                        ? styles.badgePending
                        : item.status === "no_show" || item.status.startsWith("cancelled")
                          ? styles.badgeDanger
                          : item.status === "confirmed"
                            ? styles.badgeLive
                            : ""
                    }`}
                  >
                    {APPOINTMENT_STATUS[item.status]}
                  </span>
                  <code>{money(item.priceCents)}</code>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {selected ? (
        <Drawer
          footer={
            <>
              {selected.status === "scheduled" ? (
                <button
                  className={styles.button}
                  disabled={busy}
                  onClick={() =>
                    void act(() => actions.approveAppointment(selected.id), "Reserva aprovada")
                  }
                  type="button"
                >
                  Aprovar
                </button>
              ) : null}
              {active && !cancelling ? (
                <>
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => {
                      setSelectedId(null);
                      openNew({ appointment: selected });
                    }}
                    type="button"
                  >
                    Remarcar
                  </button>
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => actions.completeAppointment(selected.id),
                        "Atendimento concluído",
                      )
                    }
                    type="button"
                  >
                    Concluir
                  </button>
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() =>
                      void act(() => actions.markAppointmentNoShow(selected.id), "Falta registrada")
                    }
                    type="button"
                  >
                    Marcar falta
                  </button>
                  <button
                    className={styles.danger}
                    onClick={() => setCancelling(true)}
                    type="button"
                  >
                    {selected.status === "scheduled" ? "Recusar" : "Cancelar pela loja"}
                  </button>
                </>
              ) : null}
              {cancelling ? (
                <>
                  <button
                    className={styles.secondary}
                    onClick={() => setCancelling(false)}
                    type="button"
                  >
                    Voltar
                  </button>
                  <button
                    className={styles.danger}
                    disabled={busy || reason.trim().length < 3}
                    onClick={() =>
                      void act(
                        () => actions.refuseAppointment(selected.id, reason.trim()),
                        "Agendamento cancelado pela loja",
                      )
                    }
                    type="button"
                  >
                    Confirmar
                  </button>
                </>
              ) : null}
            </>
          }
          label={APPOINTMENT_STATUS[selected.status].toUpperCase()}
          onClose={() => setSelectedId(null)}
          title={selected.customerName}
        >
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span>Horário</span>
              <strong>{timeLabel(selected.startsAt, operation.summary.timezone)}</strong>
            </div>
            <div className={styles.metric}>
              <span>Duração</span>
              <strong>{duration(selected.serviceMinutes)}</strong>
            </div>
            <div className={styles.metric}>
              <span>Valor</span>
              <strong>{money(selected.priceCents)}</strong>
            </div>
            <div className={styles.metric}>
              <span>Sinal registrado</span>
              <strong>{money(selected.depositCents)}</strong>
            </div>
          </div>
          <div className={styles.form}>
            <div className={styles.rowMain}>
              <span>Serviço</span>
              <strong>{selected.serviceName}</strong>
            </div>
            <div className={styles.rowMain}>
              <span>Profissional</span>
              <strong>{selected.professionalName}</strong>
            </div>
            <div className={styles.rowMain}>
              <span>Contato</span>
              <strong>{phoneLabel(selected.customerPhone)}</strong>
              <small>
                {selected.hasAccount ? "Cliente com conta no app" : "Cliente sem conta"}
              </small>
            </div>
            {selected.notes ? (
              <div className={styles.rowMain}>
                <span>Observação</span>
                <strong>{selected.notes}</strong>
              </div>
            ) : null}
            {selected.cancellationReason ? (
              <p className={styles.notice}>Motivo: {selected.cancellationReason}</p>
            ) : null}
            {cancelling ? (
              <label className={styles.field}>
                Motivo do cancelamento pela loja
                <textarea
                  autoFocus
                  onChange={(event) => setReason(event.target.value)}
                  value={reason}
                />
              </label>
            ) : null}
            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}
