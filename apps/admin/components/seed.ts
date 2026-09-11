/**
 * O dado do canvas convertido para o formato de `model.ts`.
 *
 * Existe só enquanto o admin não lê o banco: quando a camada de dados passar
 * para o Supabase, este arquivo e as listas de `data.ts` morrem juntos (R3).
 */

import {
  APPROVALS,
  AUDIT,
  BILLING,
  CATALOG,
  CITIES,
  CUSTOMER_MISSES,
  CUSTOMERS,
  DECISIONS,
  ESTABLISHMENTS,
  NORESULT,
  PANORAMA,
  PARAMS,
  RECENT_REVIEWS,
  REPORTS,
  SUGGEST,
  TEAM,
  TRANSFERS,
  USAGE_BARS,
} from "./data";
import type {
  AdminData,
  Application,
  AuditEntry,
  CatalogItem,
  City,
  Customer,
  Decision,
  Establishment,
  Invoice,
  Me,
  NoResultSearch,
  PanoramaRow,
  Param,
  PlanDef,
  RecentReview,
  Report,
  Suggestion,
  TeamMember,
  Transfer,
} from "./model";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "12 mar 2025" ou "30 ago 2026, 16:42" → ISO. */
function parseDay(text: string): string {
  const [datePart, timePart] = text.split(",").map((t) => t.trim());
  const [dd, mon, yyyy] = (datePart ?? "").split(" ");
  const [hh, mm] = (timePart ?? "12:00").split(":");
  return new Date(
    Number(yyyy),
    MONTHS.indexOf(mon ?? "jan"),
    Number(dd),
    Number(hh),
    Number(mm),
  ).toISOString();
}

/** "R$ 1.842,60" → 184260 */
const parseMoney = (text: string) =>
  Math.round(Number(text.replace(/[^\d,]/g, "").replace(",", ".")) * 100) || 0;

/** "38.204" → 38204 */
const parseCount = (text: string) => Number(text.replace(/\D/g, "")) || 0;

/** "2d 4h", "22h" → ISO de quando começou a esperar, contado de agora. */
function sinceWait(wait: string, now: number): string {
  const days = Number(/(\d+)d/.exec(wait)?.[1] ?? 0);
  const hours = Number(/(\d+)h/.exec(wait)?.[1] ?? 0);
  return new Date(now - (days * 24 + hours) * 3600 * 1000).toISOString();
}

/** "28 ago" → ISO no ano do canvas. */
const shortDay = (text: string) => parseDay(`${text} 2026`);

const CITY_STATUS = { ativa: "active", pre: "pre_launch", aval: "evaluating" } as const;

const REVENUE_OVERDUE = new Set(["Clínica Pele Viva", "Studio Hair Lorena", "Derma Center Sul"]);

export function seedState(now = Date.now()): AdminData {
  const cities: City[] = CITIES.map((c) => ({
    id: c.id,
    name: c.name,
    uf: c.uf,
    status: CITY_STATUS[c.st as keyof typeof CITY_STATUS] ?? "evaluating",
    establishments: c.est,
    customers: parseCount(c.cli),
    appointmentsMonth: parseCount(c.appt),
    quotaTotal: c.qt,
    quotaUsed: c.qu,
    monthlyPriceCents: c.price === "—" ? null : parseMoney(c.price),
    categories: c.cats,
    gaps: c.gaps,
  }));

  const cityId = (name: string) => cities.find((c) => c.name === name)?.id ?? "";

  const applications: Application[] = APPROVALS.map((a) => ({
    id: a.id,
    name: a.name,
    cityId: cityId(a.city),
    city: a.city,
    category: a.cat,
    submittedAt: sinceWait(a.wait, now),
    cnpj: a.cnpj,
    legalName: a.razao,
    address: a.addr,
    phone: a.fone,
    responsible: a.resp,
    email: a.email,
    professionals: a.pros,
    services: a.servs,
    photos: a.photos,
  }));

  const decisions: Decision[] = DECISIONS.map((d, i) => ({
    id: `d${i}`,
    name: d.name,
    city: d.city,
    decision: d.dec === "Aprovado" ? "approved" : d.dec === "Recusado" ? "rejected" : "correction",
    plan: d.plan.startsWith("Mensalidade")
      ? "monthly"
      : d.plan.startsWith("Comissão")
        ? "commission"
        : null,
    who: d.who,
    at: parseDay(d.when),
  }));

  const establishments: Establishment[] = ESTABLISHMENTS.map((e, i) => ({
    id: e.id,
    name: e.name,
    cityId: cityId(e.city),
    city: e.city,
    category: e.cat,
    status: e.st === "suspenso" ? "suspended" : "active",
    // no protótipo o id de cada plano é o próprio tipo
    planId: e.plan.startsWith("Mensalidade") ? "monthly" : "commission",
    plan: e.plan.startsWith("Mensalidade") ? "monthly" : "commission",
    overdue: e.st === "vencido" || REVENUE_OVERDUE.has(e.name),
    appointmentsMonth: e.appt,
    platformRevenueCents: parseMoney(e.rev),
    since: parseDay(e.since),
    risk: e.risk || null,
    discountPercent: null,
    // o canvas só desenha a ficha da Lorena; as outras reaproveitam o formato
    cnpj: i === 4 ? "32.774.019/0001-58" : `4${i}.${100 + i * 7}.${300 + i}/0001-${10 + i}`,
    address:
      i === 4
        ? "R. Teodoro Sampaio, 1420 — Pinheiros, São Paulo/SP"
        : `Endereço cadastrado · ${e.city}`,
    responsible: i === 4 ? "Lorena Prado · (11) 98221-7740" : "Responsável cadastrado",
    professionals: i === 4 ? 6 : 3 + (i % 4),
    usage:
      i === 4 ? USAGE_BARS : USAGE_BARS.map((v, m) => Math.round(v * (0.8 + ((i + m) % 5) * 0.1))),
  }));

  const invoices: Invoice[] = BILLING.map((b, i) => {
    const est = establishments.find((e) => e.name === b.est);
    return {
      id: `inv${i}`,
      establishmentId: est?.id ?? "",
      establishment: b.est,
      city: b.city,
      competence: parseDay(`01 ${b.comp}`),
      amountCents: parseMoney(b.val),
      dueDate: parseDay(b.due),
      paidAt: b.st === "paga" ? parseDay(b.due) : null,
      status: b.st === "paga" ? "paid" : b.st === "pend" ? "pending" : "overdue",
    };
  });

  const transfers: Transfer[] = TRANSFERS.map((t, i) => ({
    id: `tr${i}`,
    establishment: t.est,
    city: t.city,
    grossCents: parseMoney(t.gross),
    feeCents: parseMoney(t.fee),
    status: t.st === "Enviado" ? "sent" : "held",
    at: t.when.startsWith("libera") ? shortDay(t.when.replace("libera ", "")) : parseDay(t.when),
  }));

  const plans: PlanDef[] = [
    {
      id: "monthly",
      kind: "monthly",
      name: "Mensalidade fixa",
      active: true,
      commissionPercent: null,
      maxProfessionals: 12,
      maxBranches: 3,
      queueIncluded: true,
      integratedPayment: "optional",
      searchHighlight: true,
    },
    {
      id: "commission",
      kind: "commission",
      name: "Comissão por agendamento",
      active: true,
      commissionPercent: 12,
      maxProfessionals: null,
      maxBranches: 1,
      queueIncluded: true,
      integratedPayment: "required",
      searchHighlight: false,
    },
  ];

  const catalog: CatalogItem[] = CATALOG.flatMap((g) =>
    g.items.map((item, i) => ({
      id: `${g.group}-${i}`,
      group: g.group,
      name: item.name,
      durationMinutes: item.name === "Corte masculino" ? 30 : 30 + (i % 3) * 15,
      synonyms:
        item.name === "Corte masculino"
          ? ["corte", "corte de cabelo", "cabelo masculino", "máquina", "social"]
          : [],
      establishments: item.n,
      searchesMonth: item.name === "Corte masculino" ? 48211 : Math.round(item.n * 38),
      appointmentsMonth: item.name === "Corte masculino" ? 31904 : Math.round(item.n * 24),
      averagePriceCents: item.name === "Corte masculino" ? 4890 : null,
    })),
  );

  const suggestions: Suggestion[] = SUGGEST.map((s, i) => ({
    id: `s${i}`,
    group: ["Barbearia", "Salão de beleza", "Massagem", "Petshop"][i] ?? "Serviços",
    name: s.name,
    establishment: s.by,
    city: s.city,
    requests: s.n,
  }));

  const noResults: NoResultSearch[] = NORESULT.map((n) => ({
    term: n.term,
    city: n.city,
    count: n.n,
  }));

  const reports: Report[] = REPORTS.map((r) => ({
    id: r.id,
    reviewId: `rev-${r.id}`,
    establishmentId: establishments.find((e) => e.name === r.est)?.id ?? "",
    establishment: r.est,
    city: r.city,
    reason: r.reason,
    status: "open",
    openedAt: sinceWait(r.wait, now),
    rating: r.rating,
    text: r.text,
    author: r.author,
    reviewedAt: parseDay(r.authorDate),
    service: r.service,
    professional: r.pro,
    appointmentAt: parseDay(r.apptDate),
    valueCents: parseMoney(r.value),
    authorReviews: r.authorReviews,
    authorAverage: Number(r.authorAvg.replace(",", ".")),
    authorRemoved: r.authorRemoved,
    justification: r.justification,
    establishmentAverage: r.estAvg,
    establishmentReviews: r.estTotal,
    establishmentReports: r.estReports,
  }));

  const panorama: PanoramaRow[] = PANORAMA.map((p) => ({
    id: p.id,
    establishmentId: establishments.find((e) => e.name === p.name)?.id ?? "",
    name: p.name,
    city: p.city,
    average: p.avg,
    delta30: p.d,
    total: p.total,
    month: p.month,
    reports: p.rep,
  }));

  const recentReviews: Record<string, RecentReview[]> = Object.fromEntries(
    Object.entries(RECENT_REVIEWS).map(([id, list]) => [
      id,
      list.map((r) => ({ rating: r.r, who: r.who, at: shortDay(r.when), text: r.t })),
    ]),
  );

  const customers: Customer[] = CUSTOMERS.map((c, i) => {
    const rate = Number(c.ns.replace("%", "").replace(",", "."));
    return {
      id: `cu${i}`,
      name: c.name,
      city: c.city,
      since: parseDay(c.since),
      appointments: c.appt,
      noShows: Math.round((c.appt * rate) / 100),
      blocked: false,
      misses:
        c.name === "Rogério Tavares"
          ? CUSTOMER_MISSES.map((m) => ({ establishment: m.est, at: shortDay(m.when) }))
          : [],
    };
  });

  const LAST_SEEN = [0, 34, 60 * 20, 180];
  const team: TeamMember[] = TEAM.map((t, i) => ({
    id: `t${i}`,
    name: t.name,
    email: t.email,
    role: t.role,
    scope: t.scope,
    lastSeen: new Date(now - (LAST_SEEN[i] ?? 0) * 60000).toISOString(),
  }));

  const PARAM_KEYS = [
    ["cancellation_window_hours", 4, "horas antes"],
    ["no_show_block_threshold", 3, "faltas em 30 dias"],
    ["default_commission_percent", 12, "%"],
    ["delinquency_grace_days", 15, "dias"],
    ["queue_max_per_professional", 8, "pessoas"],
    ["plan_change_interval_days", 90, "dias"],
  ] as const;
  const params: Param[] = PARAMS.map((p, i) => ({
    key: PARAM_KEYS[i]?.[0] ?? `param_${i}`,
    label: p.label,
    value: PARAM_KEYS[i]?.[1] ?? 0,
    unit: PARAM_KEYS[i]?.[2] ?? "",
  }));

  const audit: AuditEntry[] = AUDIT.map((a, i) => ({
    id: `a${i}`,
    who: a.who,
    action: a.act,
    meta: a.meta,
    at: parseDay(a.when),
    accountAccess: a.flag,
  }));

  const me: Me = { id: "t0", name: "Helena Reis", role: "Operações · admin" };

  return {
    overview: {
      activeEstablishments: establishments.filter((item) => item.status === "active").length,
      approvedMonth: 47,
      suspendedMonth: 12,
      appointmentsMonth: 121043,
      paidInAppMonth: 46480,
      series: [
        {
          month: "2026-03-01T00:00:00Z",
          appointments: 94000,
          monthlyCents: 11800000,
          commissionCents: 6200000,
        },
        {
          month: "2026-04-01T00:00:00Z",
          appointments: 99000,
          monthlyCents: 12100000,
          commissionCents: 6500000,
        },
        {
          month: "2026-05-01T00:00:00Z",
          appointments: 105000,
          monthlyCents: 12500000,
          commissionCents: 6800000,
        },
        {
          month: "2026-06-01T00:00:00Z",
          appointments: 111000,
          monthlyCents: 12900000,
          commissionCents: 7100000,
        },
        {
          month: "2026-07-01T00:00:00Z",
          appointments: 116000,
          monthlyCents: 13300000,
          commissionCents: 7400000,
        },
        {
          month: "2026-08-01T00:00:00Z",
          appointments: 121043,
          monthlyCents: 13720000,
          commissionCents: 7718000,
        },
      ],
    },
    me,
    cities,
    applications,
    decisions,
    establishments,
    invoices,
    transfers,
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
    audit,
  };
}
