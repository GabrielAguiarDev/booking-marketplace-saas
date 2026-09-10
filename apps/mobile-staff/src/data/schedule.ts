import { useAsync } from "@vez/mobile-kit/async";

import { supabase } from "../../lib/supabase";

export type BusinessHour = { weekday: number; opensAt: string; closesAt: string };
export type ProfessionalSchedule = {
  professionalId: string;
  professionalName: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
};
export type ScheduleException = {
  id: string;
  professionalId: string | null;
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  isAvailable: boolean;
  reason: string | null;
};

/** Funcionamento da loja. Várias linhas no mesmo dia são turnos (fecha para almoço). */
export function useBusinessHours(establishmentId: string | null) {
  return useAsync(
    `hours:${establishmentId}`,
    async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("weekday, opens_at, closes_at")
        .eq("establishment_id", establishmentId!)
        .order("weekday")
        .order("opens_at");
      if (error) throw new Error(error.message);
      return (data ?? []).map<BusinessHour>((row) => ({
        weekday: row.weekday,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
      }));
    },
    { enabled: Boolean(establishmentId) },
  );
}

/** Jornada de cada profissional. É ela que gera horário; a loja só recorta. */
export function useProfessionalSchedules(establishmentId: string | null) {
  return useAsync(
    `schedules:${establishmentId}`,
    async () => {
      const { data, error } = await supabase
        .from("professional_schedules")
        .select(
          "professional_id, weekday, starts_at, ends_at, professionals!inner(display_name, establishment_id)",
        )
        .eq("professionals.establishment_id", establishmentId!)
        .order("weekday");
      if (error) throw new Error(error.message);
      return (
        (data ?? []) as unknown as {
          professional_id: string;
          weekday: number;
          starts_at: string;
          ends_at: string;
          professionals: { display_name: string };
        }[]
      ).map<ProfessionalSchedule>((row) => ({
        professionalId: row.professional_id,
        professionalName: row.professionals.display_name,
        weekday: row.weekday,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }));
    },
    { enabled: Boolean(establishmentId) },
  );
}

export function useExceptions(establishmentId: string | null, from: string, to: string) {
  return useAsync(
    `exceptions:${establishmentId}:${from}:${to}`,
    async () => {
      const { data, error } = await supabase
        .from("schedule_exceptions")
        .select("id, professional_id, exception_date, starts_at, ends_at, is_available, reason")
        .eq("establishment_id", establishmentId!)
        .gte("exception_date", from)
        .lte("exception_date", to)
        .order("exception_date");
      if (error) throw new Error(error.message);
      return (data ?? []).map<ScheduleException>((row) => ({
        id: row.id,
        professionalId: row.professional_id,
        date: row.exception_date,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        isAvailable: row.is_available,
        reason: row.reason,
      }));
    },
    { enabled: Boolean(establishmentId) },
  );
}

/**
 * Horários livres, direto da função do Postgres.
 *
 * Regra R1 do projeto: nenhuma superfície calcula disponibilidade em
 * TypeScript. O app do estabelecimento é justamente onde a tentação apareceria
 * — ele já tem a agenda inteira do dia na mão — e é onde o erro seria pior: a
 * loja ofereceria por telefone um horário que o app acabou de vender.
 */
export function useAvailableSlots(input: {
  establishmentId: string | null;
  serviceId: string | null;
  date: string;
  professionalId: string | null;
}) {
  const { establishmentId, serviceId, date, professionalId } = input;
  return useAsync(
    `slots:${establishmentId}:${serviceId}:${date}:${professionalId}`,
    async () => {
      const { data, error } = await supabase.rpc("available_slots", {
        p_establishment_id: establishmentId!,
        p_service_id: serviceId!,
        p_date: date,
        p_professional_id: professionalId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as { professional_id: string; slot_start: string; slot_end: string }[];
    },
    { enabled: Boolean(establishmentId && serviceId) },
  );
}

type Result = { ok: boolean; message?: string };

/**
 * Bloqueia um período.
 *
 * `is_available: false` é o bloqueio; a mesma tabela guarda o contrário — o
 * sábado extra que alguém resolveu abrir — e por isso ela não se chama
 * "bloqueios". `professional_id` nulo vale para a loja inteira.
 */
export async function createBlock(input: {
  establishmentId: string;
  professionalId: string | null;
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  reason: string | null;
}): Promise<Result> {
  const { error } = await supabase.from("schedule_exceptions").insert({
    establishment_id: input.establishmentId,
    professional_id: input.professionalId,
    exception_date: input.date,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    is_available: false,
    reason: input.reason,
  });
  return error ? { ok: false, message: "Não foi possível bloquear o período." } : { ok: true };
}

export async function removeBlock(id: string): Promise<Result> {
  const { error } = await supabase.from("schedule_exceptions").delete().eq("id", id);
  return error ? { ok: false, message: "Não foi possível liberar o período." } : { ok: true };
}

/** "ABERTO ATÉ 18:00" / "FECHADO HOJE" — a linha do cabeçalho. */
export function openingLabel(hours: BusinessHour[], date: Date): string {
  const today = hours.filter((hour) => hour.weekday === date.getDay());
  if (today.length === 0) return "FECHADO HOJE";

  const closes = today.reduce(
    (latest, hour) => (hour.closesAt > latest ? hour.closesAt : latest),
    "",
  );
  const opens = today.reduce(
    (earliest, hour) => (earliest === "" || hour.opensAt < earliest ? hour.opensAt : earliest),
    "",
  );

  const now = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
  if (now < opens) return `ABRE ÀS ${opens.slice(0, 5)}`;
  if (now >= closes) return "JÁ FECHOU HOJE";
  return `ABERTO ATÉ ${closes.slice(0, 5)}`;
}
