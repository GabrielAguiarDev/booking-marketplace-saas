import { supabase } from "../../lib/supabase";
import { useAsync } from "./use-async";
import type { CategoryKey } from "./catalog";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled_by_customer"
  | "cancelled_by_establishment"
  | "no_show";

export type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number;
  deposit_cents: number;
  establishments: {
    id: string;
    name: string;
    category: CategoryKey;
    accent_color: string | null;
    neighborhood: string | null;
  };
  services: { id: string; name: string; duration_minutes: number };
  professionals: { id: string; display_name: string };
  reviews: { id: string }[];
};

const COLUMNS = `
  id, starts_at, ends_at, status, price_cents, deposit_cents,
  establishments(id, name, category, accent_color, neighborhood),
  services(id, name, duration_minutes),
  professionals(id, display_name),
  reviews(id)
`;

const UPCOMING: AppointmentStatus[] = ["scheduled", "confirmed"];
const PAST: AppointmentStatus[] = [
  "completed",
  "cancelled_by_customer",
  "cancelled_by_establishment",
  "no_show",
];

/**
 * As reservas do usuário.
 *
 * A RLS (`appointments_select_own`) já limita ao próprio cliente — não há
 * filtro por `customer_id` aqui de propósito: repetir a regra no cliente cria
 * um segundo lugar onde ela pode divergir.
 */
export function useAppointments(enabled: boolean) {
  return useAsync(
    "appointments",
    async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(COLUMNS)
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as unknown as AppointmentRow[];
      const now = Date.now();

      return {
        upcoming: rows
          .filter((r) => UPCOMING.includes(r.status) && new Date(r.starts_at).getTime() >= now)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
        // Reserva ativa que já passou da hora conta como histórico para o
        // cliente: ele não tem o que fazer com ela, e deixá-la em "próximos"
        // faria a aba mentir todo fim de dia.
        history: rows.filter(
          (r) => PAST.includes(r.status) || new Date(r.starts_at).getTime() < now,
        ),
      };
    },
    { enabled },
  );
}

export type BookResult =
  { ok: true; appointmentId: string } | { ok: false; code: string; message: string };

/** Cria a reserva pela Edge Function — nunca por insert direto (ver R4). */
export async function bookAppointment(input: {
  establishmentId: string;
  serviceId: string;
  professionalId: string;
  startsAt: string;
}): Promise<BookResult> {
  const { data, error } = await supabase.functions.invoke("book-appointment", {
    body: {
      establishment_id: input.establishmentId,
      service_id: input.serviceId,
      professional_id: input.professionalId,
      starts_at: input.startsAt,
    },
  });

  if (error) {
    // A Edge Function devolve o motivo no corpo mesmo quando o status é 4xx;
    // `error.context` guarda a resposta.
    const body = await readErrorBody(error);
    return {
      ok: false,
      code: body?.code ?? "network",
      message: body?.message ?? "Não foi possível concluir a reserva.",
    };
  }

  return { ok: true, appointmentId: (data as { appointment: { id: string } }).appointment.id };
}

export async function cancelAppointment(
  appointmentId: string,
): Promise<{ ok: boolean; withinFreeWindow: boolean; message?: string }> {
  const { data, error } = await supabase.functions.invoke("cancel-appointment", {
    body: { appointment_id: appointmentId },
  });

  if (error) {
    const body = await readErrorBody(error);
    return {
      ok: false,
      withinFreeWindow: false,
      message: body?.message ?? "Não foi possível cancelar.",
    };
  }

  return {
    ok: true,
    withinFreeWindow: (data as { within_free_window: boolean }).within_free_window,
  };
}

/** Extrai `{code, message}` do corpo do erro da Edge Function, se houver. */
async function readErrorBody(error: unknown): Promise<{ code: string; message: string } | null> {
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try {
    const body = (await context.json()) as { error?: { code: string; message: string } };
    return body.error ?? null;
  } catch {
    return null;
  }
}
