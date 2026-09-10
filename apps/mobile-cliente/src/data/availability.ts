import { supabase } from "../../lib/supabase";
import { addDays, isoDate } from "@vez/mobile-kit/format";
import { useAsync } from "@vez/mobile-kit/async";

export type Slot = { professional_id: string; slot_start: string; slot_end: string };

/**
 * Horários livres de um dia.
 *
 * Chama `available_slots` por RPC. Esta é a única forma de o app saber o que
 * está livre — não existe, nem deve existir, um cálculo equivalente em
 * TypeScript. Ver decisions/0001.
 */
export function useSlots(params: {
  establishmentId: string | null;
  serviceId: string | null;
  date: Date;
  professionalId?: string | null;
}) {
  const { establishmentId, serviceId, date, professionalId = null } = params;
  const day = isoDate(date);

  return useAsync(
    `slots:${establishmentId}:${serviceId}:${day}:${professionalId}`,
    async () => {
      const { data, error } = await supabase.rpc("available_slots", {
        p_establishment_id: establishmentId!,
        p_service_id: serviceId!,
        p_date: day,
        p_professional_id: professionalId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Slot[];
    },
    { enabled: Boolean(establishmentId && serviceId) },
  );
}

export type DaySummary = { day: string; free_count: number; is_open: boolean };

/**
 * Quantos horários livres em cada um dos próximos dias.
 *
 * Alimenta a fita de dias e o anel de vez. Uma chamada em vez de sete: a função
 * `availability_summary` roda o mesmo cálculo no servidor, dia a dia.
 */
export function useAvailabilitySummary(params: {
  establishmentId: string | null;
  serviceId: string | null;
  days?: number;
  professionalId?: string | null;
}) {
  const { establishmentId, serviceId, days = 7, professionalId = null } = params;
  const from = isoDate(new Date());

  return useAsync(
    `summary:${establishmentId}:${serviceId}:${from}:${days}:${professionalId}`,
    async () => {
      const { data, error } = await supabase.rpc("availability_summary", {
        p_establishment_id: establishmentId!,
        p_service_id: serviceId!,
        p_from: from,
        p_days: days,
        p_professional_id: professionalId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as DaySummary[];
    },
    { enabled: Boolean(establishmentId && serviceId) },
  );
}

/** Os próximos `days` dias como objetos Date, para a fita de dias. */
export function nextDays(days: number): Date[] {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => addDays(today, index));
}
