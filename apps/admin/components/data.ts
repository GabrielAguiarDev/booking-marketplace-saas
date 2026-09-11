/**
 * Protótipo do portal administrativo: os dados abaixo são os mesmos do canvas
 * `docs/design-page/Vez Portal Admin.dc.html`. Nada aqui fala com o Supabase
 * ainda.
 */

import {
  AMBER,
  AMBER_SOFT,
  GREEN,
  GREEN_SOFT,
  MUTED,
  NEUTRAL_SOFT,
  RED,
  RED_SOFT,
} from "./tokens";

export type ScreenId =
  | "overview"
  | "approvals"
  | "estab"
  | "estabDetail"
  | "accountConsole"
  | "support"
  | "cities"
  | "quotas"
  | "showcase"
  | "services"
  | "reviews"
  | "finance"
  | "customers"
  | "settings";

/** Item de menu; `estabDetail` só é alcançável a partir da lista. */
export type NavId = Exclude<ScreenId, "estabDetail" | "accountConsole">;

export const NAV: { label: string; items: { id: NavId; label: string; badge?: string; d: string }[] }[] =
  [
    {
      label: "Operação",
      items: [
        { id: "overview", label: "Visão geral", d: "M3 3h8v8H3zM13 3h8v5h-8zM13 12h8v9h-8zM3 15h8v6H3z" },
        {
          id: "approvals",
          label: "Aprovações",
          badge: "7",
          d: "M9 11l3 3 8-8M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
        },
        { id: "estab", label: "Estabelecimentos", d: "M3 9l1.6-5h14.8L21 9M4.5 9v11h15V9M9 20v-6h6v6" },
        {
          id: "support",
          label: "Suporte",
          badge: "5",
          d: "M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z",
        },
      ],
    },
    {
      label: "Crescimento",
      items: [
        {
          id: "cities",
          label: "Cidades",
          d: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0M12 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5",
        },
        { id: "quotas", label: "Cotas e planos", d: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
        { id: "showcase", label: "Vitrine", d: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6" },
      ],
    },
    {
      label: "Catálogo",
      items: [
        { id: "services", label: "Serviços", d: "M4 6h16M8 12h12M12 18h8M4 6v12" },
        {
          id: "reviews",
          label: "Avaliações",
          badge: "5",
          d: "M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3 1.2-6.5L2.5 9.9 9.1 9z",
        },
      ],
    },
    {
      label: "Negócio",
      items: [
        { id: "finance", label: "Financeiro", badge: "4", d: "M3 6h18v12H3zM3 10h18M6.5 14h4" },
        {
          id: "customers",
          label: "Clientes finais",
          d: "M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 6a3 3 0 100 6 3 3 0 000-6M22 20v-2a4 4 0 00-3-3.9M17 6.1a3 3 0 010 5.8",
        },
        { id: "settings", label: "Configurações", d: "M4 6h16M4 12h16M4 18h16" },
      ],
    },
  ];

export const TITLES: Record<ScreenId, [string, string]> = {
  overview: ["Visão geral", "Plataforma toda · agosto 2026"],
  approvals: ["Aprovações", "7 solicitações aguardando"],
  estab: ["Estabelecimentos", "1.284 ativos · 1.361 no total"],
  estabDetail: ["Estabelecimentos", "Ficha do estabelecimento"],
  accountConsole: ["Acesso à conta", "Console somente leitura"],
  support: ["Suporte", "5 chamados abertos"],
  cities: ["Cidades", "8 ativas · 3 em avaliação"],
  quotas: ["Cotas e planos", "2 planos ativos"],
  showcase: ["Vitrine", "Banners da Home do app"],
  services: ["Serviços", "Catálogo global curado"],
  reviews: ["Avaliações", "Moderação e panorama das notas"],
  finance: ["Financeiro", "Agosto 2026"],
  customers: ["Clientes finais", "86.412 cadastrados"],
  settings: ["Configurações", "Equipe, parâmetros e auditoria"],
};

/* ── etiquetas de situação ──────────────────────────────────── */

export type StatusKey =
  | "ativo"
  | "vencido"
  | "suspenso"
  | "pendente"
  | "ativa"
  | "pre"
  | "aval"
  | "paga"
  | "pend";

export type Chip = { label: string; fg: string; bg: string };

export const STATUS: Record<StatusKey, Chip> = {
  ativo: { label: "Ativo", fg: GREEN, bg: GREEN_SOFT },
  vencido: { label: "Inadimplente", fg: RED, bg: RED_SOFT },
  suspenso: { label: "Suspenso", fg: RED, bg: RED_SOFT },
  pendente: { label: "Aguardando análise", fg: AMBER, bg: AMBER_SOFT },
  ativa: { label: "Ativa", fg: GREEN, bg: GREEN_SOFT },
  pre: { label: "Pré-lançamento", fg: AMBER, bg: AMBER_SOFT },
  aval: { label: "Em avaliação", fg: MUTED, bg: NEUTRAL_SOFT },
  paga: { label: "Paga", fg: GREEN, bg: GREEN_SOFT },
  pend: { label: "Pendente", fg: AMBER, bg: AMBER_SOFT },
};

export const chip = (key: StatusKey): Chip => STATUS[key];

/* ── visão geral ────────────────────────────────────────────── */

export const CITY_QUOTA = [
  { name: "São Paulo", total: 40, used: 40 },
  { name: "Campinas", total: 24, used: 22 },
  { name: "Curitiba", total: 24, used: 17 },
  { name: "Belo Horizonte", total: 24, used: 24 },
  { name: "Florianópolis", total: 18, used: 9 },
  { name: "Goiânia", total: 18, used: 6 },
];

export const REVENUE_SERIES = [148, 163, 171, 186, 198, 214];
export const VOLUME_SERIES = [8.2, 9.1, 9.6, 10.4, 11.2, 12.1];
export const CHART_MONTHS = ["mar", "abr", "mai", "jun", "jul", "ago"];

/* ── aprovações ─────────────────────────────────────────────── */

export type Approval = {
  id: string;
  name: string;
  city: string;
  cat: string;
  wait: string;
  late: boolean;
  cnpj: string;
  razao: string;
  addr: string;
  fone: string;
  resp: string;
  email: string;
  pros: number;
  servs: string[];
  photos: number;
};

export const APPROVALS: Approval[] = [
  {
    id: "a1",
    name: "Studio Nagô Barbearia",
    city: "São Paulo",
    cat: "Barbearia",
    wait: "2d 4h",
    late: true,
    cnpj: "41.882.310/0001-06",
    razao: "Nagô Serviços de Beleza ME",
    addr: "R. Aurora, 812 — Santa Cecília, São Paulo/SP",
    fone: "(11) 98812-4409",
    resp: "Márcio Aparecido de Souza",
    email: "contato@studionago.com.br",
    pros: 4,
    servs: ["Corte masculino", "Barba tradicional", "Corte + barba", "Pigmentação", "Sobrancelha"],
    photos: 5,
  },
  {
    id: "a2",
    name: "Clínica Dermav",
    city: "Campinas",
    cat: "Dermatologia",
    wait: "1d 9h",
    late: false,
    cnpj: "29.114.556/0001-71",
    razao: "Dermav Clínica Médica S/S",
    addr: "Av. Dr. Moraes Salles, 1140 — Centro, Campinas/SP",
    fone: "(19) 3232-8890",
    resp: "Dra. Renata Villaça",
    email: "adm@dermav.com.br",
    pros: 6,
    servs: ["Consulta dermatológica", "Peeling químico", "Botox", "Preenchimento"],
    photos: 8,
  },
  {
    id: "a3",
    name: "Pet Amigo Banho & Tosa",
    city: "Curitiba",
    cat: "Petshop",
    wait: "22h",
    late: false,
    cnpj: "53.007.918/0001-33",
    razao: "Pet Amigo Comércio de Animais LTDA",
    addr: "R. Padre Anchieta, 2210 — Bigorrilho, Curitiba/PR",
    fone: "(41) 99150-2277",
    resp: "Cristiane Bueno",
    email: "cris@petamigo.pet",
    pros: 3,
    servs: ["Banho", "Tosa higiênica", "Tosa na máquina", "Hidratação"],
    photos: 4,
  },
  {
    id: "a4",
    name: "Espaço Lumen Estética",
    city: "Florianópolis",
    cat: "Estética",
    wait: "14h",
    late: false,
    cnpj: "47.665.201/0001-18",
    razao: "Lumen Estética Avançada LTDA",
    addr: "R. Bocaiúva, 2140 — Centro, Florianópolis/SC",
    fone: "(48) 98444-1120",
    resp: "Aline Kretzer",
    email: "aline@espacolumen.com.br",
    pros: 5,
    servs: ["Limpeza de pele", "Drenagem linfática", "Massagem relaxante", "Depilação a laser"],
    photos: 6,
  },
  {
    id: "a5",
    name: "Barbearia do Zé",
    city: "Goiânia",
    cat: "Barbearia",
    wait: "11h",
    late: false,
    cnpj: "38.902.774/0001-45",
    razao: "José Ferreira Barbearia ME",
    addr: "Av. T-9, 455 — Setor Bueno, Goiânia/GO",
    fone: "(62) 99671-3388",
    resp: "José Ferreira Neto",
    email: "ze@barbeariadoze.com",
    pros: 2,
    servs: ["Corte masculino", "Barba", "Pezinho"],
    photos: 3,
  },
  {
    id: "a6",
    name: "Nail Bar Aurora",
    city: "São Paulo",
    cat: "Manicure",
    wait: "8h",
    late: false,
    cnpj: "50.331.887/0001-92",
    razao: "Aurora Beleza e Estética LTDA",
    addr: "R. Harmonia, 401 — Vila Madalena, São Paulo/SP",
    fone: "(11) 97744-0021",
    resp: "Bianca Toledo",
    email: "bianca@nailbaraurora.com",
    pros: 7,
    servs: ["Manicure", "Pedicure", "Alongamento em gel", "Spa dos pés"],
    photos: 7,
  },
  {
    id: "a7",
    name: "Odonto Sorriso Belo",
    city: "Belo Horizonte",
    cat: "Odontologia",
    wait: "4h",
    late: false,
    cnpj: "26.554.019/0001-27",
    razao: "Sorriso Belo Odontologia LTDA",
    addr: "R. Pernambuco, 1180 — Savassi, Belo Horizonte/MG",
    fone: "(31) 3287-4410",
    resp: "Dr. Fábio Andrade",
    email: "contato@sorrisobelo.com.br",
    pros: 9,
    servs: ["Limpeza", "Clareamento", "Restauração", "Avaliação ortodôntica"],
    photos: 5,
  },
];

/** Vagas de mensalidade por cidade: `[total, ocupadas]`. */
export const QUOTA_BY_CITY: Record<string, [number, number]> = {
  "São Paulo": [40, 40],
  Campinas: [24, 22],
  Curitiba: [24, 17],
  "Belo Horizonte": [24, 24],
  Florianópolis: [18, 9],
  Goiânia: [18, 6],
};

export const DECISIONS = [
  {
    name: "Barbearia Vila Nova",
    city: "Campinas",
    dec: "Aprovado",
    tone: GREEN,
    plan: "Mensalidade",
    who: "Helena Reis",
    when: "30 ago 2026, 16:42",
  },
  {
    name: "Estética Bella Face",
    city: "São Paulo",
    dec: "Correção solicitada",
    tone: AMBER,
    plan: "—",
    who: "Helena Reis",
    when: "30 ago 2026, 11:07",
  },
  {
    name: "Pet Center Norte",
    city: "Goiânia",
    dec: "Aprovado",
    tone: GREEN,
    plan: "Comissão 12%",
    who: "Rafael Lima",
    when: "29 ago 2026, 18:20",
  },
  {
    name: "Clínica Mais Saúde",
    city: "Curitiba",
    dec: "Recusado",
    tone: RED,
    plan: "—",
    who: "Rafael Lima",
    when: "29 ago 2026, 09:55",
  },
];

/* ── estabelecimentos ───────────────────────────────────────── */

export type Establishment = {
  id: string;
  name: string;
  city: string;
  cat: string;
  plan: string;
  st: StatusKey;
  appt: number;
  rev: string;
  since: string;
  risk: string;
};

export const ESTABLISHMENTS: Establishment[] = [
  { id: "e1", name: "Barbearia Corte Reto", city: "São Paulo", cat: "Barbearia", plan: "Mensalidade", st: "ativo", appt: 412, rev: "R$ 349,00", since: "12 mar 2025", risk: "" },
  { id: "e2", name: "Salão Ateliê Vera", city: "Campinas", cat: "Salão", plan: "Comissão 12%", st: "ativo", appt: 288, rev: "R$ 1.842,60", since: "04 jun 2025", risk: "" },
  { id: "e3", name: "Clínica Pele Viva", city: "Curitiba", cat: "Estética", plan: "Mensalidade", st: "vencido", appt: 96, rev: "R$ 0,00", since: "21 jan 2025", risk: "Cobrança vencida há 11 dias" },
  { id: "e4", name: "Petshop Quatro Patas", city: "Belo Horizonte", cat: "Petshop", plan: "Comissão 12%", st: "ativo", appt: 174, rev: "R$ 986,40", since: "30 set 2025", risk: "" },
  { id: "e5", name: "Studio Hair Lorena", city: "São Paulo", cat: "Salão", plan: "Mensalidade", st: "ativo", appt: 61, rev: "R$ 349,00", since: "17 nov 2024", risk: "Queda de 68% no uso em 60 dias" },
  { id: "e6", name: "Derma Center Sul", city: "Florianópolis", cat: "Dermatologia", plan: "Mensalidade", st: "suspenso", appt: 0, rev: "R$ 0,00", since: "08 fev 2025", risk: "Sem agendamento há 43 dias" },
  { id: "e7", name: "Espaço Zen Massagens", city: "Goiânia", cat: "Estética", plan: "Comissão 12%", st: "ativo", appt: 133, rev: "R$ 712,80", since: "19 mai 2026", risk: "" },
  { id: "e8", name: "Odonto Vida Plena", city: "Campinas", cat: "Odontologia", plan: "Mensalidade", st: "ativo", appt: 207, rev: "R$ 449,00", since: "25 jul 2025", risk: "" },
];

export const ESTAB_BILLING: { comp: string; val: string; when: string; st: StatusKey }[] = [
  { comp: "ago 2026", val: "R$ 349,00", when: "—", st: "pend" },
  { comp: "jul 2026", val: "R$ 349,00", when: "05 jul 2026", st: "paga" },
  { comp: "jun 2026", val: "R$ 349,00", when: "04 jun 2026", st: "paga" },
  { comp: "mai 2026", val: "R$ 349,00", when: "11 mai 2026", st: "paga" },
  { comp: "abr 2026", val: "R$ 314,10", when: "05 abr 2026", st: "paga" },
];

/** Uso mensal do estabelecimento; os meses em vermelho marcam a queda. */
export const USAGE_MONTHS = ["set", "out", "nov", "dez", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago"];
export const USAGE_BARS = [64, 71, 83, 92, 88, 74, 52, 38, 21, 19, 61, 61];

export const ESTAB_TABS = [
  "Visão geral",
  "Uso da plataforma",
  "Cobranças",
  "Chamados",
  "Avaliações",
] as const;
export type EstabTab = Lowercase<(typeof ESTAB_TABS)[number]>;

/* ── cidades ────────────────────────────────────────────────── */

export type City = {
  id: string;
  name: string;
  uf: string;
  st: StatusKey;
  est: number;
  qt: number;
  qu: number;
  cli: string;
  appt: string;
  price: string;
  cats: string[];
  gaps: string[];
};

export const CITIES: City[] = [
  { id: "c1", name: "São Paulo", uf: "SP", st: "ativa", est: 412, qt: 40, qu: 40, cli: "38.204", appt: "52.118", price: "R$ 349,00", cats: ["Barbearia", "Salão", "Estética", "Petshop", "Manicure", "Odontologia"], gaps: ["Dermatologia", "Fisioterapia"] },
  { id: "c2", name: "Campinas", uf: "SP", st: "ativa", est: 148, qt: 24, qu: 22, cli: "9.870", appt: "14.203", price: "R$ 299,00", cats: ["Barbearia", "Salão", "Estética", "Odontologia"], gaps: ["Petshop", "Manicure", "Dermatologia"] },
  { id: "c3", name: "Curitiba", uf: "PR", st: "ativa", est: 131, qt: 24, qu: 17, cli: "8.412", appt: "12.006", price: "R$ 299,00", cats: ["Barbearia", "Salão", "Petshop", "Estética"], gaps: ["Dermatologia", "Manicure"] },
  { id: "c4", name: "Belo Horizonte", uf: "MG", st: "ativa", est: 126, qt: 24, qu: 24, cli: "7.988", appt: "11.744", price: "R$ 299,00", cats: ["Barbearia", "Salão", "Estética", "Odontologia", "Manicure"], gaps: ["Petshop"] },
  { id: "c5", name: "Florianópolis", uf: "SC", st: "ativa", est: 74, qt: 18, qu: 9, cli: "4.331", appt: "6.190", price: "R$ 249,00", cats: ["Barbearia", "Salão", "Estética"], gaps: ["Odontologia", "Dermatologia", "Petshop"] },
  { id: "c6", name: "Goiânia", uf: "GO", st: "ativa", est: 61, qt: 18, qu: 6, cli: "3.774", appt: "5.021", price: "R$ 249,00", cats: ["Barbearia", "Salão", "Petshop"], gaps: ["Estética", "Dermatologia", "Odontologia"] },
  { id: "c7", name: "Sorocaba", uf: "SP", st: "pre", est: 12, qt: 12, qu: 3, cli: "402", appt: "88", price: "R$ 229,00", cats: ["Barbearia"], gaps: ["Salão", "Estética", "Petshop", "Odontologia", "Manicure"] },
  { id: "c8", name: "Ribeirão Preto", uf: "SP", st: "pre", est: 8, qt: 12, qu: 2, cli: "190", appt: "31", price: "R$ 229,00", cats: ["Barbearia", "Salão"], gaps: ["Estética", "Petshop", "Odontologia"] },
  { id: "c9", name: "Londrina", uf: "PR", st: "aval", est: 0, qt: 0, qu: 0, cli: "0", appt: "0", price: "—", cats: [], gaps: ["Todas as categorias"] },
];

/* ── serviços ───────────────────────────────────────────────── */

export const CATALOG = [
  {
    group: "Barbearia",
    items: [
      { name: "Corte masculino", n: 1104, sel: true },
      { name: "Barba tradicional", n: 882 },
      { name: "Corte + barba", n: 769 },
      { name: "Pezinho", n: 511 },
    ],
  },
  {
    group: "Salão",
    items: [
      { name: "Corte feminino", n: 934 },
      { name: "Coloração", n: 702 },
      { name: "Escova", n: 688 },
      { name: "Progressiva", n: 441 },
    ],
  },
  {
    group: "Estética",
    items: [
      { name: "Limpeza de pele", n: 388 },
      { name: "Drenagem linfática", n: 266 },
      { name: "Depilação a laser", n: 201 },
    ],
  },
  {
    group: "Petshop",
    items: [
      { name: "Banho", n: 174 },
      { name: "Tosa higiênica", n: 161 },
    ],
  },
];

export const SUGGEST = [
  { name: "Corte navalhado", by: "Studio Nagô Barbearia", city: "São Paulo", n: 14 },
  { name: "Luzes / mechas", by: "Salão Ateliê Vera", city: "Campinas", n: 9 },
  { name: "Massagem esportiva", by: "Espaço Zen Massagens", city: "Goiânia", n: 6 },
  { name: "Banho medicamentoso", by: "Petshop Quatro Patas", city: "Belo Horizonte", n: 4 },
];

export const NORESULT = [
  { term: "micropigmentação labial", n: 412, city: "São Paulo" },
  { term: "quiropraxia", n: 288, city: "Curitiba" },
  { term: "design de cílios", n: 241, city: "Campinas" },
  { term: "vacina antirrábica", n: 187, city: "Belo Horizonte" },
  { term: "harmonização facial", n: 154, city: "Florianópolis" },
];

export const ALT_NAMES = ["corte", "corte de cabelo", "cabelo masculino", "máquina", "social"];

/* ── financeiro ─────────────────────────────────────────────── */

export const FINANCE_TABS = ["Receita", "Cobranças", "Repasses", "Inadimplência"] as const;
export type FinanceTab = (typeof FINANCE_TABS)[number];

export const REVENUE_ROWS = [
  { m: "ago 2026", mens: "R$ 137.200", com: "R$ 77.180", tot: "R$ 214.380", d: "+8,1%" },
  { m: "jul 2026", mens: "R$ 131.850", com: "R$ 66.470", tot: "R$ 198.320", d: "+6,3%" },
  { m: "jun 2026", mens: "R$ 126.400", com: "R$ 60.180", tot: "R$ 186.580", d: "+8,9%" },
  { m: "mai 2026", mens: "R$ 119.600", com: "R$ 51.740", tot: "R$ 171.340", d: "+4,7%" },
  { m: "abr 2026", mens: "R$ 115.300", com: "R$ 48.320", tot: "R$ 163.620", d: "+10,2%" },
];

export const BILLING: {
  est: string;
  city: string;
  comp: string;
  val: string;
  due: string;
  st: "vencida" | "pend" | "paga";
  days: string;
}[] = [
  { est: "Clínica Pele Viva", city: "Curitiba", comp: "ago 2026", val: "R$ 299,00", due: "20 ago 2026", st: "vencida", days: "11 dias" },
  { est: "Studio Hair Lorena", city: "São Paulo", comp: "ago 2026", val: "R$ 349,00", due: "25 ago 2026", st: "vencida", days: "6 dias" },
  { est: "Derma Center Sul", city: "Florianópolis", comp: "ago 2026", val: "R$ 249,00", due: "15 ago 2026", st: "vencida", days: "16 dias" },
  { est: "Barbearia Corte Reto", city: "São Paulo", comp: "ago 2026", val: "R$ 349,00", due: "05 set 2026", st: "pend", days: "—" },
  { est: "Odonto Vida Plena", city: "Campinas", comp: "ago 2026", val: "R$ 449,00", due: "05 ago 2026", st: "paga", days: "—" },
  { est: "Petshop Quatro Patas", city: "Belo Horizonte", comp: "ago 2026", val: "R$ 986,40", due: "05 ago 2026", st: "paga", days: "—" },
];

export const TRANSFERS = [
  { est: "Salão Ateliê Vera", city: "Campinas", gross: "R$ 15.355,00", fee: "R$ 1.842,60", net: "R$ 13.512,40", st: "Enviado", tone: GREEN, when: "28 ago 2026" },
  { est: "Petshop Quatro Patas", city: "Belo Horizonte", gross: "R$ 8.220,00", fee: "R$ 986,40", net: "R$ 7.233,60", st: "Enviado", tone: GREEN, when: "28 ago 2026" },
  { est: "Espaço Zen Massagens", city: "Goiânia", gross: "R$ 5.940,00", fee: "R$ 712,80", net: "R$ 5.227,20", st: "Retido", tone: AMBER, when: "libera 02 set" },
  { est: "Nail Bar Aurora", city: "São Paulo", gross: "R$ 3.410,00", fee: "R$ 409,20", net: "R$ 3.000,80", st: "Retido", tone: AMBER, when: "libera 04 set" },
];

export const DEFAULT_STEPS = [
  { d: "D+0", label: "Vencimento", meta: "cobrança marcada como vencida", tone: MUTED, n: "4" },
  { d: "D+3", label: "Primeiro aviso", meta: "e-mail + push no app do estabelecimento", tone: AMBER, n: "2" },
  { d: "D+7", label: "Segundo aviso", meta: "aviso no painel + contato do time", tone: AMBER, n: "1" },
  { d: "D+10", label: "Fim da carência", meta: "perfil perde destaque na busca", tone: RED, n: "1" },
  { d: "D+15", label: "Suspensão automática", meta: "perfil sai do app, agenda preservada", tone: RED, n: "0" },
];

/* ── clientes finais ────────────────────────────────────────── */

export const CUSTOMERS = [
  { name: "Marina Antunes", city: "São Paulo", since: "11 fev 2025", appt: 38, ns: "2,6%", tone: GREEN },
  { name: "Diego Vasconcelos", city: "Campinas", since: "04 abr 2025", appt: 21, ns: "19,0%", tone: AMBER },
  { name: "Priscila Amorim", city: "Curitiba", since: "27 jun 2025", appt: 44, ns: "0,0%", tone: GREEN },
  { name: "Rogério Tavares", city: "São Paulo", since: "02 set 2025", appt: 12, ns: "41,7%", tone: RED },
  { name: "Camila Foscarini", city: "Florianópolis", since: "19 nov 2025", appt: 9, ns: "11,1%", tone: AMBER },
  { name: "Anderson Muniz", city: "Goiânia", since: "08 jan 2026", appt: 6, ns: "0,0%", tone: GREEN },
];

export const CUSTOMER_MISSES = [
  { est: "Barbearia Corte Reto", when: "27 ago" },
  { est: "Studio Hair Lorena", when: "19 ago" },
  { est: "Barbearia Corte Reto", when: "06 ago" },
];

/* ── configurações ──────────────────────────────────────────── */

export const SETTINGS_TABS = [
  "Equipe e acessos",
  "Parâmetros da plataforma",
  "Registro de auditoria",
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const TEAM = [
  { name: "Helena Reis", email: "helena@vez.app", role: "Administradora", scope: "Acesso total", last: "agora" },
  { name: "Rafael Lima", email: "rafael@vez.app", role: "Operações", scope: "Aprovações, suporte, cidades", last: "há 34 min" },
  { name: "Juliana Perez", email: "juliana@vez.app", role: "Financeiro", scope: "Cobranças, repasses, planos", last: "ontem, 18:12" },
  { name: "Caio Bertoldo", email: "caio@vez.app", role: "Suporte", scope: "Chamados, leitura de contas", last: "há 3 h" },
];

export const AUDIT = [
  { who: "Caio Bertoldo", act: "Acesso de suporte à conta de Studio Hair Lorena", meta: "somente leitura · 15 min · motivo: chamado #4417", when: "31 ago 2026, 09:41", flag: true },
  { who: "Helena Reis", act: "Aprovou Barbearia Vila Nova", meta: "plano Mensalidade · Campinas", when: "30 ago 2026, 16:42", flag: false },
  { who: "Juliana Perez", act: "Reenviou cobrança de Clínica Pele Viva", meta: "competência ago 2026 · R$ 299,00", when: "30 ago 2026, 14:08", flag: false },
  { who: "Rafael Lima", act: "Alterou cota de mensalidade em Curitiba", meta: "20 → 24 vagas", when: "29 ago 2026, 11:26", flag: false },
  { who: "Rafael Lima", act: "Acesso de suporte à conta de Derma Center Sul", meta: "somente leitura · 30 min · motivo: verificar agenda vazia", when: "28 ago 2026, 17:03", flag: true },
];

export const PARAMS = [
  { label: "Janela de cancelamento pelo cliente", val: "4 horas antes" },
  { label: "Faltas até bloqueio automático do cliente", val: "3 em 30 dias" },
  { label: "Comissão padrão sobre agendamentos pagos", val: "12%" },
  { label: "Carência antes da suspensão por inadimplência", val: "15 dias" },
  { label: "Tamanho máximo da fila de espera por profissional", val: "8 pessoas" },
  { label: "Intervalo mínimo entre trocas de plano", val: "90 dias" },
];

/* ── avaliações ─────────────────────────────────────────────── */

export const REVIEW_TABS = ["Denúncias", "Panorama"] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];

export type Report = {
  id: string;
  est: string;
  city: string;
  reason: string;
  rating: number;
  wait: string;
  late: boolean;
  text: string;
  author: string;
  authorDate: string;
  service: string;
  pro: string;
  apptDate: string;
  value: string;
  authorReviews: number;
  authorAvg: string;
  authorRemoved: number;
  justification: string;
  estAvg: number;
  estTotal: number;
  estReports: number;
};

export const REPORTS: Report[] = [
  {
    id: "r1",
    est: "Barbearia Corte Reto",
    city: "São Paulo",
    reason: "Conteúdo ofensivo",
    rating: 1,
    wait: "3d 6h",
    late: true,
    text: "Atendimento horrível, o barbeiro é um incompetente e não sabe o que faz. Lugar sujo, cheio de gente mal-educada. Não voltem nunca, é dinheiro jogado no lixo. Vergonha de profissional.",
    author: "Rogério Tavares",
    authorDate: "28 ago 2026, 19:14",
    service: "Corte + barba",
    pro: "Wesley Damasceno",
    apptDate: "27 ago 2026, 15:30",
    value: "R$ 72,00",
    authorReviews: 12,
    authorAvg: "1,8",
    authorRemoved: 1,
    justification:
      "A avaliação ataca pessoalmente o profissional e faz afirmação falsa sobre higiene do espaço. O cliente chegou 25 minutos atrasado e não quis remarcar.",
    estAvg: 4.6,
    estTotal: 318,
    estReports: 2,
  },
  {
    id: "r2",
    est: "Studio Hair Lorena",
    city: "São Paulo",
    reason: "Dado pessoal exposto",
    rating: 2,
    wait: "1d 22h",
    late: true,
    text: "Não recomendo. A dona Lorena atende no telefone dela mesma, 11 98221-7740, e desmarcou meu horário em cima da hora sem avisar direito.",
    author: "Camila Foscarini",
    authorDate: "30 ago 2026, 08:40",
    service: "Escova",
    pro: "Lorena Prado",
    apptDate: "29 ago 2026, 10:00",
    value: "R$ 65,00",
    authorReviews: 9,
    authorAvg: "4,1",
    authorRemoved: 0,
    justification:
      "O texto publica meu telefone pessoal completo, que não é o número comercial cadastrado no app.",
    estAvg: 4.2,
    estTotal: 96,
    estReports: 1,
  },
  {
    id: "r3",
    est: "Petshop Quatro Patas",
    city: "Belo Horizonte",
    reason: "Não é sobre este estabelecimento",
    rating: 1,
    wait: "19h",
    late: false,
    text: "Pedi banho e tosa e entregaram meu carro riscado. Estacionamento péssimo, funcionário sumiu com a chave.",
    author: "Anderson Muniz",
    authorDate: "31 ago 2026, 07:22",
    service: "Banho",
    pro: "Cristiane Bueno",
    apptDate: "30 ago 2026, 09:00",
    value: "R$ 58,00",
    authorReviews: 6,
    authorAvg: "3,7",
    authorRemoved: 0,
    justification:
      "Não temos estacionamento e nunca recebemos veículo de cliente. A reclamação parece ser de outro estabelecimento da mesma rua.",
    estAvg: 4.8,
    estTotal: 174,
    estReports: 0,
  },
  {
    id: "r4",
    est: "Espaço Zen Massagens",
    city: "Goiânia",
    reason: "Retaliação injusta",
    rating: 1,
    wait: "11h",
    late: false,
    text: "Cobraram taxa de cancelamento mesmo eu avisando. Serviço nem avalio, é o atendimento que é ruim.",
    author: "Diego Vasconcelos",
    authorDate: "31 ago 2026, 15:05",
    service: "Massagem relaxante",
    pro: "Tatiane Rocha",
    apptDate: "29 ago 2026, 18:00",
    value: "R$ 140,00",
    authorReviews: 21,
    authorAvg: "2,4",
    authorRemoved: 0,
    justification:
      "O cliente avisou 40 minutos antes, fora da janela de 4 horas prevista na política do app. A nota mínima veio depois da cobrança da taxa.",
    estAvg: 4.4,
    estTotal: 133,
    estReports: 4,
  },
  {
    id: "r5",
    est: "Odonto Vida Plena",
    city: "Campinas",
    reason: "Conteúdo ofensivo",
    rating: 2,
    wait: "4h",
    late: false,
    text: "Demorou 50 minutos além do horário marcado e ninguém avisou nada. Recepção despreparada.",
    author: "Priscila Amorim",
    authorDate: "31 ago 2026, 21:48",
    service: "Limpeza",
    pro: "Dr. Fábio Andrade",
    apptDate: "31 ago 2026, 14:00",
    value: "R$ 180,00",
    authorReviews: 44,
    authorAvg: "4,7",
    authorRemoved: 0,
    justification: "A cliente foi atendida no mesmo dia e o atraso foi de 20 minutos, não 50.",
    estAvg: 4.7,
    estTotal: 207,
    estReports: 1,
  },
];

export const MOTIVES_KEEP = [
  "Avaliação legítima — crítica dentro da política",
  "Denúncia sem fundamento",
  "Insatisfação real com o serviço prestado",
  "Não se enquadra em nenhum critério de remoção",
];

export const MOTIVES_REMOVE = [
  "Conteúdo ofensivo ou ataque pessoal",
  "Dado pessoal exposto",
  "Não se refere a este estabelecimento",
  "Retaliação por cobrança prevista em política",
  "Conteúdo comercial ou spam",
];

export type Panorama = {
  id: string;
  name: string;
  city: string;
  avg: number;
  d: number;
  total: number;
  month: number;
  rep: number;
};

export const PANORAMA: Panorama[] = [
  { id: "p1", name: "Espaço Zen Massagens", city: "Goiânia", avg: 4.4, d: -0.6, total: 133, month: 18, rep: 4 },
  { id: "p2", name: "Studio Hair Lorena", city: "São Paulo", avg: 4.2, d: -0.5, total: 96, month: 6, rep: 1 },
  { id: "p3", name: "Clínica Pele Viva", city: "Curitiba", avg: 3.9, d: -0.4, total: 64, month: 4, rep: 0 },
  { id: "p4", name: "Barbearia Corte Reto", city: "São Paulo", avg: 4.6, d: -0.1, total: 318, month: 41, rep: 2 },
  { id: "p5", name: "Odonto Vida Plena", city: "Campinas", avg: 4.7, d: 0.1, total: 207, month: 27, rep: 1 },
  { id: "p6", name: "Petshop Quatro Patas", city: "Belo Horizonte", avg: 4.8, d: 0.2, total: 174, month: 22, rep: 0 },
  { id: "p7", name: "Salão Ateliê Vera", city: "Campinas", avg: 4.9, d: 0.1, total: 288, month: 34, rep: 0 },
  { id: "p8", name: "Derma Center Sul", city: "Florianópolis", avg: 4.3, d: 0.0, total: 11, month: 0, rep: 0 },
  { id: "p9", name: "Nail Bar Aurora", city: "São Paulo", avg: 4.8, d: 0.0, total: 9, month: 2, rep: 0 },
];

export const RECENT_REVIEWS: Record<string, { r: number; who: string; when: string; t: string }[]> = {
  p1: [
    { r: 1, who: "Diego Vasconcelos", when: "31 ago", t: "Cobraram taxa de cancelamento mesmo eu avisando." },
    { r: 2, who: "Larissa Bento", when: "29 ago", t: "Chegou atrasada e cortou 15 minutos da sessão." },
    { r: 2, who: "Paulo Ivo Ramos", when: "26 ago", t: "Sala abafada, ar-condicionado quebrado há semanas." },
    { r: 5, who: "Sueli Andrade", when: "24 ago", t: "Massagem excelente, saí renovada." },
  ],
  p2: [
    { r: 2, who: "Camila Foscarini", when: "30 ago", t: "Desmarcou meu horário em cima da hora." },
    { r: 3, who: "Renata Sposito", when: "27 ago", t: "Escova boa, mas esperei 40 minutos." },
    { r: 5, who: "Elaine Prado", when: "22 ago", t: "Sempre saio satisfeita, atendimento atencioso." },
  ],
  p4: [
    { r: 1, who: "Rogério Tavares", when: "28 ago", t: "Atendimento horrível, o barbeiro é um incompetente..." },
    { r: 5, who: "Marcos Vinícius Sá", when: "28 ago", t: "Melhor corte do bairro, sem espera." },
    { r: 5, who: "Tiago Ferrarini", when: "27 ago", t: "Pontual e caprichoso na barba." },
    { r: 4, who: "Ivan Cordeiro", when: "26 ago", t: "Bom, só achei o preço um pouco alto." },
  ],
};

/* ── formatação ─────────────────────────────────────────────── */

/** Uma casa decimal com vírgula, como no canvas. */
export const decimal = (n: number) => n.toFixed(1).replace(".", ",");

/** Sinal tipográfico: menos de verdade, não hífen. */
export const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + decimal(Math.abs(n));

/** Cinco células preenchidas até `n`. */
export const stars = (n: number) => Array.from({ length: 5 }, (_, i) => i < n);
