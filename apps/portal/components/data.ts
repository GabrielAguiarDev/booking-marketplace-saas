/**
 * Protótipo do portal: os dados abaixo são os mesmos do canvas
 * `docs/design-page/Portal Vez.dc.html`, inclusive a geração dos agendamentos
 * da agenda. Nada aqui fala com o Supabase ainda.
 */

export type SectionId =
  | "overview"
  | "agenda"
  | "queue"
  | "customers"
  | "services"
  | "team"
  | "hours"
  | "finance"
  | "profile"
  | "settings"
  | "billing"
  | "onboarding";

export const ICONS: Record<SectionId, string> = {
  overview: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  agenda: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  queue: "M4 7h16M4 12h11M4 17h6",
  customers: "M12 11a4 4 0 100-8 4 4 0 000 8M4 21c0-4 3.6-6 8-6s8 2 8 6",
  services: "M13.5 3H5v8.5l8 8L21 12zM8.5 8.5h.01",
  team: "M9 11a4 4 0 100-8 4 4 0 000 8M2 21c0-3.4 3-5.5 7-5.5s7 2.1 7 5.5M17 7.5a3 3 0 010 6M18 21c0-2 0-3.2-1-4.4",
  hours: "M12 21a9 9 0 100-18 9 9 0 000 18M12 7.5V12l3.5 2",
  finance: "M4 20h16M7.5 17V9M12 17V5M16.5 17v-6",
  profile: "M12 21a9 9 0 100-18 9 9 0 000 18M3 12h18M12 3c3 3.6 3 14.4 0 18",
  settings: "M4 7h9M17 7h3M4 17h4M12 17h8M15 4v6M8 14v6",
  billing: "M3 7h18v11H3zM3 11h18M6.5 15h3",
  onboarding: "M12 21a9 9 0 100-18 9 9 0 000 18M8.5 12.3l2.4 2.4 4.6-5.1",
};

export const ICON_PAID = "M2 5h12v7H2zM2 7.5h12M4.5 10h2.5";
export const ICON_BLOCKED = "M5 7V5.2a3 3 0 016 0V7M3.6 7h8.8v6H3.6z";

export const HEADINGS: Record<SectionId, [string, string]> = {
  overview: ["Visão geral", "terça-feira, 8 de setembro de 2026"],
  agenda: ["Agenda", "terça, 8 de setembro · 4 profissionais"],
  queue: ["Fila de espera", "aberta desde 08:00 · 5 na fila"],
  customers: ["Clientes", "412 cadastrados · 38 novos em agosto"],
  services: ["Serviços", "14 serviços em 3 categorias"],
  team: ["Equipe", "4 profissionais · 1 convite pendente"],
  hours: ["Horários", "funcionamento, escalas e exceções"],
  finance: ["Financeiro", "agosto de 2026 · comparado com julho"],
  profile: ["Perfil público", "publicado · última alteração há 6 dias"],
  settings: ["Configurações", "regras de agendamento, fila e pagamento"],
  billing: ["Plano e assinatura", "Vez Profissional · cobrança recusada"],
  onboarding: ["Primeiros passos", "3 de 4 concluídos"],
};

export const NAV_GROUPS: {
  label: string;
  items: { id: SectionId; label: string; badge?: string; critical?: boolean }[];
}[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { id: "overview", label: "Visão geral" },
      { id: "agenda", label: "Agenda" },
      { id: "queue", label: "Fila de espera", badge: "5" },
      { id: "customers", label: "Clientes" },
    ],
  },
  {
    label: "CADASTRO",
    items: [
      { id: "services", label: "Serviços" },
      { id: "team", label: "Equipe" },
      { id: "hours", label: "Horários" },
    ],
  },
  {
    label: "NEGÓCIO",
    items: [
      { id: "finance", label: "Financeiro" },
      { id: "profile", label: "Perfil público" },
      { id: "settings", label: "Configurações" },
      { id: "billing", label: "Plano e assinatura", badge: "!", critical: true },
    ],
  },
  { label: "COMEÇANDO", items: [{ id: "onboarding", label: "Primeiros passos" }] },
];

export const HOUR_RULER = ["08", "10", "12", "14", "16", "18", "20"];

export type Professional = { name: string; initial: string };

export const PROS: Professional[] = [
  { name: "Bruno", initial: "B" },
  { name: "Léo", initial: "L" },
  { name: "Ana", initial: "A" },
  { name: "Sérgio", initial: "S" },
];

const CLIENT_NAMES = [
  "Marcos Vieira",
  "Diego Salles",
  "Henrique Paz",
  "Tiago Ramos",
  "Jonas Bonfim",
  "Rui Antunes",
  "Caio Bertoldo",
  "Everton Lima",
  "Pedro Aguiar",
  "Fábio Duarte",
  "Gustavo Mota",
  "Nelson Castro",
  "Ana Lúcia Prado",
  "Sandro Beltrão",
  "Ivo Menezes",
  "Rogério Lyra",
];

/** Serviço cru usado só para gerar a grade: nome, duração em horas, preço. */
const GRID_SERVICES: [string, number, string][] = [
  ["Corte social", 1, "R$ 55"],
  ["Corte + barba", 1.5, "R$ 90"],
  ["Barba na navalha", 1, "R$ 45"],
  ["Máquina", 0.5, "R$ 35"],
  ["Pezinho", 0.5, "R$ 20"],
  ["Platinado", 2, "R$ 210"],
  ["Luzes", 1.5, "R$ 180"],
  ["Coloração completa", 1.5, "R$ 150"],
];

/** Ocupação por profissional (linha) e dia da semana (coluna). 0 = fora da escala. */
const OCCUPANCY: number[][] = [
  [86, 91, 78, 95, 96, 88],
  [62, 74, 80, 71, 90, 84],
  [55, 68, 0, 0, 0, 0],
  [48, 52, 0, 61, 58, 44],
];

export const WEEK_DAYS: { dow: string; day: string }[] = [
  { dow: "Seg", day: "07" },
  { dow: "Ter", day: "08" },
  { dow: "Qua", day: "09" },
  { dow: "Qui", day: "10" },
  { dow: "Sex", day: "11" },
  { dow: "Sáb", day: "12" },
];

/** 10 minutos de respiro entre atendimentos, na escala de 1 = 1 hora. */
export const BUFFER = 1 / 6;

export const DAY_HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];

export function occupancy(pro: number, day: number): number {
  return OCCUPANCY[pro]?.[day] ?? 0;
}

export function pro(index: number): Professional {
  return PROS[index] ?? { name: "", initial: "" };
}

export function weekDay(index: number): { dow: string; day: string } {
  return WEEK_DAYS[index] ?? { dow: "", day: "" };
}

export type Service = {
  name: string;
  dur: number;
  durLabel: string;
  price: number;
  pros: number[];
};

export const SERVICE_CATEGORIES: { name: string; items: Service[] }[] = [
  {
    name: "CORTES E BARBA",
    items: [
      { name: "Corte social", dur: 1, durLabel: "30min", price: 55, pros: [0, 1, 3] },
      { name: "Corte + barba", dur: 1.5, durLabel: "50min", price: 90, pros: [0, 1] },
      { name: "Barba na navalha", dur: 1, durLabel: "30min", price: 45, pros: [0, 3] },
      { name: "Máquina", dur: 0.5, durLabel: "20min", price: 35, pros: [0, 1, 3] },
      { name: "Pezinho", dur: 0.5, durLabel: "15min", price: 20, pros: [0, 1, 3] },
      { name: "Barba desenhada", dur: 1, durLabel: "40min", price: 65, pros: [] },
    ],
  },
  {
    name: "COLORAÇÃO E QUÍMICA",
    items: [
      { name: "Platinado", dur: 2, durLabel: "1h40", price: 210, pros: [2] },
      { name: "Luzes", dur: 1.5, durLabel: "1h30", price: 180, pros: [2] },
      { name: "Coloração completa", dur: 1.5, durLabel: "1h20", price: 150, pros: [1, 2] },
      { name: "Matização", dur: 1, durLabel: "40min", price: 90, pros: [2] },
    ],
  },
];

export function findService(name: string | null): Service | null {
  if (!name) return null;
  for (const category of SERVICE_CATEGORIES) {
    const found = category.items.find((item) => item.name === name);
    if (found) return found;
  }
  return null;
}

export function serviceCategory(name: string): string {
  for (const category of SERVICE_CATEGORIES) {
    if (category.items.some((item) => item.name === name)) {
      return category.name.charAt(0) + category.name.slice(1).toLowerCase();
    }
  }
  return "";
}

export type Customer = {
  name: string;
  phone: string;
  visits: number;
  misses: number;
  history: { date: string; service: string; value: string }[];
};

const h = (date: string, service: string, value: string) => ({ date, service, value });

export const CUSTOMERS: Customer[] = [
  {
    name: "Marcos Vieira",
    phone: "(11) 98812-4471",
    visits: 18,
    misses: 0,
    history: [
      h("12 ago", "Corte + barba", "R$ 90"),
      h("22 jul", "Corte social", "R$ 55"),
      h("28 jun", "Corte + barba", "R$ 85"),
    ],
  },
  {
    name: "Ana Lúcia Prado",
    phone: "(11) 99730-2210",
    visits: 26,
    misses: 1,
    history: [
      h("29 ago", "Luzes", "R$ 180"),
      h("01 ago", "Matização", "R$ 90"),
      h("04 jul", "Platinado", "R$ 210"),
    ],
  },
  {
    name: "Henrique Paz",
    phone: "(11) 97441-8865",
    visits: 9,
    misses: 2,
    history: [h("03 jul", "Barba na navalha", "R$ 45"), h("19 mai", "Corte social", "R$ 55")],
  },
  {
    name: "Caio Bertoldo",
    phone: "(11) 98115-9032",
    visits: 14,
    misses: 0,
    history: [h("08 set", "Corte social", "R$ 55"), h("11 ago", "Corte social", "R$ 55")],
  },
  {
    name: "Tiago Ramos",
    phone: "(11) 98330-7742",
    visits: 21,
    misses: 0,
    history: [h("30 ago", "Platinado", "R$ 210"), h("02 ago", "Matização", "R$ 90")],
  },
  {
    name: "Everton Lima",
    phone: "(11) 97788-0091",
    visits: 12,
    misses: 0,
    history: [h("08 set", "Barba na navalha", "R$ 45")],
  },
  {
    name: "Jonas Bonfim",
    phone: "(11) 96633-1200",
    visits: 16,
    misses: 0,
    history: [h("05 set", "Corte + barba", "R$ 90")],
  },
  {
    name: "Nelson Castro",
    phone: "(11) 98844-2091",
    visits: 4,
    misses: 1,
    history: [h("14 mar", "Barba na navalha", "R$ 45")],
  },
];

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("");
}

/** Estados visuais de um bloco na grade da agenda. */
export type AppointmentKind =
  | "ok"
  | "pending"
  | "conflict"
  | "paid"
  | "blocked"
  | "done"
  | "noshow";

export const KIND_STYLE: Record<
  AppointmentKind,
  { bg: string; bd: string; fg: string; icon: string | null }
> = {
  ok: { bg: "#F2F2F3", bd: "#E4E5E6", fg: "#3F4347", icon: null },
  pending: { bg: "#FFFBF0", bd: "#EFDFB0", fg: "#B07E00", icon: null },
  conflict: { bg: "#FEF3F2", bd: "#F2C7C2", fg: "#D92D20", icon: null },
  paid: { bg: "#F2F2F3", bd: "#E4E5E6", fg: "#3F4347", icon: ICON_PAID },
  blocked: { bg: "#FAFAFB", bd: "#DCDCDE", fg: "#A2A5A9", icon: ICON_BLOCKED },
  // estados que só existem depois que a equipe age sobre o bloco
  done: { bg: "#EFF8F2", bd: "#CFE8D8", fg: "#0E7C3E", icon: null },
  noshow: { bg: "#FFFBF0", bd: "#EFDFB0", fg: "#B07E00", icon: null },
};

export type Appointment = {
  start: number;
  dur: number;
  kind: AppointmentKind;
  customer: string;
  service: string;
  fresh?: boolean;
};

/** Agendamentos de um profissional num dia. Linha do tempo 08h–20h, 1 = uma hora. */
export function appointmentsOf(day: number, proIndex: number): Appointment[] {
  const pool = proIndex === 2 ? [5, 6, 7, 2] : [0, 1, 2, 3, 4, 1];
  const out: Appointment[] = [];
  let cursor = ((day + proIndex) % 3) * 0.5;
  let k = 0;
  // sexta e sábado ficam cheios de propósito (estado "dia sem vaga"); nos outros sobra folga
  const maxItems = day >= 4 ? 8 : 5;
  while (cursor < 11.5 && k < maxItems) {
    if (cursor >= 4 && cursor < 5) {
      out.push({
        start: 4,
        dur: 1,
        kind: "blocked",
        customer: "Almoço",
        service: "estação fechada",
      });
      cursor = 5;
      continue;
    }
    const service = GRID_SERVICES[pool[(day * 3 + proIndex * 2 + k) % pool.length] ?? 0];
    if (!service || cursor + service[1] > 12) break;
    const seed = day * 7 + proIndex * 5 + k * 3;
    let kind: AppointmentKind = "ok";
    if (seed % 19 === 0) kind = "conflict";
    else if (seed % 6 === 0) kind = "pending";
    else if (seed % 5 === 0) kind = "paid";
    out.push({
      start: cursor,
      dur: service[1],
      kind,
      customer: CLIENT_NAMES[(day * 5 + proIndex * 3 + k) % CLIENT_NAMES.length] ?? "",
      service: service[0],
    });
    const gaps = day >= 4 ? [0.5, 0.5, 1, 0.5] : [1, 1.5, 1, 2];
    cursor += service[1] + (gaps[(day + k) % 4] ?? 1);
    k++;
  }
  return out;
}

export type Created = {
  day: number;
  pro: number;
  start: number;
  dur: number;
  customer: string;
  service: string;
  /** Período bloqueado pela equipe: ocupa a grade, mas não é cliente. */
  blocked?: boolean;
};

export function hourLabel(t: number): string {
  const hh = 8 + Math.floor(t);
  const mm = t % 1 ? "30" : "00";
  return (hh < 10 ? `0${hh}` : `${hh}`) + ":" + mm;
}

/** Funcionamento − escala − agendado − buffer. */
export function freeSlots(
  day: number,
  proIndex: number,
  dur: number,
  created: Created[],
): number[] {
  if (!occupancy(proIndex, day)) return [];
  const busy: [number, number][] = appointmentsOf(day, proIndex).map((a) => [
    a.start,
    a.start + a.dur,
  ]);
  for (const c of created) {
    if (c.day === day && c.pro === proIndex) busy.push([c.start, c.start + c.dur]);
  }
  const out: number[] = [];
  for (let t = 1; t + dur <= 12; t += 0.5) {
    const clash = busy.some(([from, to]) => t < to + BUFFER && t + dur > from);
    if (!clash) out.push(t);
  }
  return out;
}
