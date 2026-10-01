"use client";

import { useMemo, useState } from "react";

import { QUEUE_SOURCE, QUEUE_STATUS, phoneLabel, timeLabel } from "./operation-format";
import type { OperationQueueEntry } from "./operation-model";
import styles from "./operation.module.css";
import type { Notify } from "./portal";
import { usePortal } from "./store";

export function Queue({ notify }: { notify: Notify }) {
  const { data, actions } = usePortal();
  const operation = data?.operation;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    if (!operation) return [];
    const rank = (entry: OperationQueueEntry) => {
      if (entry.status === "in_service") return 0;
      if (entry.status === "called") return 1;
      return 2;
    };
    return [...operation.queue].sort((a, b) => {
      const status = rank(a) - rank(b);
      if (status) return status;
      if (a.status === "waiting" && b.status === "waiting") {
        return (a.position || Number.MAX_SAFE_INTEGER) - (b.position || Number.MAX_SAFE_INTEGER);
      }
      return a.joinedAt.localeCompare(b.joinedAt);
    });
  }, [operation]);

  if (!operation || !data) return null;

  const waiting = rows.filter((item) => item.status === "waiting" && item.position > 0);
  const first = waiting.find((item) => item.position === 1) ?? null;
  const called = rows.filter((item) => item.status === "called").length;
  const inService = rows.filter((item) => item.status === "in_service").length;

  const run = async (id: string, action: () => Promise<void>, title: string) => {
    setBusy(id);
    setError("");
    try {
      await action();
      notify({ title, sub: "A fila já está atualizada no portal e no app da equipe." });
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a fila.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const moveUp = (entry: OperationQueueEntry) => {
    const above = waiting.find((item) => item.position === entry.position - 1);
    if (!above) return;
    void run(
      entry.id,
      () => actions.reorderQueueEntry(data.establishment.id, entry.id, above.id),
      `${entry.customerName} subiu uma posição`,
    );
  };

  return (
    <div className={styles.page}>
      <section className={styles.kpis}>
        <article className={styles.kpi}>
          <span>Esperando</span>
          <strong>{waiting.length}</strong>
          <small>Na ordem de chamada</small>
        </article>
        <article className={styles.kpi}>
          <span>Chamados</span>
          <strong>{called}</strong>
          <small>Aguardando sentar</small>
        </article>
        <article className={styles.kpi}>
          <span>Em atendimento</span>
          <strong>{inService}</strong>
          <small>Já sentaram</small>
        </article>
        <article className={styles.kpi}>
          <span>Regra de chegada</span>
          <strong>{operation.queueRequireArrival ? "Obrigatória" : "Desligada"}</strong>
          <small>
            {operation.queueRequireArrival
              ? "Só entra na posição depois de chegar"
              : "Entra na posição ao pedir"}
          </small>
        </article>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <span className={`${styles.badge} ${styles.badgeLive}`}>Tempo real</span>
          <h2>Fila ativa</h2>
          <div className={styles.actions}>
            <button
              className={styles.button}
              disabled={!first || busy !== null}
              onClick={() =>
                first
                  ? void run(
                      first.id,
                      () => actions.callQueueEntry(first.id),
                      `Chamando ${first.customerName}`,
                    )
                  : undefined
              }
              type="button"
            >
              Chamar próximo
            </button>
            <button
              className={styles.secondary}
              onClick={() => setAdding((value) => !value)}
              type="button"
            >
              {adding ? "Fechar cadastro" : "Adicionar no balcão"}
            </button>
          </div>
        </header>

        {adding ? (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                "new",
                () =>
                  actions.addWalkIn({
                    establishmentId: data.establishment.id,
                    name: name.trim(),
                    phone: phone.trim() || null,
                    serviceId: serviceId || null,
                  }),
                `${name.trim()} entrou na fila`,
              ).then((ok) => {
                if (!ok) return;
                setName("");
                setPhone("");
                setServiceId("");
                setAdding(false);
              });
            }}
          >
            <p className={styles.notice}>
              Quem chegou sem conta entra como cliente de balcão e já fica com chegada confirmada.
            </p>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                Nome
                <input
                  required
                  minLength={2}
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              <label className={styles.field}>
                Telefone (opcional)
                <input
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  value={phone}
                />
              </label>
              <label className={styles.field}>
                Serviço (opcional)
                <select onChange={(event) => setServiceId(event.target.value)} value={serviceId}>
                  <option value="">Não informado</option>
                  {operation.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.button}
                disabled={busy === "new" || name.trim().length < 2}
                type="submit"
              >
                Colocar na fila
              </button>
            </div>
          </form>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.list}>
          {rows.length === 0 ? (
            <p className={styles.empty}>Ninguém na fila agora.</p>
          ) : (
            rows.map((entry) => {
              const awaitingArrival =
                entry.status === "waiting" && operation.queueRequireArrival && !entry.arrivedAt;
              return (
                <div className={styles.row} key={entry.id}>
                  <span
                    className={`${styles.position} ${entry.position === 1 ? styles.positionFirst : ""}`}
                  >
                    {entry.position || "•"}
                  </span>
                  <div className={styles.rowMain}>
                    <strong>{entry.customerName}</strong>
                    <span>
                      {entry.serviceName ?? "Serviço não informado"} · {QUEUE_SOURCE[entry.source]}
                    </span>
                    <code>{phoneLabel(entry.customerPhone)}</code>
                  </div>
                  <div className={styles.rowMeta}>
                    <span
                      className={`${styles.badge} ${
                        entry.status === "waiting"
                          ? styles.badgePending
                          : entry.status === "in_service"
                            ? styles.badgeLive
                            : ""
                      }`}
                    >
                      {awaitingArrival ? "Aguardando chegada" : QUEUE_STATUS[entry.status]}
                    </span>
                    <strong>{entry.position ? `${entry.estimatedWaitMinutes} min` : "—"}</strong>
                    <code>entrou {timeLabel(entry.joinedAt, operation.summary.timezone)}</code>
                  </div>
                  <div className={styles.actions}>
                    {awaitingArrival ? (
                      <button
                        className={styles.secondary}
                        disabled={busy === entry.id}
                        onClick={() =>
                          void run(
                            entry.id,
                            () => actions.confirmQueueArrival(entry.id),
                            "Chegada confirmada",
                          )
                        }
                        type="button"
                      >
                        Confirmar chegada
                      </button>
                    ) : null}
                    {entry.status === "waiting" && entry.position === 1 ? (
                      <button
                        className={styles.button}
                        disabled={busy === entry.id}
                        onClick={() =>
                          void run(
                            entry.id,
                            () => actions.callQueueEntry(entry.id),
                            `Chamando ${entry.customerName}`,
                          )
                        }
                        type="button"
                      >
                        Chamar
                      </button>
                    ) : null}
                    {entry.status === "waiting" && entry.position > 1 ? (
                      <button
                        className={styles.secondary}
                        disabled={busy === entry.id}
                        onClick={() => moveUp(entry)}
                        type="button"
                      >
                        Subir uma posição
                      </button>
                    ) : null}
                    {entry.status === "called" ? (
                      <button
                        className={styles.button}
                        disabled={busy === entry.id}
                        onClick={() =>
                          void run(
                            entry.id,
                            () => actions.seatQueueEntry(entry.id),
                            `${entry.customerName} sentou`,
                          )
                        }
                        type="button"
                      >
                        Sentar
                      </button>
                    ) : null}
                    {entry.status === "in_service" ? (
                      <button
                        className={styles.button}
                        disabled={busy === entry.id}
                        onClick={() =>
                          void run(
                            entry.id,
                            () => actions.finishQueueEntry(entry.id),
                            "Atendimento concluído",
                          )
                        }
                        type="button"
                      >
                        Concluir
                      </button>
                    ) : null}
                    {entry.status !== "in_service" ? (
                      <button
                        className={styles.danger}
                        disabled={busy === entry.id}
                        onClick={() =>
                          void run(
                            entry.id,
                            () => actions.markQueueEntryAbsent(entry.id),
                            "Ausência registrada",
                          )
                        }
                        type="button"
                      >
                        Ausente
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
