import type { Database } from "@vez/supabase/types";

export type EstablishmentRole = Database["public"]["Enums"]["establishment_role"];
export type EstablishmentStatus = Database["public"]["Enums"]["establishment_status"];
export type EstablishmentCategory = Database["public"]["Enums"]["establishment_category"];
export type BookingMode = Database["public"]["Enums"]["booking_mode"];

export type ApplicationService = {
  id?: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
};

export type ApplicationInput = {
  name: string;
  category: EstablishmentCategory;
  cnpj: string;
  legal_name: string;
  responsible_name: string;
  contact_email: string;
  phone: string;
  address_line: string;
  neighborhood: string;
  services: ApplicationService[];
};

export type PortalEstablishment = ApplicationInput & {
  id: string;
  role: EstablishmentRole;
  status: EstablishmentStatus;
  description: string | null;
  statusReason: string | null;
  submittedAt: string;
  /* P6 — cadastro e negócio */
  slug: string;
  accentColor: string | null;
  bookingMode: BookingMode;
  timezone: string;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  depositPercent: number;
  cancellationWindowMinutes: number;
  ratingAvg: number | null;
  ratingCount: number;
};

export type MembershipOption = {
  id: string;
  name: string;
  role: EstablishmentRole;
  status: EstablishmentStatus;
};

export type SetupStep = {
  key: "service" | "hours" | "profile";
  title: string;
  body: string;
  done: boolean;
  section: "services" | "hours" | "profile";
};

/**
 * Catálogo, equipe e agenda — o que a P6 acrescentou ao contrato.
 *
 * Os nomes seguem `mobile-staff/src/data/catalog.ts` e `schedule.ts` de
 * propósito: é a mesma pergunta ao mesmo banco, e duas grafias para o mesmo
 * campo é o começo de duas regras diferentes.
 */
export type PortalService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
  professionalIds: string[];
};

export type PortalProfessional = {
  id: string;
  displayName: string;
  title: string | null;
  isActive: boolean;
  sortOrder: number;
  userId: string | null;
  serviceIds: string[];
};

/** Quem tem login. Não coincide com `professionals`: há recepção sem cadeira. */
export type PortalMember = {
  userId: string;
  name: string;
  role: EstablishmentRole;
  isSelf: boolean;
};

export type PortalBusinessHour = {
  id: string;
  weekday: number;
  opensAt: string;
  closesAt: string;
};

export type PortalSchedule = {
  id: string;
  professionalId: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
};

export type PortalException = {
  id: string;
  professionalId: string | null;
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  isAvailable: boolean;
  reason: string | null;
};

export type PortalPhoto = {
  id: string;
  storagePath: string;
  url: string;
  altText: string | null;
  sortOrder: number;
};

export type PortalSettings = Database["public"]["Tables"]["establishment_settings"]["Row"];

export type PortalPlan = {
  id: string;
  kind: Database["public"]["Enums"]["plan_kind"];
  name: string;
  commissionPercent: number | null;
  maxProfessionals: number | null;
  maxBranches: number | null;
  queueIncluded: boolean;
  integratedPayment: string;
  searchHighlight: boolean;
};

export type PortalBusiness = {
  plan: PortalPlan | null;
  catalog: PortalPlan[];
  planChangedAt: string | null;
  discountPercent: number | null;
  discountUntil: string | null;
};

/**
 * Financeiro do que existe: preço congelado de atendimento concluído.
 *
 * Nada sai de `payments` — a tabela existe como esquema e nunca recebeu uma
 * linha, porque o provedor de pagamento não foi escolhido. Repasse e comissão
 * cobrada também não aparecem: seriam número inventado (R7).
 */
export type PortalFinance = {
  months: { label: string; cents: number; count: number }[];
  monthCents: number;
  monthCount: number;
  previousCents: number;
  ticketCents: number;
  topServices: { name: string; cents: number; count: number }[];
  byProfessional: { name: string; cents: number; count: number }[];
  scheduledDepositCents: number;
  queueCompleted: number;
};

export type PortalData = {
  user: { id: string; email: string; name: string };
  establishments: MembershipOption[];
  establishment: PortalEstablishment;
  latestDecision: {
    kind: "approved" | "rejected" | "correction";
    message: string | null;
    decidedAt: string;
  } | null;
  setup: SetupStep[];
  /* P6 — cadastro e negócio */
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

/** Reserva já vendida que uma mudança de agenda deixaria de fora (regra R9). */
export type ScheduleImpact = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  customerName: string;
  serviceName: string;
  professionalName: string;
};

export const ROLE_LABEL: Record<EstablishmentRole, string> = {
  owner: "dono",
  manager: "gerente",
  staff: "equipe",
};

export const CATEGORY_LABEL: Record<EstablishmentCategory, string> = {
  barbershop: "Barbearia",
  salon: "Salão de beleza",
  aesthetic_clinic: "Clínica de estética",
  dermatology: "Dermatologia",
  petshop: "Pet shop",
  nail_salon: "Manicure e unhas",
  dentistry: "Odontologia",
  massage: "Massagem",
};

export const BOOKING_MODE_LABEL: Record<BookingMode, string> = {
  scheduled: "Só agendamento",
  queue: "Só fila de espera",
  both: "Agendamento e fila",
};

export const WEEKDAY_LABEL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** Semana começando na segunda, que é como a loja pensa a própria escala. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
