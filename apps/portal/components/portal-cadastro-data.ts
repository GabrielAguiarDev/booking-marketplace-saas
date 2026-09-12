import "server-only";

import type { ServerSupabaseClient } from "@vez/supabase/server";

import type {
  PortalBusiness,
  PortalBusinessHour,
  PortalException,
  PortalFinance,
  PortalMember,
  PortalPhoto,
  PortalPlan,
  PortalProfessional,
  PortalSchedule,
  PortalService,
  PortalSettings,
} from "./model";

export const PHOTO_BUCKET = "establishment-photos";

/** Colunas de `establishments` que as seções de cadastro e negócio precisam. */
export const ESTABLISHMENT_EXTRA_COLUMNS =
  "slug, accent_color, booking_mode, timezone, slot_interval_minutes, min_lead_minutes," +
  " deposit_percent, cancellation_window_minutes, rating_avg, rating_count," +
  " plan_id, plan_changed_at, discount_percent, discount_until";

export type CadastroData = {
  services: PortalService[];
  professionals: PortalProfessional[];
  members: PortalMember[];
  businessHours: PortalBusinessHour[];
  schedules: PortalSchedule[];
  exceptions: PortalException[];
  photos: PortalPhoto[];
  settings: PortalSettings | null;
  business: PortalBusiness;
  finance: PortalFinance;
};

type PlanRow = {
  id: string;
  kind: PortalPlan["kind"];
  name: string;
  commission_percent: number | null;
  max_professionals: number | null;
  max_branches: number | null;
  queue_included: boolean;
  integrated_payment: string;
  search_highlight: boolean;
};

function toPlan(row: PlanRow): PortalPlan {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    commissionPercent: row.commission_percent === null ? null : Number(row.commission_percent),
    maxProfessionals: row.max_professionals,
    maxBranches: row.max_branches,
    queueIncluded: row.queue_included,
    integratedPayment: row.integrated_payment,
    searchHighlight: row.search_highlight,
  };
}

const MONTH_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Primeiro dia do mês, `back` meses atrás. */
function monthStart(now: Date, back: number): Date {
  return new Date(now.getFullYear(), now.getMonth() - back, 1);
}

/**
 * Leitura das seções de cadastro e negócio (P6).
 *
 * Fica fora de `portal-data.ts` para não transformar o loader compartilhado num
 * arquivo que P5 e P6 reescrevem ao mesmo tempo. Continua valendo a mesma
 * regra: tudo pela sessão do usuário e por RLS, nada de service role.
 */
export async function loadCadastroData(
  supabase: ServerSupabaseClient,
  establishmentId: string,
  userId: string,
  establishment: {
    plan_id: string | null;
    plan_changed_at: string | null;
    discount_percent: number | null;
    discount_until: string | null;
  },
): Promise<CadastroData> {
  const now = new Date();
  const financeFrom = monthStart(now, 5);

  const [
    servicesResult,
    professionalsResult,
    linksResult,
    membersResult,
    hoursResult,
    schedulesResult,
    exceptionsResult,
    photosResult,
    settingsResult,
    plansResult,
    completedResult,
    depositResult,
    queueResult,
  ] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration_minutes, price_cents, is_active, sort_order")
      .eq("establishment_id", establishmentId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("professionals")
      .select("id, display_name, title, is_active, sort_order, user_id")
      .eq("establishment_id", establishmentId)
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("professional_services")
      .select("professional_id, service_id, professionals!inner(establishment_id)")
      .eq("professionals.establishment_id", establishmentId),
    supabase
      .from("establishment_members")
      .select("user_id, role, profiles(full_name)")
      .eq("establishment_id", establishmentId),
    supabase
      .from("business_hours")
      .select("id, weekday, opens_at, closes_at")
      .eq("establishment_id", establishmentId)
      .order("weekday")
      .order("opens_at"),
    supabase
      .from("professional_schedules")
      .select("id, professional_id, weekday, starts_at, ends_at, professionals!inner(establishment_id)")
      .eq("professionals.establishment_id", establishmentId)
      .order("weekday")
      .order("starts_at"),
    supabase
      .from("schedule_exceptions")
      .select("id, professional_id, exception_date, starts_at, ends_at, is_available, reason")
      .eq("establishment_id", establishmentId)
      .gte("exception_date", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10))
      .order("exception_date"),
    supabase
      .from("establishment_photos")
      .select("id, storage_path, alt_text, sort_order")
      .eq("establishment_id", establishmentId)
      .order("sort_order"),
    supabase
      .from("establishment_settings")
      .select("*")
      .eq("establishment_id", establishmentId)
      .maybeSingle(),
    supabase
      .from("plans")
      .select(
        "id, kind, name, commission_percent, max_professionals, max_branches, queue_included, integrated_payment, search_highlight",
      )
      .eq("is_active", true)
      .order("kind"),
    supabase
      .from("appointments")
      .select("starts_at, price_cents, services(name), professionals(display_name)")
      .eq("establishment_id", establishmentId)
      .eq("status", "completed")
      .gte("starts_at", financeFrom.toISOString()),
    supabase
      .from("appointments")
      .select("deposit_cents")
      .eq("establishment_id", establishmentId)
      .in("status", ["scheduled", "confirmed"])
      .gte("starts_at", now.toISOString()),
    supabase
      .from("queue_entries")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("status", "done")
      .gte("finished_at", monthStart(now, 0).toISOString()),
  ]);

  for (const [label, result] of [
    ["serviços", servicesResult],
    ["profissionais", professionalsResult],
    ["quem faz o quê", linksResult],
    ["equipe", membersResult],
    ["funcionamento", hoursResult],
    ["jornadas", schedulesResult],
    ["exceções", exceptionsResult],
    ["fotos", photosResult],
    ["ajustes", settingsResult],
    ["planos", plansResult],
    ["faturamento", completedResult],
    ["sinais", depositResult],
    ["fila", queueResult],
  ] as const) {
    if (result.error) throw new Error(`Falha ao carregar ${label}: ${result.error.message}`);
  }

  const links = (linksResult.data ?? []) as unknown as {
    professional_id: string;
    service_id: string;
  }[];
  const byService = new Map<string, string[]>();
  const byProfessional = new Map<string, string[]>();
  for (const link of links) {
    byService.set(link.service_id, (byService.get(link.service_id) ?? []).concat(link.professional_id));
    byProfessional.set(
      link.professional_id,
      (byProfessional.get(link.professional_id) ?? []).concat(link.service_id),
    );
  }

  const services: PortalService[] = (servicesResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    professionalIds: byService.get(row.id) ?? [],
  }));

  const professionals: PortalProfessional[] = (professionalsResult.data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    title: row.title,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    userId: row.user_id,
    serviceIds: byProfessional.get(row.id) ?? [],
  }));

  const members: PortalMember[] = (
    (membersResult.data ?? []) as unknown as {
      user_id: string;
      role: PortalMember["role"];
      profiles: { full_name: string | null } | null;
    }[]
  )
    .map((row) => ({
      userId: row.user_id,
      name: row.profiles?.full_name?.trim() || "Sem nome no perfil",
      role: row.role,
      isSelf: row.user_id === userId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const schedules: PortalSchedule[] = (
    (schedulesResult.data ?? []) as unknown as {
      id: string;
      professional_id: string;
      weekday: number;
      starts_at: string;
      ends_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    professionalId: row.professional_id,
    weekday: row.weekday,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));

  const photos: PortalPhoto[] = (photosResult.data ?? []).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
    altText: row.alt_text,
    sortOrder: row.sort_order,
  }));

  const catalog = ((plansResult.data ?? []) as PlanRow[]).map(toPlan);

  // ── Financeiro ───────────────────────────────────────────────────────────
  const completed = (completedResult.data ?? []) as unknown as {
    starts_at: string;
    price_cents: number;
    services: { name: string } | null;
    professionals: { display_name: string } | null;
  }[];

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = monthStart(now, 5 - index);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: MONTH_LABEL[date.getMonth()] ?? "",
      cents: 0,
      count: 0,
    };
  });
  const monthIndex = new Map(months.map((month, index) => [month.key, index]));

  const byServiceRevenue = new Map<string, { cents: number; count: number }>();
  const byProfessionalRevenue = new Map<string, { cents: number; count: number }>();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  for (const row of completed) {
    const date = new Date(row.starts_at);
    const index = monthIndex.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (index !== undefined) {
      const bucket = months[index]!;
      bucket.cents += row.price_cents;
      bucket.count += 1;
    }
    if (`${date.getFullYear()}-${date.getMonth()}` !== thisMonthKey) continue;

    const serviceName = row.services?.name ?? "Serviço removido";
    const serviceBucket = byServiceRevenue.get(serviceName) ?? { cents: 0, count: 0 };
    serviceBucket.cents += row.price_cents;
    serviceBucket.count += 1;
    byServiceRevenue.set(serviceName, serviceBucket);

    const professionalName = row.professionals?.display_name ?? "Sem profissional";
    const professionalBucket = byProfessionalRevenue.get(professionalName) ?? { cents: 0, count: 0 };
    professionalBucket.cents += row.price_cents;
    professionalBucket.count += 1;
    byProfessionalRevenue.set(professionalName, professionalBucket);
  }

  const current = months[months.length - 1]!;
  const previous = months[months.length - 2];

  const finance: PortalFinance = {
    months: months.map((month) => ({ label: month.label, cents: month.cents, count: month.count })),
    monthCents: current.cents,
    monthCount: current.count,
    previousCents: previous?.cents ?? 0,
    ticketCents: current.count === 0 ? 0 : Math.round(current.cents / current.count),
    topServices: [...byServiceRevenue.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.cents - a.cents)
      .slice(0, 6),
    byProfessional: [...byProfessionalRevenue.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.cents - a.cents),
    scheduledDepositCents: (depositResult.data ?? []).reduce((sum, row) => sum + row.deposit_cents, 0),
    queueCompleted: (queueResult.data ?? []).length,
  };

  const business: PortalBusiness = {
    plan: catalog.find((plan) => plan.id === establishment.plan_id) ?? null,
    catalog,
    planChangedAt: establishment.plan_changed_at,
    discountPercent: establishment.discount_percent,
    discountUntil: establishment.discount_until,
  };

  return {
    services,
    professionals,
    members,
    businessHours: (hoursResult.data ?? []).map((row) => ({
      id: row.id,
      weekday: row.weekday,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
    })),
    schedules,
    exceptions: (exceptionsResult.data ?? []).map<PortalException>((row) => ({
      id: row.id,
      professionalId: row.professional_id,
      date: row.exception_date,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isAvailable: row.is_available,
      reason: row.reason,
    })),
    photos,
    settings: settingsResult.data ?? null,
    business,
    finance,
  };
}
