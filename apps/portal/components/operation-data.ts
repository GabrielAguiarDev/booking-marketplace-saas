import "server-only";

import type { ServerSupabaseClient } from "@vez/supabase/server";

import type {
  OperationAppointment,
  OperationCustomer,
  OperationProfessional,
  OperationQueueEntry,
  OperationQueueSource,
  OperationQueueStatus,
  OperationService,
  PortalOperationData,
} from "./operation-model";

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: OperationAppointment["status"];
  price_cents: number;
  deposit_cents: number;
  notes: string | null;
  cancellation_reason: string | null;
  customer_id: string | null;
  professional_id: string;
  service_id: string;
  guest_name: string | null;
  guest_phone: string | null;
  services: { name: string; duration_minutes: number } | null;
  professionals: { display_name: string } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

type QueueEntryRow = {
  id: string;
  status: OperationQueueStatus;
  source: OperationQueueSource;
  joined_at: string;
  called_at: string | null;
  served_at: string | null;
  arrived_at: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  customer_id: string | null;
  service_id: string | null;
  services: { name: string; duration_minutes: number } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

const APPOINTMENT_COLUMNS =
  "id, starts_at, ends_at, status, price_cents, deposit_cents, notes, cancellation_reason," +
  " customer_id, professional_id, service_id, guest_name, guest_phone," +
  " services(name, duration_minutes), professionals(display_name)," +
  " profiles:customer_id(full_name, phone)";

const QUEUE_COLUMNS =
  "id, status, source, joined_at, called_at, served_at, arrived_at, guest_name, guest_phone," +
  " customer_id, service_id, services(name, duration_minutes)," +
  " profiles:customer_id(full_name, phone)";

function appointment(row: AppointmentRow): OperationAppointment {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    priceCents: row.price_cents,
    depositCents: row.deposit_cents,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    customerId: row.customer_id,
    professionalId: row.professional_id,
    serviceId: row.service_id,
    customerName: row.profiles?.full_name ?? row.guest_name ?? "Sem nome",
    customerPhone: row.profiles?.phone ?? row.guest_phone,
    hasAccount: row.customer_id !== null,
    serviceName: row.services?.name ?? "Serviço removido",
    serviceMinutes: row.services?.duration_minutes ?? 0,
    professionalName: row.professionals?.display_name ?? "Profissional removido",
  };
}

export function mapQueueRows(
  entries: QueueEntryRow[],
  state: { entry_id: string; queue_position: number; estimated_wait_minutes: number }[],
): OperationQueueEntry[] {
  const positions = new Map(state.map((row) => [row.entry_id, row]));
  return entries.map((row) => {
    const position = positions.get(row.id);
    return {
      id: row.id,
      position: position?.queue_position ?? 0,
      status: row.status,
      source: row.source,
      customerName: row.profiles?.full_name ?? row.guest_name ?? "Sem nome",
      customerPhone: row.profiles?.phone ?? row.guest_phone,
      customerId: row.customer_id,
      hasAccount: row.customer_id !== null,
      serviceId: row.service_id,
      serviceName: row.services?.name ?? null,
      serviceMinutes: row.services?.duration_minutes ?? null,
      joinedAt: row.joined_at,
      calledAt: row.called_at,
      servedAt: row.served_at,
      arrivedAt: row.arrived_at,
      estimatedWaitMinutes: position?.estimated_wait_minutes ?? 0,
    };
  });
}

/** Leitura operacional do portal; consultas usam a sessão do membro e RLS. */
export async function loadPortalOperationData(
  supabase: ServerSupabaseClient,
  establishmentId: string,
): Promise<PortalOperationData> {
  const summaryResult = await supabase
    .rpc("portal_operation_summary", { p_establishment_id: establishmentId })
    .single();
  if (summaryResult.error) {
    throw new Error(`Falha ao carregar resumo da operação: ${summaryResult.error.message}`);
  }
  const summary = summaryResult.data;

  // Margem de fuso cobre o dia local e as duas semanas mostradas pela agenda.
  // A filtragem visual usa `summary.timezone`, não o fuso do navegador.
  const dayUtc = new Date(`${summary.local_day}T00:00:00.000Z`).getTime();
  const from = new Date(dayUtc - 14 * 3_600_000).toISOString();
  const to = new Date(dayUtc + 15 * 86_400_000 + 14 * 3_600_000).toISOString();

  const [
    appointmentsResult,
    pendingResult,
    professionalsResult,
    servicesResult,
    queueStateResult,
    queueEntriesResult,
    customersResult,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("establishment_id", establishmentId)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at"),
    supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("establishment_id", establishmentId)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(50),
    supabase
      .from("professionals")
      .select("id, display_name, is_active")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents, is_active")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.rpc("queue_state", { p_establishment_id: establishmentId }),
    supabase
      .from("queue_entries")
      .select(QUEUE_COLUMNS)
      .eq("establishment_id", establishmentId)
      .in("status", ["waiting", "called", "in_service"])
      .order("joined_at"),
    supabase.rpc("portal_operation_customers", { p_establishment_id: establishmentId }),
    supabase
      .from("establishment_settings")
      .select("queue_require_arrival")
      .eq("establishment_id", establishmentId)
      .maybeSingle(),
  ]);

  const checked = [
    ["agenda", appointmentsResult.error],
    ["pedidos pendentes", pendingResult.error],
    ["profissionais", professionalsResult.error],
    ["serviços", servicesResult.error],
    ["fila", queueStateResult.error ?? queueEntriesResult.error],
    ["clientes", customersResult.error],
    ["regras da fila", settingsResult.error],
  ] as const;
  const failed = checked.find(([, error]) => error);
  if (failed?.[1]) throw new Error(`Falha ao carregar ${failed[0]}: ${failed[1].message}`);

  // Os ids só ficam disponíveis depois da consulta paralela; busca os vínculos
  // agora, ainda sob RLS. Isto mantém catálogo e agenda independentes da P6.
  const professionalIds = (professionalsResult.data ?? []).map((row) => row.id);
  const actualLinksResult = professionalIds.length
    ? await supabase
        .from("professional_services")
        .select("professional_id, service_id")
        .in("professional_id", professionalIds)
    : { data: [], error: null };
  if (actualLinksResult.error) {
    throw new Error(
      `Falha ao carregar serviços da equipe: ${actualLinksResult.error.message}`,
    );
  }
  const links = actualLinksResult.data ?? [];

  const mapped = [
    ...((appointmentsResult.data ?? []) as unknown as AppointmentRow[]),
    ...((pendingResult.data ?? []) as unknown as AppointmentRow[]),
  ];
  const appointments = Array.from(new Map(mapped.map((row) => [row.id, row])).values())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map(appointment);

  const professionals: OperationProfessional[] = (professionalsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.display_name,
    serviceIds: links
      .filter((link) => link.professional_id === row.id)
      .map((link) => link.service_id),
  }));
  const services: OperationService[] = (servicesResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    professionalIds: links
      .filter((link) => link.service_id === row.id)
      .map((link) => link.professional_id),
  }));
  const customers: OperationCustomer[] = (customersResult.data ?? []).map((row) => ({
    key: row.identity_key,
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone,
    hasAccount: row.has_account,
    appointments: row.appointments,
    completed: row.completed,
    noShows: row.no_shows,
    queueVisits: row.queue_visits,
    spentCents: Number(row.spent_cents),
    lastSeenAt: row.last_seen_at,
  }));

  return {
    summary: {
      localDay: summary.local_day,
      timezone: summary.timezone,
      bookingMode: summary.booking_mode,
      scheduledToday: summary.scheduled_today,
      confirmedToday: summary.confirmed_today,
      completedToday: summary.completed_today,
      revenueTodayCents: Number(summary.revenue_today_cents),
      pendingApproval: summary.pending_approval,
      queueActive: summary.queue_active,
      noShow30: summary.no_show_30,
      finalized30: summary.finalized_30,
    },
    appointments,
    professionals,
    services,
    queue: mapQueueRows(
      (queueEntriesResult.data ?? []) as unknown as QueueEntryRow[],
      queueStateResult.data ?? [],
    ),
    customers,
    queueRequireArrival: settingsResult.data?.queue_require_arrival ?? false,
  };
}
