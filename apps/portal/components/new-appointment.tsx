"use client";

import { useEffect, useMemo, useState } from "react";

import type { NewAppointmentSeed } from "./agenda";
import { dateLabel, duration, localDay, money, timeLabel } from "./operation-format";
import type { AvailableSlot } from "./operation-model";
import styles from "./operation.module.css";
import { usePortal } from "./store";

export function NewAppointment({
  seed,
  onClose,
  onSuccess,
}: {
  seed: NewAppointmentSeed;
  onClose: () => void;
  onSuccess: (title: string, sub: string) => void;
}) {
  const { data, actions } = usePortal();
  const operation = data?.operation;
  const appointment = seed.appointment;
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? "");
  const [professionalId, setProfessionalId] = useState(appointment?.professionalId ?? "");
  const [day, setDay] = useState(
    appointment && operation
      ? localDay(appointment.startsAt, operation.summary.timezone)
      : (operation?.summary.localDay ?? ""),
  );
  const [startsAt, setStartsAt] = useState("");
  const [name, setName] = useState(appointment?.customerName ?? "");
  const [phone, setPhone] = useState(appointment?.customerPhone ?? "");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [slotResult, setSlotResult] = useState<{
    key: string;
    slots: AvailableSlot[];
    error: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const service = operation?.services.find((item) => item.id === serviceId) ?? null;
  const professionals = useMemo(
    () =>
      operation?.professionals.filter(
        (professional) => !service || service.professionalIds.includes(professional.id),
      ) ?? [],
    [operation, service],
  );

  const slotKey =
    data && serviceId && professionalId && day
      ? `${data.establishment.id}:${serviceId}:${professionalId}:${day}`
      : null;

  useEffect(() => {
    if (!data || !serviceId || !professionalId || !day || !slotKey) return;
    let active = true;
    void actions
      .availableSlots({
        establishmentId: data.establishment.id,
        serviceId,
        professionalId,
        date: day,
      })
      .then((result) => {
        if (active) setSlotResult({ key: slotKey, slots: result, error: "" });
      })
      .catch((caught) => {
        if (active) {
          setSlotResult({
            key: slotKey,
            slots: [],
            error:
              caught instanceof Error ? caught.message : "Não foi possível carregar os horários.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [actions, data, day, professionalId, serviceId, slotKey]);

  if (!data || !operation) return null;

  const currentSlotResult = slotResult?.key === slotKey ? slotResult : null;
  const slots = currentSlotResult?.slots ?? [];
  const loadingSlots = Boolean(slotKey) && currentSlotResult === null;
  const slotError = currentSlotResult?.error ?? "";

  const canSave = Boolean(
    startsAt && serviceId && professionalId && (appointment || name.trim().length >= 2),
  );

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      if (appointment) {
        await actions.rescheduleAppointment(data.establishment.id, appointment.id, startsAt);
        onSuccess(
          "Agendamento remarcado",
          `${appointment.customerName} · ${dateLabel(day)}, ${timeLabel(startsAt, operation.summary.timezone)}.`,
        );
      } else {
        await actions.createGuestAppointment({
          establishmentId: data.establishment.id,
          professionalId,
          serviceId,
          startsAt,
          guestName: name.trim(),
          guestPhone: phone.trim() || null,
          notes: notes.trim() || null,
        });
        onSuccess("Agendamento criado", `${name.trim()} foi agendado como cliente sem conta.`);
      }
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o agendamento.");
      setStartsAt("");
      const fresh = await actions
        .availableSlots({
          establishmentId: data.establishment.id,
          serviceId,
          professionalId,
          date: day,
        })
        .catch(() => []);
      if (slotKey) setSlotResult({ key: slotKey, slots: fresh, error: "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <button className={styles.scrim} onClick={onClose} type="button" />
      <aside className={styles.drawer}>
        <header className={styles.drawerHeader}>
          <div>
            <code>{appointment ? "REMARCAR" : "NOVO AGENDAMENTO"}</code>
            <strong>
              {appointment ? appointment.customerName : "Cliente de balcão ou telefone"}
            </strong>
          </div>
          <button className={styles.iconButton} onClick={onClose} type="button">
            Fechar
          </button>
        </header>

        <div className={styles.drawerBody}>
          {!appointment ? (
            <>
              <p className={styles.notice}>
                Este fluxo cadastra uma reserva para quem ainda não tem conta. Ela fica visível só
                para a equipe e nasce confirmada.
              </p>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  Nome do cliente
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
              </div>
            </>
          ) : null}

          <label className={styles.field}>
            Serviço
            <select
              disabled={Boolean(appointment)}
              onChange={(event) => {
                setServiceId(event.target.value);
                setProfessionalId("");
                setStartsAt("");
              }}
              value={serviceId}
            >
              <option value="">Selecione</option>
              {operation.services.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {duration(item.durationMinutes)} · {money(item.priceCents)}
                </option>
              ))}
            </select>
          </label>

          {service ? (
            <label className={styles.field}>
              Profissional
              <select
                disabled={Boolean(appointment)}
                onChange={(event) => {
                  setProfessionalId(event.target.value);
                  setStartsAt("");
                }}
                value={professionalId}
              >
                <option value="">Selecione</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {service && professionals.length === 0 ? (
            <p className={styles.error}>Nenhum profissional ativo executa este serviço.</p>
          ) : null}

          {professionalId ? (
            <label className={styles.field}>
              Data
              <input
                min={operation.summary.localDay}
                onChange={(event) => {
                  setDay(event.target.value);
                  setStartsAt("");
                }}
                type="date"
                value={day}
              />
            </label>
          ) : null}

          {professionalId && day ? (
            <section className={styles.field}>
              <span>Horários livres</span>
              <small className={styles.subtle}>
                A disponibilidade abaixo vem de available_slots() no Postgres.
              </small>
              {loadingSlots ? <p className={styles.empty}>Consultando a agenda…</p> : null}
              {!loadingSlots && slots.length === 0 ? (
                <p className={styles.empty}>Nenhum horário livre nesta data.</p>
              ) : null}
              {!loadingSlots && slots.length ? (
                <div className={styles.slots}>
                  {slots.map((slot) => (
                    <button
                      aria-pressed={startsAt === slot.startsAt}
                      className={`${styles.slot} ${startsAt === slot.startsAt ? styles.slotSelected : ""}`}
                      key={`${slot.professionalId}-${slot.startsAt}`}
                      onClick={() => setStartsAt(slot.startsAt)}
                      type="button"
                    >
                      {timeLabel(slot.startsAt, operation.summary.timezone)}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {!appointment ? (
            <label className={styles.field}>
              Observação (opcional)
              <textarea onChange={(event) => setNotes(event.target.value)} value={notes} />
            </label>
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}
          {slotError ? <p className={styles.error}>{slotError}</p> : null}
        </div>

        <footer className={styles.drawerFooter}>
          <button className={styles.secondary} disabled={saving} onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className={styles.button}
            disabled={!canSave || saving}
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Salvando…" : appointment ? "Confirmar remarcação" : "Criar agendamento"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
