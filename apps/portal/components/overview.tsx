"use client";

import { useState } from "react";

import type { SectionId } from "./data";
import { Drawer } from "./drawer";
import { dateTimeLabel, duration, money, phoneLabel, timeLabel } from "./operation-format";
import type { OperationAppointment } from "./operation-model";
import styles from "./operation.module.css";
import type { Notify } from "./portal";
import { usePortal } from "./store";

export function Overview({ go, notify }: { go: (section: SectionId) => void; notify: Notify }) {
  const { data, actions } = usePortal();
  const operation = data?.operation;
  const [busy, setBusy] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<OperationAppointment | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!operation) return null;

  const { summary } = operation;
  const todayCount = summary.scheduledToday + summary.confirmedToday + summary.completedToday;
  const noShowRate = summary.finalized30
    ? `${Math.round((summary.noShow30 / summary.finalized30) * 100)}%`
    : "—";
  const pending = operation.pendingAppointments;

  const run = async (id: string, action: () => Promise<void>, title: string) => {
    setBusy(id);
    setError("");
    try {
      await action();
      notify({ title, sub: "A mudança já vale para toda a equipe." });
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a ação.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.kpis}>
        <article className={styles.kpi}>
          <span>Agendamentos hoje</span>
          <strong>{todayCount}</strong>
          <small>{summary.completedToday} concluídos</small>
        </article>
        <article className={styles.kpi}>
          <span>Faturamento concluído hoje</span>
          <strong>{money(summary.revenueTodayCents)}</strong>
          <small>Preço congelado dos atendimentos concluídos</small>
        </article>
        <article className={styles.kpi}>
          <span>Na fila agora</span>
          <strong>{summary.queueActive}</strong>
          <small>Esperando, chamados e em atendimento</small>
        </article>
        <article className={styles.kpi}>
          <span>Não comparecimento</span>
          <strong>{noShowRate}</strong>
          <small>
            {summary.finalized30
              ? `${summary.noShow30} de ${summary.finalized30} finalizados em 30 dias`
              : "Sem atendimentos finalizados em 30 dias"}
          </small>
        </article>
      </section>

      {error && !refusing ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.columns}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <h2>Aguardando aprovação</h2>
            <span className={`${styles.badge} ${styles.badgePending}`}>{pending.length}</span>
          </header>
          <div className={styles.list}>
            {pending.length === 0 ? (
              <p className={styles.empty}>Nenhuma reserva esperando aprovação.</p>
            ) : (
              pending.map((item) => (
                <div className={styles.row} key={item.id}>
                  <div className={styles.rowMain}>
                    <strong>{item.customerName}</strong>
                    <span>
                      {item.serviceName} · {item.professionalName} · {duration(item.serviceMinutes)}
                    </span>
                    <code>{phoneLabel(item.customerPhone)}</code>
                  </div>
                  <div className={styles.rowMeta}>
                    <strong>{dateTimeLabel(item.startsAt, summary.timezone)}</strong>
                    <code>{money(item.priceCents)}</code>
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.button}
                      disabled={busy === item.id}
                      onClick={() =>
                        void run(
                          item.id,
                          () => actions.approveAppointment(item.id),
                          "Reserva aprovada",
                        )
                      }
                      type="button"
                    >
                      Aprovar
                    </button>
                    <button
                      className={styles.danger}
                      disabled={busy === item.id}
                      onClick={() => {
                        setRefusing(item);
                        setReason("");
                      }}
                      type="button"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <h2>Fila agora</h2>
            <button className={styles.secondary} onClick={() => go("queue")} type="button">
              Abrir fila
            </button>
          </header>
          <div className={styles.list}>
            {operation.queue.length === 0 ? (
              <p className={styles.empty}>Ninguém na fila agora.</p>
            ) : (
              operation.queue.slice(0, 5).map((entry) => (
                <div className={styles.row} key={entry.id}>
                  <span className={styles.position}>{entry.position || "•"}</span>
                  <div className={styles.rowMain}>
                    <strong>{entry.customerName}</strong>
                    <span>{entry.serviceName ?? "Serviço não informado"}</span>
                  </div>
                  <div className={styles.rowMeta}>
                    <strong>{entry.estimatedWaitMinutes} min</strong>
                    <code>entrou {timeLabel(entry.joinedAt, summary.timezone)}</code>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {refusing ? (
        <Drawer
          footer={
            <>
              <button className={styles.secondary} onClick={() => setRefusing(null)} type="button">
                Voltar
              </button>
              <button
                className={styles.danger}
                disabled={reason.trim().length < 3 || busy === refusing.id}
                onClick={() =>
                  void run(
                    refusing.id,
                    () => actions.refuseAppointment(refusing.id, reason.trim()),
                    "Reserva recusada",
                  ).then((succeeded) => {
                    if (succeeded) setRefusing(null);
                  })
                }
                type="button"
              >
                Confirmar recusa
              </button>
            </>
          }
          label="RECUSAR RESERVA"
          onClose={() => setRefusing(null)}
          title={refusing.customerName}
        >
          <p className={styles.notice}>
            O motivo fica salvo no agendamento e aparece para clientes com conta. Cliente de balcão
            não recebe notificação automática.
          </p>
          <label className={styles.field}>
            Motivo
            <textarea
              autoFocus
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explique por que a loja não poderá atender neste horário"
              value={reason}
            />
          </label>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </Drawer>
      ) : null}
    </div>
  );
}
