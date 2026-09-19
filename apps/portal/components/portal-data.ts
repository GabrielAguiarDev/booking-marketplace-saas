import "server-only";

import type { ServerSupabaseClient } from "@vez/supabase/server";

import type {
  ApplicationService,
  MembershipOption,
  PortalData,
  PortalEstablishment,
  SetupStep,
} from "./model";
import { loadPortalOperationData } from "./operation-data";
import { loadCadastroData } from "./portal-cadastro-data";

type DbError = { message: string } | null;

function required<T>(result: { data: T | null; error: DbError }, source: string): T {
  if (result.error) throw new Error(`Falha ao carregar ${source}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${source} não encontrado.`);
  return result.data;
}

/**
 * Contrato de leitura do portal.
 *
 * P5 acrescenta aqui agenda/fila/clientes; P6 acrescenta catálogo/equipe,
 * configuração e negócio. Componentes recebem `PortalData` e nunca consultam
 * o Supabase por conta própria. Todas as consultas abaixo passam pela sessão e
 * por RLS.
 */
export async function loadPortalData(
  supabase: ServerSupabaseClient,
  user: { id: string; email?: string },
  requestedEstablishmentId?: string,
): Promise<PortalData | null> {
  const [membersResult, profileResult] = await Promise.all([
    supabase.from("establishment_members").select("establishment_id, role").eq("user_id", user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (membersResult.error) {
    throw new Error(`Falha ao carregar vínculos: ${membersResult.error.message}`);
  }
  if (profileResult.error) {
    throw new Error(`Falha ao carregar perfil: ${profileResult.error.message}`);
  }

  const memberRows = membersResult.data ?? [];
  if (memberRows.length === 0) return null;

  const ids = memberRows.map((row) => row.establishment_id);
  const establishmentsResult = await supabase
    .from("establishments")
    // Literal de propósito: o postgrest-js só infere o tipo das linhas quando a
    // lista de colunas é uma constante de string, não uma concatenação.
    .select(
      "id, name, status, category, cnpj, legal_name, responsible_name, contact_email, phone, address_line, neighborhood, description, status_reason, submitted_at, slug, accent_color, booking_mode, timezone, slot_interval_minutes, min_lead_minutes, deposit_percent, cancellation_window_minutes, rating_avg, rating_count, plan_id, plan_changed_at, discount_percent, discount_until",
    )
    .in("id", ids)
    .order("name");
  if (establishmentsResult.error) {
    throw new Error(`Falha ao carregar lojas: ${establishmentsResult.error.message}`);
  }

  const establishments: MembershipOption[] = (establishmentsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    role: memberRows.find((member) => member.establishment_id === row.id)?.role ?? "staff",
  }));
  if (establishments.length === 0) return null;

  const chosen =
    establishments.find((item) => item.id === requestedEstablishmentId) ?? establishments[0]!;
  const row = required(
    {
      data: (establishmentsResult.data ?? []).find((item) => item.id === chosen.id) ?? null,
      error: establishmentsResult.error,
    },
    "estabelecimento",
  );

  const [servicesResult, professionalsResult, hoursResult, decisionResult] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents, is_active, sort_order")
      .eq("establishment_id", chosen.id)
      .order("sort_order"),
    supabase.from("professionals").select("id, is_active").eq("establishment_id", chosen.id),
    supabase.from("business_hours").select("id").eq("establishment_id", chosen.id),
    supabase
      .from("establishment_decisions")
      .select("decision, message, decided_at")
      .eq("establishment_id", chosen.id)
      .order("decided_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const [label, result] of [
    ["serviços", servicesResult],
    ["profissionais", professionalsResult],
    ["horários", hoursResult],
    ["decisão", decisionResult],
  ] as const) {
    if (result.error) throw new Error(`Falha ao carregar ${label}: ${result.error.message}`);
  }

  const professionalIds = (professionalsResult.data ?? []).map((item) => item.id);
  const schedulesResult = professionalIds.length
    ? await supabase
        .from("professional_schedules")
        .select("id")
        .in("professional_id", professionalIds)
        .limit(1)
    : { data: [], error: null };
  if (schedulesResult.error) {
    throw new Error(`Falha ao carregar jornadas: ${schedulesResult.error.message}`);
  }

  const services: ApplicationService[] = (servicesResult.data ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    duration_minutes: service.duration_minutes,
    price_cents: service.price_cents,
  }));
  const establishment: PortalEstablishment = {
    id: row.id,
    role: chosen.role,
    status: row.status,
    name: row.name,
    category: row.category,
    cnpj: row.cnpj ?? "",
    legal_name: row.legal_name ?? "",
    responsible_name: row.responsible_name ?? "",
    contact_email: row.contact_email ?? user.email ?? "",
    phone: row.phone ?? "",
    address_line: row.address_line ?? "",
    neighborhood: row.neighborhood ?? "",
    description: row.description,
    statusReason: row.status_reason,
    submittedAt: row.submitted_at,
    services,
    slug: row.slug,
    accentColor: row.accent_color,
    bookingMode: row.booking_mode,
    timezone: row.timezone,
    slotIntervalMinutes: row.slot_interval_minutes,
    minLeadMinutes: row.min_lead_minutes,
    depositPercent: row.deposit_percent,
    cancellationWindowMinutes: row.cancellation_window_minutes,
    ratingAvg: row.rating_avg === null ? null : Number(row.rating_avg),
    ratingCount: row.rating_count,
  };

  // Cadastro e negócio (P6) carregam depois da loja escolhida: as consultas
  // precisam do id dela, e sem status ativo a página nem chega até aqui.
  const [cadastro, operation] = await Promise.all([
    loadCadastroData(supabase, chosen.id, user.id, { ...row, role: chosen.role }),
    row.status === "active" ? loadPortalOperationData(supabase, chosen.id) : Promise.resolve(null),
  ]);

  const hasService = (servicesResult.data ?? []).some((service) => service.is_active);
  const hasProfessional = (professionalsResult.data ?? []).some((professional) =>
    Boolean(professional.is_active),
  );
  const hasHours = (hoursResult.data?.length ?? 0) > 0 && (schedulesResult.data?.length ?? 0) > 0;
  const hasProfile = Boolean(row.description?.trim() && row.address_line?.trim());
  const setup: SetupStep[] = [
    {
      key: "service",
      title: "Cadastre o primeiro serviço",
      body: hasService
        ? "Feito. A duração de cada serviço é o que fatia a agenda."
        : "Sem um serviço ativo, não existe horário para vender.",
      done: hasService,
      section: "services",
    },
    {
      key: "hours",
      title: "Diga quando vocês atendem",
      body: hasHours
        ? "Feito. O horário da loja e a jornada da equipe já estão definidos."
        : hasProfessional
          ? "Falta definir a jornada de quem atende."
          : "Cadastre quem atende e depois defina a jornada da equipe.",
      done: hasHours,
      section: "hours",
    },
    {
      key: "profile",
      title: "Complete o perfil público",
      body: hasProfile
        ? "Feito. O cliente já tem descrição e endereço para decidir."
        : "Complete a descrição da loja; o endereço do cadastro já está salvo.",
      done: hasProfile,
      section: "profile",
    },
  ];

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: profileResult.data?.full_name?.trim() || user.email || "Conta Vez",
    },
    establishments,
    establishment,
    latestDecision: decisionResult.data
      ? {
          kind: decisionResult.data.decision,
          message: decisionResult.data.message,
          decidedAt: decisionResult.data.decided_at,
        }
      : null,
    setup,
    operation,
    ...cadastro,
  };
}
