import { useAsync } from "@vez/mobile-kit/async";
import type { Database } from "@vez/supabase/types";

import { supabase } from "../../lib/supabase";
import { color } from "../theme/tokens";

export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

export type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  priceCents: number;
  depositCents: number;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: string;
  customerId: string | null;
  professionalId: string;
  serviceId: string;
  name: string;
  phone: string | null;
  hasAccount: boolean;
  serviceName: string;
  serviceMinutes: number;
  professionalName: string;
};

type Row = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number;
  deposit_cents: number;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  customer_id: string | null;
  professional_id: string;
  service_id: string;
  guest_name: string | null;
  guest_phone: string | null;
  services: { name: string; duration_minutes: number } | null;
  professionals: { display_name: string } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

const COLUMNS =
  "id, starts_at, ends_at, status, price_cents, deposit_cents, notes, cancellation_reason," +
  " created_at, customer_id, professional_id, service_id, guest_name, guest_phone," +
  " services(name, duration_minutes), professionals(display_name)," +
  " profiles:customer_id(full_name, phone)";

function toAppointment(row: Row): Appointment {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    priceCents: row.price_cents,
    depositCents: row.deposit_cents,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    customerId: row.customer_id,
    professionalId: row.professional_id,
    serviceId: row.service_id,
    name: row.profiles?.full_name ?? row.guest_name ?? "Sem nome",
    phone: row.profiles?.phone ?? row.guest_phone,
    hasAccount: row.customer_id !== null,
    serviceName: row.services?.name ?? "Serviço removido",
    serviceMinutes: row.services?.duration_minutes ?? 30,
    professionalName: row.professionals?.display_name ?? "—",
  };
}

/** Reservas de um intervalo. `from` inclusivo, `to` exclusivo, os dois em ISO. */
export function useAppointments(
  establishmentId: string | null,
  from: string,
  to: string,
  professionalId: string | null = null,
) {
  return useAsync(
    `appointments:${establishmentId}:${from}:${to}:${professionalId}`,
    async () => {
      let query = supabase
        .from("appointments")
        .select(COLUMNS)
        .eq("establishment_id", establishmentId!)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at");

      if (professionalId) query = query.eq("professional_id", professionalId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as Row[]).map(toAppointment);
    },
    { enabled: Boolean(establishmentId) },
  );
}

/**
 * Pedidos esperando o sim da loja.
 *
 * `scheduled` é o estado de quem pediu e ainda não foi respondido; `confirmed`
 * é o de quem foi aprovado. Com "aprovar automaticamente" ligado nas regras, a
 * Edge Function já grava `confirmed` e esta lista nasce vazia — que é o ponto
 * do interruptor.
 */
export function usePending(establishmentId: string | null) {
  return useAsync(
    `pending:${establishmentId}`,
    async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(COLUMNS)
        .eq("establishment_id", establishmentId!)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(20);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as Row[]).map(toAppointment);
    },
    { enabled: Boolean(establishmentId) },
  );
}

export function useAppointment(id: string | null) {
  return useAsync(
    `appointment:${id}`,
    async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(COLUMNS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toAppointment(data as unknown as Row) : null;
    },
    { enabled: Boolean(id) },
  );
}

/** Quantas vezes esse cliente já foi atendido aqui. Só existe para quem tem conta. */
export function useCustomerHistory(establishmentId: string | null, customerId: string | null) {
  return useAsync(
    `history:${establishmentId}:${customerId}`,
    async () => {
      const { count, error } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId!)
        .eq("customer_id", customerId!)
        .eq("status", "completed");
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    { enabled: Boolean(establishmentId && customerId) },
  );
}

type Result = { ok: boolean; message?: string };

type Update = Database["public"]["Tables"]["appointments"]["Update"];

async function setStatus(id: string, patch: Update, fallback: string) {
  const { error } = await supabase.from("appointments").update(patch).eq("id", id);
  return error ? { ok: false, message: fallback } : { ok: true };
}

export function approveAppointment(id: string): Promise<Result> {
  return setStatus(id, { status: "confirmed" }, "Não foi possível aprovar.");
}

/**
 * Recusa e cancelamento pela loja são a mesma transição de status.
 *
 * O motivo é gravado porque ele sai daqui e chega no cliente: a política de
 * `appointments` deixa a equipe escrever, e o app do cliente lê. Recusar sem
 * dizer por quê é o tipo de silêncio que faz a pessoa não voltar.
 */
export function refuseAppointment(id: string, reason: string): Promise<Result> {
  return setStatus(
    id,
    {
      status: "cancelled_by_establishment",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    },
    "Não foi possível recusar.",
  );
}

export function completeAppointment(id: string): Promise<Result> {
  return setStatus(id, { status: "completed" }, "Não foi possível concluir.");
}

export function markNoShow(id: string): Promise<Result> {
  return setStatus(id, { status: "no_show" }, "Não foi possível marcar a falta.");
}

/** Remarcar move o intervalo inteiro; a duração vem do serviço, não do dedo. */
export function rescheduleAppointment(
  id: string,
  startsAt: string,
  minutes: number,
): Promise<Result> {
  const ends = new Date(new Date(startsAt).getTime() + minutes * 60_000).toISOString();
  return setStatus(
    id,
    { starts_at: startsAt, ends_at: ends, status: "confirmed" },
    "Esse horário não está livre. Escolha outro.",
  );
}

/**
 * Agendamento criado no balcão ou por telefone.
 *
 * Vai por insert direto, e não pela Edge Function de reserva, porque as três
 * razões da função não valem deste lado: o preço não precisa ser congelado
 * contra o cliente (quem cobra é quem está digitando), o sinal não se aplica a
 * quem vai pagar na cadeira, e o horário veio de `available_slots()` logo
 * acima. A corrida por horário continua sendo resolvida onde sempre foi: a
 * constraint `appointments_no_overlap` devolve 23P01 e a tela avisa.
 */
export async function createAppointment(input: {
  establishmentId: string;
  professionalId: string;
  serviceId: string;
  startsAt: string;
  minutes: number;
  priceCents: number;
  name: string;
  phone: string | null;
  notes: string | null;
}): Promise<Result> {
  const ends = new Date(new Date(input.startsAt).getTime() + input.minutes * 60_000).toISOString();

  const { error } = await supabase.from("appointments").insert({
    establishment_id: input.establishmentId,
    professional_id: input.professionalId,
    service_id: input.serviceId,
    customer_id: null,
    guest_name: input.name,
    guest_phone: input.phone,
    starts_at: input.startsAt,
    ends_at: ends,
    // Criado pela loja já nasce aprovado: não faz sentido a loja pedir
    // permissão para si mesma.
    status: "confirmed",
    price_cents: input.priceCents,
    deposit_cents: 0,
    notes: input.notes,
  });

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, message: "Esse horário acabou de ser ocupado. Escolha outro." };
    }
    return { ok: false, message: "Não foi possível criar o agendamento." };
  }
  return { ok: true };
}

/** Como cada estado se apresenta: rótulo, traço e tinta. */
export function presentation(
  appointment: Appointment,
  now: number = Date.now(),
): { label: string; tint: string; background: string; strike: boolean; live: boolean } {
  const start = new Date(appointment.startsAt).getTime();
  const end = new Date(appointment.endsAt).getTime();

  switch (appointment.status) {
    case "completed":
      return {
        label: "FEITO",
        tint: color.faint,
        background: color.rest,
        strike: false,
        live: false,
      };
    case "no_show":
      return {
        label: "NÃO VEIO",
        tint: color.danger,
        background: color.dangerTint,
        strike: false,
        live: false,
      };
    case "cancelled_by_customer":
      return {
        label: "CANCELOU",
        tint: color.faint,
        background: color.rest,
        strike: true,
        live: false,
      };
    case "cancelled_by_establishment":
      return {
        label: "RECUSADO",
        tint: color.faint,
        background: color.rest,
        strike: true,
        live: false,
      };
    default:
      break;
  }

  if (now >= start && now < end) {
    return {
      label: "AGORA",
      tint: color.coral,
      background: color.coralTint,
      strike: false,
      live: true,
    };
  }
  // Atrasado é quem já passou da hora e não saiu de 'scheduled'/'confirmed'.
  // É o alerta mais útil do dia: ninguém marca falta olhando o relógio.
  if (now >= end) {
    return {
      label: "ATRASADO",
      tint: color.amber,
      background: color.amberTint,
      strike: false,
      live: false,
    };
  }
  if (appointment.status === "scheduled") {
    return {
      label: "AGUARDANDO",
      tint: color.amber,
      background: color.amberTint,
      strike: false,
      live: false,
    };
  }
  return {
    label: "CONFIRMADO",
    tint: color.green,
    background: color.greenTint,
    strike: false,
    live: false,
  };
}
