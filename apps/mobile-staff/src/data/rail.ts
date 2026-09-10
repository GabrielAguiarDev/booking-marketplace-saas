import type { Appointment } from "./appointments";
import type { BusinessHour, ScheduleException } from "./schedule";

export type RailItem =
  | { kind: "appointment"; start: Date; end: Date; appointment: Appointment }
  | { kind: "gap"; start: Date; end: Date; minutes: number }
  | { kind: "block"; start: Date; end: Date; label: string }
  | { kind: "queue"; start: Date; end: Date };

function at(date: Date, time: string): Date {
  const [hours = "0", minutes = "0"] = time.split(":");
  const copy = new Date(date);
  copy.setHours(Number(hours), Number(minutes), 0, 0);
  return copy;
}

/** Une intervalos que se tocam, para o cálculo de buraco. */
function merge(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * O trilho do dia — o elemento de assinatura desta tela.
 *
 * Ele mistura quatro coisas que vivem em tabelas diferentes e que o atendente
 * enxerga como uma linha só: reserva, bloqueio, buraco e a faixa da fila.
 *
 * **O que é "buraco" aqui.** Com três cadeiras, "livre" não é o intervalo entre
 * dois agendamentos — é o intervalo em que *ninguém* está atendendo. Por isso
 * os intervalos ocupados são unidos antes: o tempo em que só o Rai está livre
 * não vira convite para preencher, porque a loja não está parada.
 *
 * **Onde entra a fila.** Se a loja atende por ordem de chegada, quem está
 * esperando não tem hora — ocupa o "agora". A faixa é desenhada nesse ponto,
 * e não numa linha da grade, porque é isso que ela é: o presente ocupando o
 * espaço que o calendário deixou vago.
 */
export function buildRail(input: {
  appointments: Appointment[];
  hours: BusinessHour[];
  exceptions: ScheduleException[];
  queueWaiting: number;
  now: Date;
  minimumGapMinutes: number;
}): { items: RailItem[]; freeMinutes: number } {
  const { appointments, hours, exceptions, queueWaiting, now, minimumGapMinutes } = input;

  const today = hours.filter((hour) => hour.weekday === now.getDay());
  const dayStart =
    today.length > 0
      ? at(
          now,
          today.reduce((min, h) => (h.opensAt < min ? h.opensAt : min), today[0]!.opensAt),
        )
      : at(now, "08:00");
  const dayEnd =
    today.length > 0
      ? at(
          now,
          today.reduce((max, h) => (h.closesAt > max ? h.closesAt : max), today[0]!.closesAt),
        )
      : at(now, "20:00");

  const blocks = exceptions
    .filter((exception) => !exception.isAvailable)
    .map((exception) => ({
      kind: "block" as const,
      start: exception.startsAt ? at(now, exception.startsAt) : dayStart,
      end: exception.endsAt ? at(now, exception.endsAt) : dayEnd,
      label: exception.reason ?? "Bloqueado",
    }));

  const visible = appointments.filter(
    (appointment) =>
      appointment.status !== "cancelled_by_customer" &&
      appointment.status !== "cancelled_by_establishment",
  );

  const busy = merge([
    ...visible.map((appointment) => ({
      start: new Date(appointment.startsAt).getTime(),
      end: new Date(appointment.endsAt).getTime(),
    })),
    ...blocks.map((block) => ({ start: block.start.getTime(), end: block.end.getTime() })),
  ]);

  const gaps: RailItem[] = [];
  let cursor = dayStart.getTime();

  for (const range of busy) {
    if (range.start > cursor) gaps.push(gapItem(cursor, range.start));
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < dayEnd.getTime()) gaps.push(gapItem(cursor, dayEnd.getTime()));

  function gapItem(start: number, end: number): RailItem {
    return {
      kind: "gap",
      start: new Date(start),
      end: new Date(end),
      minutes: Math.round((end - start) / 60_000),
    };
  }

  const freeMinutes = gaps.reduce((sum, gap) => sum + (gap.kind === "gap" ? gap.minutes : 0), 0);

  const items: RailItem[] = [
    ...visible.map<RailItem>((appointment) => ({
      kind: "appointment",
      start: new Date(appointment.startsAt),
      end: new Date(appointment.endsAt),
      appointment,
    })),
    ...blocks,
    // Buraco muito curto não é oportunidade: é o intervalo entre um corte e
    // outro. Mostrá-lo enche o trilho de linhas que ninguém vai preencher.
    ...gaps.filter((gap) => gap.kind === "gap" && gap.minutes >= minimumGapMinutes),
  ];

  if (queueWaiting > 0) {
    items.push({ kind: "queue", start: now, end: now });
  }

  items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { items, freeMinutes };
}
