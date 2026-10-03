import type { Database } from "@vez/supabase/types";

import type { PortalOperationData } from "./operation-model";

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

export type PortalInvitation = {
  id: string;
  email: string;
  name: string;
  role: Exclude<EstablishmentRole, "owner">;
  professionalId: string | null;
  status: "pending" | "accepted" | "revoked";
  sentByAuth: boolean;
  invitedAt: string;
  acceptedAt: string | null;
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

/** Conta da loja no provedor de pagamento. Os tokens nunca chegam ao portal. */
export type PortalReceiving = {
  provider: string;
  connectedAt: string;
};

export type PortalInvoice = {
  id: string;
  periodStart: string;
  dueDate: string;
  listPriceCents: number;
  discountCents: number;
  amountCents: number;
  status: Database["public"]["Enums"]["billing_invoice_status"];
  paidAt: string | null;
};

/** O que `billing-invoice-pay` devolve: a fatura e, se aberta, o Pix dela. */
export type InvoiceCharge = {
  id: string;
  status: PortalInvoice["status"];
  amountCents: number;
  pixCopyPaste: string | null;
  chargeExpiresAt: string | null;
  paidAt: string | null;
};

export type PortalBusiness = {
  plan: PortalPlan | null;
  catalog: PortalPlan[];
  planChangedAt: string | null;
  discountPercent: number | null;
  discountUntil: string | null;
  /** Nulo: a loja ainda não conectou conta para receber pelo app. */
  receiving: PortalReceiving | null;
  /** Mensalidades, da mais nova para a mais antiga. Só o dono enxerga. */
  invoices: PortalInvoice[];
  /** Dias depois do vencimento em que a loja é suspensa. */
  graceDays: number;
};

/**
 * Financeiro do que existe: preço congelado de atendimento concluído.
 *
 * O faturamento vem do preço congelado de atendimento concluído. `receipts` é
 * outra coisa: o que de fato entrou pelo app (`payments`), com taxa do Vez e
 * tarifa do provedor. O que a loja recebe no balcão não aparece em nenhum dos
 * dois — o portal não tem como saber (R7).
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
  /** O que entrou pelo app (Pix e cartão). Vazio para quem não é dono/gerente. */
  receipts: PortalReceipt[];
};

/** Um pagamento recebido pelo app, já com o que foi descontado dele. */
export type PortalReceipt = {
  id: string;
  paidAt: string;
  serviceName: string;
  scope: "deposit" | "full";
  method: Database["public"]["Enums"]["payment_method"] | null;
  status: Database["public"]["Enums"]["payment_status"];
  amountCents: number;
  refundedCents: number;
  /** Taxa do plano Vez, retida na origem. */
  platformFeeCents: number;
  /** Tarifa do provedor; nula quando ele ainda não informou. */
  providerFeeCents: number | null;
};

/** Quantas reservas vivas e futuras dependem de cada serviço e de cada pessoa. */
export type PortalCommitments = {
  byService: Record<string, number>;
  byProfessional: Record<string, number>;
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
  /* P5 — agenda, fila e histórico operacional */
  operation: PortalOperationData | null;
  /* P6 — cadastro e negócio */
  services: PortalService[];
  professionals: PortalProfessional[];
  members: PortalMember[];
  invitations: PortalInvitation[];
  businessHours: PortalBusinessHour[];
  schedules: PortalSchedule[];
  exceptions: PortalException[];
  photos: PortalPhoto[];
  settings: PortalSettings | null;
  business: PortalBusiness;
  finance: PortalFinance;
  commitments: PortalCommitments;
};

/* ── Entradas das escritas de cadastro e negócio (P6) ───────────────────── */

export type TimeWindow = { startsAt: string; endsAt: string };

export type ServiceInput = {
  id: string | null;
  establishmentId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
  professionalIds: string[];
};

export type ProfessionalInput = {
  id: string | null;
  establishmentId: string;
  displayName: string;
  title: string | null;
  isActive: boolean;
  userId: string | null;
  serviceIds: string[];
};

export type ExceptionInput = {
  establishmentId: string;
  professionalId: string | null;
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  isAvailable: boolean;
  reason: string | null;
};

export type PublicProfilePatch = {
  description: string | null;
  addressLine: string | null;
  neighborhood: string | null;
  phone: string | null;
  accentColor: string | null;
};

export type RulesPatch = Partial<{
  bookingMode: BookingMode;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  depositPercent: number;
  cancellationWindowMinutes: number;
}>;

export type SettingsPatch = Partial<
  Database["public"]["Tables"]["establishment_settings"]["Update"]
>;

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

export const WEEKDAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Semana começando na segunda, que é como a loja pensa a própria escala. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
