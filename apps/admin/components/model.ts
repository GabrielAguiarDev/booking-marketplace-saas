/**
 * Formato dos dados que as telas do admin consomem.
 *
 * Números e datas chegam crus — centavos, contagens, ISO 8601 — e só viram
 * texto na tela. É o formato que o banco entrega; as telas não precisam saber
 * de onde o dado veio.
 */

export type PlanKind = "monthly" | "commission";
export type EstablishmentStatus = "pending" | "active" | "suspended";
export type CityStatus = "active" | "pre_launch" | "evaluating";
export type DecisionKind = "approved" | "rejected" | "correction";
export type InvoiceStatus = "paid" | "pending" | "overdue";
export type EstablishmentCategory =
  | "barbershop"
  | "salon"
  | "aesthetic_clinic"
  | "dermatology"
  | "petshop"
  | "nail_salon"
  | "dentistry"
  | "massage";

export const CATEGORY_LABEL: Record<EstablishmentCategory, string> = {
  barbershop: "Barbearia",
  salon: "Salão",
  aesthetic_clinic: "Estética",
  dermatology: "Dermatologia",
  petshop: "Petshop",
  nail_salon: "Manicure",
  dentistry: "Odontologia",
  massage: "Massagem",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category as EstablishmentCategory] ?? category;
}

export function categoryValue(label: string): EstablishmentCategory {
  const entry = Object.entries(CATEGORY_LABEL).find(([, value]) => value === label);
  return (entry?.[0] as EstablishmentCategory | undefined) ?? "barbershop";
}

/** Papel na equipe da plataforma (`platform_role` no banco). */
export type PlatformRole = "admin" | "operations" | "finance" | "support";

export const ROLE_LABEL: Record<PlatformRole, string> = {
  admin: "Administrador da plataforma",
  operations: "Operações e moderação",
  finance: "Financeiro",
  support: "Suporte",
};

export const ROLE_SCOPE: Record<PlatformRole, string> = {
  admin: "Toda a plataforma",
  operations: "Cadastros, catálogo e avaliações",
  finance: "Planos, cobrança e repasses",
  support: "Contas e atendimento",
};

export type Me = { id: string; name: string; role: string; roleKey: PlatformRole };

export type City = {
  id: string;
  name: string;
  uf: string;
  status: CityStatus;
  establishments: number;
  customers: number;
  appointmentsMonth: number;
  /** Vagas de mensalidade; 0 quando a cidade ainda não tem cota. */
  quotaTotal: number;
  quotaUsed: number;
  monthlyPriceCents: number | null;
  categories: string[];
  gaps: string[];
};

export type Application = {
  id: string;
  name: string;
  cityId: string;
  city: string;
  category: string;
  submittedAt: string;
  cnpj: string;
  legalName: string;
  address: string;
  phone: string;
  responsible: string;
  email: string;
  professionals: number;
  services: string[];
  photos: number;
};

export type Decision = {
  id: string;
  name: string;
  city: string;
  decision: DecisionKind;
  plan: PlanKind | null;
  who: string;
  at: string;
};

export type Establishment = {
  id: string;
  name: string;
  cityId: string;
  city: string;
  category: string;
  status: EstablishmentStatus;
  /** O plano contratado; `plan` é só o tipo dele. */
  planId: string | null;
  plan: PlanKind;
  /** Cobrança da mensalidade em aberto e vencida. */
  overdue: boolean;
  appointmentsMonth: number;
  /** Quanto a plataforma recebeu da loja no mês. */
  platformRevenueCents: number;
  since: string;
  risk: string | null;
  discountPercent: number | null;
  cnpj: string;
  address: string;
  responsible: string;
  professionals: number;
  /** Agendamentos por mês, do mais antigo ao atual — 12 meses. */
  usage: number[];
};

export type Invoice = {
  id: string;
  establishmentId: string;
  establishment: string;
  city: string;
  competence: string;
  amountCents: number;
  dueDate: string;
  paidAt: string | null;
  status: InvoiceStatus;
};

export type Transfer = {
  id: string;
  establishment: string;
  city: string;
  grossCents: number;
  feeCents: number;
  status: "sent" | "held";
  at: string;
};

export type PlanDef = {
  id: string;
  kind: PlanKind;
  name: string;
  active: boolean;
  /** Mensalidade: a faixa de preço vem das cidades. Comissão: o percentual. */
  commissionPercent: number | null;
  maxProfessionals: number | null;
  maxBranches: number | null;
  queueIncluded: boolean;
  integratedPayment: "optional" | "required";
  searchHighlight: boolean;
};

export type CatalogItem = {
  id: string;
  group: string;
  name: string;
  durationMinutes: number;
  synonyms: string[];
  /** Lojas que oferecem um serviço ligado a este item. */
  establishments: number;
  /** Cidades dessas lojas. */
  cities: number;
  searchesMonth: number;
  appointmentsMonth: number;
  averagePriceCents: number | null;
};

export type Suggestion = {
  id: string;
  group: string;
  name: string;
  establishment: string;
  city: string;
  requests: number;
};

export type NoResultSearch = { term: string; city: string; count: number };

export type ReportStatus = "open" | "awaiting_establishment";

export type Report = {
  id: string;
  reviewId: string;
  establishmentId: string;
  establishment: string;
  city: string;
  reason: string;
  status: ReportStatus;
  openedAt: string;
  rating: number;
  text: string;
  author: string;
  reviewedAt: string;
  service: string;
  professional: string;
  appointmentAt: string;
  valueCents: number;
  authorReviews: number;
  authorAverage: number;
  authorRemoved: number;
  justification: string;
  establishmentAverage: number;
  establishmentReviews: number;
  establishmentReports: number;
};

export type PanoramaRow = {
  id: string;
  establishmentId: string;
  name: string;
  city: string;
  average: number;
  delta30: number;
  total: number;
  month: number;
  reports: number;
};

export type RecentReview = { rating: number; who: string; at: string; text: string };

export type Customer = {
  id: string;
  name: string;
  city: string;
  since: string;
  appointments: number;
  noShows: number;
  blocked: boolean;
  misses: { establishment: string; at: string }[];
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleKey: PlatformRole;
  scope: string;
  lastSeen: string | null;
  /** Convidada e ainda não aceitou o convite. */
  pending: boolean;
};

export type Param = {
  key: string;
  label: string;
  value: number;
  unit: string;
};

export type AuditEntry = {
  id: string;
  who: string;
  action: string;
  meta: string;
  at: string;
  /** Acesso a conta de estabelecimento — sai destacado no registro. */
  accountAccess: boolean;
};

export type OverviewPoint = {
  month: string;
  appointments: number;
  monthlyCents: number;
  commissionCents: number;
};

export type OverviewStats = {
  activeEstablishments: number;
  approvedMonth: number;
  suspendedMonth: number;
  appointmentsMonth: number;
  paidInAppMonth: number;
  series: OverviewPoint[];
};

/* ── formatação ─────────────────────────────────────────────── */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const cents = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const whole = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** R$ 1.842,60 */
export const brl = (valueCents: number) => `R$ ${cents.format(valueCents / 100)}`;

/** R$ 214.380 — para painel, sem centavos. */
export const brlWhole = (valueCents: number) => `R$ ${whole.format(Math.round(valueCents / 100))}`;

/** 38.204 */
export const count = (value: number) => whole.format(value);

/** 12 mar 2025 */
export function day(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 30 ago 2026, 16:42 */
export function stamp(iso: string): string {
  const d = new Date(iso);
  return `${day(iso)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** ago 2026 */
export function competence(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Tempo desde `iso` no formato da fila: 2d 4h, 22h, 35min. */
export function waited(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Mais de 48 horas esperando: a fila pinta de vermelho. */
export const isLate = (iso: string, now = Date.now()) =>
  now - new Date(iso).getTime() > 48 * 3600 * 1000;

/** Há 34 min, ontem, 18:12 — para "última atividade". */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "nunca";
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.round(minutes / 60)} h`;
  if (minutes < 48 * 60) {
    const d = new Date(iso);
    return `ontem, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return day(iso);
}

export const PLAN_LABEL: Record<PlanKind, string> = {
  monthly: "Mensalidade",
  commission: "Comissão",
};

export const DECISION_LABEL: Record<DecisionKind, string> = {
  approved: "Aprovado",
  rejected: "Recusado",
  correction: "Correção solicitada",
};

export const CITY_STATUS_LABEL: Record<CityStatus, string> = {
  active: "Ativa",
  pre_launch: "Pré-lançamento",
  evaluating: "Em avaliação",
};

/** Plano da loja em texto, com o percentual da comissão quando é o caso. */
export function planText(plan: PlanKind, commissionPercent: number | null): string {
  return plan === "monthly" ? "Mensalidade" : `Comissão ${commissionPercent ?? 12}%`;
}

/** Taxa de não comparecimento, em percentual. */
export const noShowRate = (c: Pick<Customer, "appointments" | "noShows">) =>
  c.appointments ? (c.noShows / c.appointments) * 100 : 0;

/** Um valor de parâmetro em texto, com a unidade que ele usa na tela. */
export function paramText(p: Param): string {
  if (p.unit === "%") return `${p.value}%`;
  if (p.unit === "horas antes") return `${p.value} ${p.value === 1 ? "hora" : "horas"} antes`;
  if (p.unit === "faltas em 30 dias") return `${p.value} em 30 dias`;
  return `${p.value} ${p.unit}`;
}

/* ── console de leitura da conta ───────────────────────────── */

export type AccessSession = {
  id: string;
  establishmentId: string;
  establishment: string;
  reason: string;
  startedAt: string;
  expiresAt: string;
};

export type AccountAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  customer: string;
  service: string;
  professional: string;
  priceCents: number;
};

export type AccountService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
  professionals: number;
};

export type AccountProfessional = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  active: boolean;
  services: string[];
};

export type AccountSettings = {
  timezone: string;
  bookingMode: string;
  cancellationWindowMinutes: number;
  depositPercent: number;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  queueRemoteJoin: boolean;
  queueRequireArrival: boolean;
  queueArrivalMethod: string;
  queuePerProfessional: boolean;
  queueAutoClose: boolean;
  queueCloseAfterMinutes: number;
  queueAutoSkip: boolean;
  queueNotifyEnabled: boolean;
  queueNotifyChannel: string;
  autoApprove: boolean;
  depositRefundable: boolean;
  acceptAppPayment: boolean;
};

export type AccountReview = {
  id: string;
  rating: number;
  comment: string | null;
  tags: string[];
  customer: string;
  professional: string | null;
  createdAt: string;
};

/** Tudo o que o painel lê. Uma carga só; as ações devolvem o painel atualizado. */
export type AdminData = {
  overview: OverviewStats;
  me: Me;
  cities: City[];
  applications: Application[];
  decisions: Decision[];
  establishments: Establishment[];
  invoices: Invoice[];
  transfers: Transfer[];
  plans: PlanDef[];
  catalog: CatalogItem[];
  suggestions: Suggestion[];
  noResults: NoResultSearch[];
  reports: Report[];
  panorama: PanoramaRow[];
  recentReviews: Record<string, RecentReview[]>;
  customers: Customer[];
  team: TeamMember[];
  params: Param[];
  /** Exigência de TOTP para qualquer RPC administrativa. */
  mfaRequired: boolean;
  audit: AuditEntry[];
  banners: Banner[];
  tickets: Ticket[];
  accessSessions: AccessSession[];
  /** Só Suporte/Admin pode abrir a conta; Operações continua atendendo chamados. */
  accountConsoleAccess: boolean;
  /** O papel atende chamados. Financeiro não: o banco nega a fila e ela vem vazia. */
  supportAccess: boolean;
};

/* ── suporte ────────────────────────────────────────────────── */

export type TicketStatus = "open" | "waiting_customer" | "resolved";
export type TicketPriority = "low" | "normal" | "high";
export type TicketCategory = "account" | "billing" | "booking" | "payment" | "technical" | "other";

/** Chamado aberto por uma loja (em nome dela) ou por um cliente. */
export type Ticket = {
  id: string;
  /** O número curto que se fala ao telefone: #4417. */
  number: number;
  requesterKind: "establishment" | "customer";
  requesterName: string;
  requesterEmail: string;
  /** A loja que abriu, ou a loja de que o cliente fala. */
  establishmentId: string | null;
  establishment: string | null;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo: string | null;
  assignee: string | null;
  /** Desde quando espera quem está com a vez — a equipe, se aberto. */
  waitingSince: string;
  lastMessageAt: string;
  lastFromStaff: boolean;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  messages: number;
  preview: string;
};

export type TicketMessage = {
  id: string;
  author: string;
  fromStaff: boolean;
  body: string;
  at: string;
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Aberto",
  waiting_customer: "Aguardando cliente",
  resolved: "Resolvido",
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  account: "Conta e acesso",
  billing: "Plano e cobrança",
  booking: "Agenda e reservas",
  payment: "Pagamento",
  technical: "Problema no app",
  other: "Outro assunto",
};

/* ── vitrine ────────────────────────────────────────────────── */

/** Para onde o banner leva: uma loja, uma categoria ou um link https. */
export type BannerTarget = "establishment" | "category" | "url";

/** Banner da home do app do cliente. Global: não tem cidade. */
export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  /** Caminho no bucket `showcase`; `imageUrl` é a URL pública dele. */
  imagePath: string;
  imageUrl: string;
  targetKind: BannerTarget;
  /** Id da loja, valor da categoria ou o link. */
  targetValue: string;
  /** Nome da loja, rótulo da categoria ou o link. */
  targetLabel: string;
  /** A loja de destino ainda está ativa. Sempre `true` para categoria e link. */
  targetAvailable: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  active: boolean;
  createdBy: string | null;
  updatedAt: string;
};

/** O que o formulário de banner envia. Sem `id`, cria; sem `file`, mantém a imagem. */
export type BannerInput = {
  id?: string;
  title: string;
  subtitle: string;
  file?: File;
  targetKind: BannerTarget;
  targetValue: string;
  startsAt: string | null;
  endsAt: string | null;
};

export type BannerState = "live" | "scheduled" | "ended" | "paused" | "unavailable";

/** A situação que a tela mostra — a mesma regra de `showcase_is_live()` no banco. */
export function bannerState(b: Banner, now = Date.now()): BannerState {
  if (!b.active) return "paused";
  if (b.endsAt && new Date(b.endsAt).getTime() <= now) return "ended";
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return "scheduled";
  if (!b.targetAvailable) return "unavailable";
  return "live";
}
