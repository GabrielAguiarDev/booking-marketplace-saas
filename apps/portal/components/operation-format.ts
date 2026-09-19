import type {
  OperationAppointmentStatus,
  OperationQueueSource,
  OperationQueueStatus,
} from "./operation-model";

export const APPOINTMENT_STATUS: Record<OperationAppointmentStatus, string> = {
  scheduled: "Aguardando aprovação",
  confirmed: "Confirmado",
  completed: "Concluído",
  no_show: "Não compareceu",
  cancelled_by_customer: "Cancelado pelo cliente",
  cancelled_by_establishment: "Recusado pela loja",
};

export const QUEUE_STATUS: Record<OperationQueueStatus, string> = {
  waiting: "Esperando",
  called: "Chamado",
  in_service: "Em atendimento",
  done: "Concluído",
  left: "Saiu da fila",
  no_show: "Ausente",
};

export const QUEUE_SOURCE: Record<OperationQueueSource, string> = {
  app: "App",
  qr: "QR code",
  counter: "Balcão",
};

export function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function duration(minutes: number | null): string {
  if (minutes === null) return "Duração não informada";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export function localDay(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function dateLabel(day: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${day}T12:00:00`));
}

export function timeLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function dateTimeLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function phoneLabel(phone: string | null): string {
  return phone?.trim() || "Sem telefone";
}
