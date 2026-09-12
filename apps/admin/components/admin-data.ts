import "server-only";

import type { ServerSupabaseClient } from "@vez/supabase/server";
import type { Json } from "@vez/supabase/types";

import type {
  AccessSession,
  AdminData,
  Banner,
  Establishment,
  Param,
  PlanDef,
  RecentReview,
  Report,
  Ticket,
} from "./model";
import { categoryLabel, ROLE_LABEL, ROLE_SCOPE } from "./model";

export class AdminAccessError extends Error {}
export class AdminMfaRequiredError extends Error {}

function rows<T>(
  result: { data: T[] | null; error: { message: string; code?: string } | null },
  source: string,
): T[] {
  if (result.error) {
    if (result.error.code === "PVMFA") {
      throw new AdminMfaRequiredError("Confirme o segundo fator para acessar o painel.");
    }
    if (result.error.code === "42501" || /acesso restrito/i.test(result.error.message)) {
      throw new AdminAccessError("Esta conta não faz parte da equipe da plataforma.");
    }
    throw new Error(`Falha ao carregar ${source}: ${result.error.message}`);
  }
  return result.data ?? [];
}

function jsonList<T>(value: Json): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function riskOf(row: {
  last_appointment_at: string | null;
  recent_30: number;
  previous_60: number;
}): string | null {
  if (row.last_appointment_at) {
    const silentDays = Math.floor(
      (Date.now() - new Date(row.last_appointment_at).getTime()) / 86_400_000,
    );
    if (silentDays >= 30) return `sem agendamentos há ${silentDays} dias`;
  }
  const baseline = row.previous_60 / 2;
  if (baseline >= 5 && row.recent_30 < baseline * 0.7) {
    return `uso caiu ${Math.round((1 - row.recent_30 / baseline) * 100)}%`;
  }
  return null;
}

/** Carrega o painel em RPCs protegidas; nenhuma tabela sensível é exposta ao navegador. */
export async function loadAdminData(supabase: ServerSupabaseClient): Promise<AdminData> {
  const meResult = await supabase.rpc("admin_me");
  const meRows = rows(meResult, "a conta administrativa");
  const me = meRows[0];
  if (!me) throw new AdminAccessError("Esta conta não faz parte da equipe da plataforma.");

  const [
    citiesResult,
    applicationsResult,
    decisionsResult,
    establishmentsResult,
    plansResult,
    catalogResult,
    suggestionsResult,
    noResultsResult,
    reportsResult,
    panoramaResult,
    customersResult,
    teamResult,
    settingsResult,
    mfaPolicyResult,
    overviewResult,
    auditResult,
    bannersResult,
    ticketsResult,
    accessSessionsResult,
  ] = await Promise.all([
    supabase.rpc("admin_cities"),
    supabase.rpc("admin_applications"),
    supabase.rpc("admin_decisions"),
    supabase.rpc("admin_establishments"),
    supabase.rpc("admin_plans"),
    supabase.rpc("admin_catalog_items"),
    supabase.rpc("admin_catalog_suggestions"),
    supabase.rpc("admin_no_result_searches"),
    supabase.rpc("admin_review_reports"),
    supabase.rpc("admin_review_panorama"),
    supabase.rpc("admin_customers"),
    supabase.rpc("admin_team"),
    supabase.rpc("admin_settings"),
    supabase.rpc("admin_mfa_policy"),
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_audit"),
    supabase.rpc("admin_showcase_banners"),
    supabase.rpc("admin_support_tickets"),
    supabase.rpc("admin_active_access_sessions"),
  ]);

  const cities = rows(citiesResult, "cidades").map((city) => ({
    id: city.id,
    name: city.name,
    uf: city.uf,
    status: city.launch_status,
    establishments: city.establishments,
    customers: city.customers,
    appointmentsMonth: city.appointments_month,
    quotaTotal: city.quota_total,
    quotaUsed: city.quota_used,
    monthlyPriceCents: city.monthly_price_cents ?? null,
    categories: city.categories.map(categoryLabel),
    gaps: city.gaps,
  }));

  const applications = rows(applicationsResult, "solicitações").map((application) => ({
    id: application.id,
    name: application.name,
    cityId: application.city_id,
    city: application.city,
    category: categoryLabel(application.category),
    submittedAt: application.submitted_at,
    cnpj: application.cnpj,
    legalName: application.legal_name,
    address: application.address,
    phone: application.phone,
    responsible: application.responsible,
    email: application.email,
    professionals: application.professionals,
    services: application.services,
    photos: application.photos,
  }));

  const decisions = rows(decisionsResult, "decisões").map((decision) => ({
    id: decision.id,
    name: decision.name,
    city: decision.city,
    decision: decision.decision,
    plan: decision.plan_kind ?? null,
    who: decision.who,
    at: decision.decided_at,
  }));

  const establishments: Establishment[] = rows(establishmentsResult, "estabelecimentos").map(
    (item) => {
      const plan = item.plan_kind ?? "commission";
      const gross =
        plan === "monthly"
          ? Number(item.city_price_cents ?? 0)
          : Math.round(
              Number(item.completed_month_cents ?? 0) *
                (Number(item.commission_percent ?? 0) / 100),
            );
      const discount = Number(item.discount_percent ?? 0);
      return {
        id: item.id,
        name: item.name,
        cityId: item.city_id,
        city: item.city,
        category: categoryLabel(item.category),
        status: item.status === "suspended" ? "suspended" : "active",
        planId: item.plan_id ?? null,
        plan,
        overdue: false,
        appointmentsMonth: item.appointments_month,
        platformRevenueCents: Math.round(gross * (1 - discount / 100)),
        since: item.created_at,
        risk: riskOf(item),
        discountPercent: item.discount_percent ?? null,
        cnpj: item.cnpj,
        address: item.address,
        responsible: item.responsible,
        professionals: item.professionals,
        usage: item.usage,
      };
    },
  );

  const plans: PlanDef[] = rows(plansResult, "planos").map((plan) => ({
    id: plan.id,
    kind: plan.kind,
    name: plan.name,
    active: plan.is_active,
    commissionPercent: plan.commission_percent ?? null,
    maxProfessionals: plan.max_professionals ?? null,
    maxBranches: plan.max_branches ?? null,
    queueIncluded: plan.queue_included,
    integratedPayment: plan.integrated_payment === "required" ? "required" : "optional",
    searchHighlight: plan.search_highlight,
  }));

  const catalog = rows(catalogResult, "catálogo").map((item) => ({
    id: item.id,
    group: categoryLabel(item.category),
    name: item.name,
    durationMinutes: item.duration_minutes,
    synonyms: item.synonyms,
    establishments: item.establishments,
    cities: item.cities,
    searchesMonth: item.searches_month,
    appointmentsMonth: item.appointments_month,
    averagePriceCents: item.average_price_cents ?? null,
  }));

  const suggestions = rows(suggestionsResult, "sugestões de catálogo").map((item) => ({
    id: item.key,
    group: categoryLabel(item.category),
    name: item.name,
    establishment: item.establishment,
    city: item.city,
    requests: item.requests,
  }));

  const noResults = rows(noResultsResult, "buscas sem resultado").map((item) => ({
    term: item.term,
    city: item.city,
    count: item.searches,
  }));

  const reports: Report[] = rows(reportsResult, "denúncias").map((report) => ({
    id: report.id,
    reviewId: report.review_id,
    establishmentId: report.establishment_id,
    establishment: report.establishment,
    city: report.city,
    reason: report.reason,
    status:
      report.status === "awaiting_establishment"
        ? ("awaiting_establishment" as const)
        : ("open" as const),
    openedAt: report.opened_at,
    rating: report.rating,
    text: report.comment,
    author: report.author,
    reviewedAt: report.reviewed_at,
    service: report.service,
    professional: report.professional,
    appointmentAt: report.appointment_at,
    valueCents: report.value_cents,
    authorReviews: report.author_reviews,
    authorAverage: Number(report.author_average ?? 0),
    authorRemoved: report.author_removed,
    justification: report.justification,
    establishmentAverage: Number(report.establishment_average ?? 0),
    establishmentReviews: report.establishment_reviews,
    establishmentReports: report.establishment_reports,
    clarificationRequest: report.clarification_request ?? null,
    clarificationAnswer: report.clarification_answer ?? null,
    clarificationAnsweredAt: report.clarification_answered_at ?? null,
  }));

  const recentReviews: Record<string, RecentReview[]> = {};
  const panorama = rows(panoramaResult, "panorama de avaliações").map((item) => {
    recentReviews[item.establishment_id] = jsonList<RecentReview>(item.recent);
    return {
      id: item.establishment_id,
      establishmentId: item.establishment_id,
      name: item.name,
      city: item.city,
      average: Number(item.average ?? 0),
      delta30: Number(item.delta_30 ?? 0),
      total: item.total,
      month: item.month,
      reports: item.reports,
    };
  });

  const customers = rows(customersResult, "clientes").map((customer) => ({
    id: customer.id,
    name: customer.name,
    city: customer.city,
    since: customer.since,
    appointments: customer.appointments,
    noShows: customer.no_shows,
    blocked: customer.blocked,
    misses: jsonList<{ establishment: string; at: string }>(customer.misses),
  }));

  const team = rows(teamResult, "equipe").map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: ROLE_LABEL[member.role],
    roleKey: member.role,
    scope: ROLE_SCOPE[member.role],
    lastSeen: member.last_seen_at ?? null,
    pending: member.pending,
  }));

  const settings = rows(settingsResult, "parâmetros")[0];
  if (!settings) throw new Error("A configuração única da plataforma não existe.");
  if (mfaPolicyResult.error) {
    if (mfaPolicyResult.error.code === "PVMFA") {
      throw new AdminMfaRequiredError("Confirme o segundo fator para acessar o painel.");
    }
    throw new Error(`Falha ao carregar a política de MFA: ${mfaPolicyResult.error.message}`);
  }
  const mfaRequired = mfaPolicyResult.data ?? true;
  const params: Param[] = [
    {
      key: "cancellation_window_hours",
      label: "Padrão de cancelamento para novas lojas",
      value: settings.cancellation_window_hours,
      unit: "horas antes",
    },
    {
      key: "no_show_block_threshold",
      label: "Faltas até bloqueio automático do cliente",
      value: settings.no_show_block_threshold,
      unit: "faltas em 30 dias",
    },
    {
      key: "default_commission_percent",
      label: "Comissão padrão sobre agendamentos pagos",
      value: Number(settings.default_commission_percent),
      unit: "%",
    },
    {
      key: "delinquency_grace_days",
      label: "Carência antes da suspensão por inadimplência",
      value: settings.delinquency_grace_days,
      unit: "dias",
    },
    {
      key: "queue_max_per_professional",
      label: "Tamanho máximo da fila por profissional",
      value: settings.queue_max_per_professional,
      unit: "pessoas",
    },
    {
      key: "plan_change_interval_days",
      label: "Intervalo mínimo entre trocas de plano",
      value: settings.plan_change_interval_days,
      unit: "dias",
    },
  ];

  const audit = rows(auditResult, "auditoria").map((entry) => ({
    id: entry.id,
    who: entry.who,
    action: entry.action,
    meta: entry.meta,
    at: entry.created_at,
    accountAccess: entry.account_access,
  }));

  // A imagem mora no bucket público `showcase`; a URL pública não passa por RLS.
  const showcase = supabase.storage.from("showcase");
  const banners: Banner[] = rows(bannersResult, "vitrine").map((banner) => ({
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    imagePath: banner.image_path,
    imageUrl: showcase.getPublicUrl(banner.image_path).data.publicUrl,
    targetKind: banner.target_kind,
    targetValue: banner.target_value,
    targetLabel:
      banner.target_kind === "category" ? categoryLabel(banner.target_label) : banner.target_label,
    targetAvailable: banner.target_available,
    startsAt: banner.starts_at ?? null,
    endsAt: banner.ends_at ?? null,
    sortOrder: banner.sort_order,
    active: banner.is_active,
    createdBy: banner.created_by ?? null,
    updatedAt: banner.updated_at,
  }));

  // Financeiro não atende chamado: o banco nega a fila (42501) e o resto do
  // painel carrega normalmente, sem ela.
  const supportAccess = ticketsResult.error?.code !== "42501";
  const tickets: Ticket[] = supportAccess
    ? rows(ticketsResult, "chamados").map((ticket) => ({
        id: ticket.id,
        number: ticket.number,
        requesterKind: ticket.requester_kind,
        requesterName: ticket.requester_name,
        requesterEmail: ticket.requester_email,
        establishmentId: ticket.establishment_id ?? null,
        establishment: ticket.establishment ?? null,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        assignedTo: ticket.assigned_to ?? null,
        assignee: ticket.assignee ?? null,
        waitingSince: ticket.waiting_since,
        lastMessageAt: ticket.last_message_at,
        lastFromStaff: ticket.last_message_from_staff,
        firstResponseAt: ticket.first_response_at ?? null,
        resolvedAt: ticket.resolved_at ?? null,
        createdAt: ticket.created_at,
        messages: ticket.messages,
        preview: ticket.preview,
      }))
    : [];

  // Operações atende chamados, mas leitura da conta fica restrita a
  // Suporte/Admin. Um 42501 aqui não impede o restante do painel de carregar.
  const accountConsoleAccess = accessSessionsResult.error?.code !== "42501";
  const accessSessions: AccessSession[] = accountConsoleAccess
    ? rows(accessSessionsResult, "sessões de acesso").map((session) => ({
        id: session.id,
        establishmentId: session.establishment_id,
        establishment: session.establishment_name,
        reason: session.reason,
        startedAt: session.started_at,
        expiresAt: session.expires_at,
      }))
    : [];

  const overviewRow = rows(overviewResult, "visão geral")[0];
  if (!overviewRow) throw new Error("A visão geral da plataforma não retornou dados.");
  const overview = {
    activeEstablishments: overviewRow.active_establishments,
    approvedMonth: overviewRow.approved_month,
    suspendedMonth: overviewRow.suspended_month,
    appointmentsMonth: overviewRow.appointments_month,
    paidInAppMonth: overviewRow.paid_in_app_month,
    series: jsonList<{
      month: string;
      appointments: number;
      monthly_cents: number;
      commission_cents: number;
    }>(overviewRow.series).map((point) => ({
      month: point.month,
      appointments: Number(point.appointments ?? 0),
      monthlyCents: Number(point.monthly_cents ?? 0),
      commissionCents: Number(point.commission_cents ?? 0),
    })),
  };

  return {
    overview,
    me: { id: me.id, name: me.name, role: ROLE_LABEL[me.role], roleKey: me.role },
    cities,
    applications,
    decisions,
    establishments,
    // Cobrança entra quando o provedor for escolhido. Não exibimos faturas ou
    // repasses inventados como se fossem dados reais.
    invoices: [],
    transfers: [],
    plans,
    catalog,
    suggestions,
    noResults,
    reports,
    panorama,
    recentReviews,
    customers,
    team,
    params,
    mfaRequired,
    audit,
    banners,
    tickets,
    accessSessions,
    accountConsoleAccess,
    supportAccess,
  };
}
