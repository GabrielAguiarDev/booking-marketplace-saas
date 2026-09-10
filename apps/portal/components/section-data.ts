/** Conteúdo das seções "genéricas" do canvas — as que são montadas por blocos. */

import {
  AMBER,
  AMBER_DARK,
  AMBER_LINE,
  AMBER_SOFT,
  CORAL,
  FAINT,
  GREEN,
  GREEN_DARK,
  INK,
  INK_SOFT,
  LINE_DARK,
  LINE_STRONG,
  MONO,
  MUTED,
  MUTED_SOFT,
  RED,
  SANS,
  SURFACE,
  SURFACE_2,
  SURFACE_5,
} from "./tokens";
import { HOUR_RULER, type SectionId } from "./data";

export type Align = "left" | "right";

export type Cell = {
  v: string;
  a: Align;
  ff: string;
  fs: string;
  w: string;
  fg: string;
  sub: string;
  subFf: string;
  bar: { pct: number; c: string } | null;
};

export type Chip = { label: string; active: boolean; radius: string };

export type Kpi = { label: string; value: string; delta: string; deltaFg: string; note: string };

export type ListItem = {
  label: string;
  desc: string;
  value?: string;
  valueFg?: string;
  toggle?: boolean;
  on?: boolean;
};

export type TeamCard = {
  initial?: string;
  name: string;
  role: string;
  access?: string;
  accessFg?: string;
  dashed?: boolean;
  stats?: { k: string; v: string; fg: string }[];
  tags?: string[];
  cta?: string;
  placeholder?: string;
};

export type ShiftCell = { range: string; note: string; bg: string; bd: string; fg: string };

export type Step = {
  n: string;
  title: string;
  desc: string;
  empty?: string;
  cta: string;
  done: boolean;
};

export type Block =
  | { kind: "kpis"; gc: string; items: Kpi[] }
  | { kind: "chips"; chips: Chip[]; note: string; cta?: string }
  | {
      kind: "table";
      title?: string;
      sub?: string;
      gc: string;
      cols: { t: string; a: Align }[];
      rows: Cell[][];
    }
  | { kind: "list"; title: string; sub?: string; items: ListItem[] }
  | { kind: "cards"; items: TeamCard[] }
  | {
      kind: "schedule";
      title: string;
      legend: { c: string; label: string }[];
      days: string[];
      rows: { name: string; days: ShiftCell[] }[];
    }
  | {
      kind: "profile";
      photos: string[];
      fields: { label: string; value: string }[];
      colors: string[];
      current: string;
      slots: string[];
    }
  | { kind: "checklist"; title: string; sub: string; progress: string; steps: Step[] }
  | {
      kind: "chart";
      title: string;
      sub: string;
      bars: { h: number; c: string; t: string }[];
      axis: string[];
    }
  | {
      kind: "layers";
      title: string;
      sub: string;
      ruler: string[];
      layers: { label: string; note: string; labelFg: string; h: number; blocks: string[] }[];
      slots: string[];
    };

function cell(v: string, o: Partial<Cell> = {}): Cell {
  return {
    v,
    a: "left",
    ff: SANS,
    fs: "13px",
    w: "500",
    fg: INK,
    sub: "",
    subFf: SANS,
    bar: null,
    ...o,
  };
}

function num(v: string, o: Partial<Cell> = {}): Cell {
  return cell(v, { a: "right", ff: MONO, fs: "12.5px", ...o });
}

const chip = (label: string, active: boolean, radius = "20px"): Chip => ({ label, active, radius });

const kpi = (label: string, value: string, delta: string, deltaFg: string, note: string): Kpi => ({
  label,
  value,
  delta,
  deltaFg,
  note,
});

const CUSTOMER_ROWS: string[][] = [
  [
    "Marcos Vieira",
    "cliente desde 2024",
    "(11) 98812-4471",
    "12",
    "18",
    "12 ago 2026",
    "R$ 1.420",
    "0",
  ],
  [
    "Ana Lúcia Prado",
    "assina o combo mensal",
    "(11) 99730-2210",
    "19",
    "26",
    "29 ago 2026",
    "R$ 2.680",
    "1",
  ],
  ["Henrique Paz", "2 faltas recentes", "(11) 97441-8865", "5", "9", "03 jul 2026", "R$ 480", "2"],
  ["Caio Bertoldo", "prefere o Léo", "(11) 98115-9032", "11", "14", "08 set 2026", "R$ 990", "0"],
  [
    "Diego Salles",
    "primeira visita hoje",
    "(11) 96620-1177",
    "1",
    "1",
    "08 set 2026",
    "R$ 55",
    "0",
  ],
  [
    "Rui Antunes",
    "vem de dois em dois meses",
    "(11) 99012-4488",
    "6",
    "7",
    "19 jun 2026",
    "R$ 560",
    "1",
  ],
  [
    "Tiago Ramos",
    "sempre paga pelo app",
    "(11) 98330-7742",
    "17",
    "21",
    "30 ago 2026",
    "R$ 3.150",
    "0",
  ],
  ["Everton Lima", "só barba", "(11) 97788-0091", "10", "12", "08 set 2026", "R$ 540", "0"],
  [
    "Jonas Bonfim",
    "indicou 3 amigos",
    "(11) 96633-1200",
    "13",
    "16",
    "05 set 2026",
    "R$ 1.180",
    "0",
  ],
  [
    "Nelson Castro",
    "não volta desde março",
    "(11) 98844-2091",
    "2",
    "4",
    "14 mar 2026",
    "R$ 260",
    "1",
  ],
];

const HAIRCUT_ROWS: string[][] = [
  [
    "Corte social",
    "máquina e tesoura, sem barba",
    "R$ 55",
    "30min",
    "Bruno · Léo · Sérgio",
    "ativo",
  ],
  ["Corte + barba", "o mais vendido da casa", "R$ 90", "50min", "Bruno · Léo", "ativo"],
  ["Barba na navalha", "toalha quente e balm", "R$ 45", "30min", "Bruno · Sérgio", "ativo"],
  ["Máquina", "um comprimento só", "R$ 35", "20min", "todos", "ativo"],
  ["Pezinho", "retoque entre cortes", "R$ 20", "15min", "todos", "ativo"],
  ["Corte infantil", "até 10 anos", "R$ 45", "30min", "Léo", "pausado"],
];

const COLOR_ROWS: string[][] = [
  ["Platinado", "descoloração e matização", "R$ 210", "1h40", "Ana", "ativo"],
  ["Luzes", "papel alumínio", "R$ 180", "1h30", "Ana", "ativo"],
  ["Coloração completa", "cobertura de brancos", "R$ 150", "1h20", "Ana · Léo", "ativo"],
  ["Matização", "manutenção do loiro", "R$ 90", "40min", "Ana", "ativo"],
  ["Relaxamento", "alisamento sem formol", "R$ 220", "2h", "Ana", "desativado"],
];

const at = (row: string[], i: number) => row[i] ?? "";

function serviceRows(rows: string[][], pausedFg: string): Cell[][] {
  return rows.map((r) => [
    cell(at(r, 0), { w: "600", sub: at(r, 1) }),
    num(at(r, 2), { fs: "13.5px", w: "600" }),
    num(at(r, 3), { fg: MUTED }),
    cell(at(r, 4), { ff: MONO, fs: "11.5px", fg: MUTED }),
    cell(at(r, 5), {
      a: "right",
      w: "600",
      fs: "12px",
      fg: at(r, 5) === "ativo" ? GREEN : pausedFg,
    }),
  ]);
}

const SHIFT_STYLE = {
  on: { bg: SURFACE_2, bd: LINE_STRONG, fg: INK_SOFT },
  off: { bg: "#FAFAFB", bd: LINE_DARK, fg: FAINT },
  half: { bg: AMBER_SOFT, bd: AMBER_LINE, fg: AMBER_DARK },
  away: { bg: "#FFF1ED", bd: "#FFCDC0", fg: "#D9451F" },
} as const;

const shift = (range: string, note: string, type: keyof typeof SHIFT_STYLE): ShiftCell => ({
  range,
  note,
  ...SHIFT_STYLE[type],
});

const BOOKED = [4, 5, 6, 10, 11, 14, 15, 18, 19, 20];

/** Serviço criado nesta sessão pelo "Novo serviço" — entra na tabela da categoria. */
export type AddedService = { category: "haircut" | "color"; row: string[] };

export function sectionBlocks(
  section: SectionId,
  brandColor: string,
  added: AddedService[] = [],
): Block[] {
  if (section === "customers") {
    return [
      {
        kind: "chips",
        chips: [
          chip("Todos", true),
          chip("Não voltam há 90 dias", false),
          chip("Maiores gastos", false),
          chip("Mais faltas", false),
        ],
        note: "412 clientes · 38 novos em agosto",
        cta: "Exportar CSV",
      },
      {
        kind: "table",
        gc: "1.7fr 1.1fr .9fr .9fr 1.1fr 1fr .8fr",
        cols: [
          { t: "CLIENTE ↑", a: "left" },
          { t: "CONTATO", a: "left" },
          { t: "VISITAS 12M", a: "right" },
          { t: "ATEND. TOTAL", a: "right" },
          { t: "ÚLTIMO ATENDIMENTO", a: "right" },
          { t: "ACUMULADO", a: "right" },
          { t: "FALTAS", a: "right" },
        ],
        rows: CUSTOMER_ROWS.map((c) => {
          const last = at(c, 5);
          const misses = at(c, 7);
          return [
            cell(at(c, 0), { w: "600", sub: at(c, 1) }),
            cell(at(c, 2), { ff: MONO, fs: "12px", fg: MUTED }),
            num(at(c, 3), { w: "600", fs: "13.5px" }),
            num(at(c, 4), { fg: MUTED }),
            num(last, { fg: last.includes("mar") || last.includes("jun") ? AMBER : INK }),
            num(at(c, 6), { w: "600" }),
            num(misses, { fg: misses === "2" ? RED : misses === "1" ? AMBER : MUTED }),
          ];
        }),
      },
    ];
  }

  if (section === "services") {
    const cols = [
      { t: "SERVIÇO", a: "left" as Align },
      { t: "PREÇO", a: "right" as Align },
      { t: "DURAÇÃO", a: "right" as Align },
      { t: "QUEM EXECUTA", a: "left" as Align },
      { t: "SITUAÇÃO", a: "right" as Align },
    ];
    return [
      {
        kind: "chips",
        chips: [
          chip("3 selecionados", true, "8px"),
          chip("Reajustar preço", false, "8px"),
          chip("Ativar", false, "8px"),
          chip("Desativar", false, "8px"),
        ],
        note: "14 serviços · ticket médio R$ 74",
        cta: "Novo serviço",
      },
      {
        kind: "table",
        title: "Cortes e barba",
        sub: "6 serviços · ticket médio R$ 68",
        gc: "2.2fr .8fr .9fr 1.4fr .9fr",
        cols,
        rows: serviceRows(
          HAIRCUT_ROWS.concat(added.filter((a) => a.category === "haircut").map((a) => a.row)),
          AMBER,
        ),
      },
      {
        kind: "table",
        title: "Coloração e química",
        sub: "5 serviços · ticket médio R$ 186",
        gc: "2.2fr .8fr .9fr 1.4fr .9fr",
        cols,
        rows: serviceRows(
          COLOR_ROWS.concat(added.filter((a) => a.category === "color").map((a) => a.row)),
          MUTED,
        ),
      },
    ];
  }

  if (section === "team") {
    return [
      {
        kind: "cards",
        items: [
          {
            initial: "B",
            name: "Bruno Salvador",
            role: "Barbeiro · sócio",
            access: "Acesso total",
            accessFg: INK,
            stats: [
              { k: "horas na semana", v: "38h", fg: INK },
              { k: "ocupação", v: "91%", fg: GREEN_DARK },
              { k: "faturou no mês", v: "R$ 9.240", fg: INK },
            ],
            tags: ["Corte social", "Corte + barba", "Barba na navalha", "Máquina"],
          },
          {
            initial: "L",
            name: "Léo Ferraz",
            role: "Barbeiro",
            access: "Só a própria agenda",
            accessFg: MUTED,
            stats: [
              { k: "horas na semana", v: "36h", fg: INK },
              { k: "ocupação", v: "74%", fg: INK },
              { k: "faturou no mês", v: "R$ 6.810", fg: INK },
            ],
            tags: ["Corte social", "Corte + barba", "Corte infantil", "Coloração completa"],
          },
          {
            initial: "A",
            name: "Ana Rocha",
            role: "Cabeleireira · química",
            access: "Agenda e clientes",
            accessFg: MUTED,
            stats: [
              { k: "horas na semana", v: "30h", fg: INK },
              { k: "ocupação", v: "68%", fg: AMBER },
              { k: "faturou no mês", v: "R$ 7.520", fg: INK },
            ],
            tags: ["Platinado", "Luzes", "Coloração completa", "Matização"],
          },
          {
            initial: "S",
            name: "Sérgio Alcântara",
            role: "Barbeiro · meio período",
            access: "Só a própria agenda",
            accessFg: MUTED,
            stats: [
              { k: "horas na semana", v: "20h", fg: INK },
              { k: "ocupação", v: "52%", fg: AMBER },
              { k: "faturou no mês", v: "R$ 3.150", fg: INK },
            ],
            tags: ["Corte social", "Barba na navalha", "Pezinho"],
          },
          {
            name: "Convidar profissional",
            role: "Ele recebe um e-mail, cria a senha e já aparece na agenda. Começa vendo só a própria agenda.",
            dashed: true,
            cta: "Enviar convite",
            placeholder: "email@exemplo.com",
          },
        ],
      },
    ];
  }

  if (section === "hours") {
    const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const ranges = [
      "09:00 — 20:00",
      "09:00 — 20:00",
      "09:00 — 20:00",
      "09:00 — 21:00",
      "09:00 — 21:00",
      "08:00 — 18:00",
      "fechado",
    ];
    const layerBlocks = (paint: (i: number) => string) =>
      Array.from({ length: 24 }, (_, i) => paint(i));
    return [
      {
        kind: "list",
        title: "Funcionamento do estabelecimento",
        sub: "Ninguém consegue agendar fora destes horários.",
        items: days.map((day, i) => ({
          label: day,
          desc:
            i === 6
              ? "Fechado. Nem fila, nem agendamento."
              : "Intervalo de almoço 12:00 — 13:00 fica bloqueado automaticamente.",
          value: ranges[i] ?? "",
          valueFg: i === 6 ? FAINT : INK,
          toggle: true,
          on: i !== 6,
        })),
      },
      {
        kind: "list",
        title: "Intervalo entre atendimentos",
        sub: "Tempo de respiro para limpar a estação e receber o próximo.",
        items: [
          {
            label: "Buffer padrão",
            desc: "Aplica a todos os serviços. Dá para mudar serviço por serviço.",
            value: "10 minutos",
            valueFg: INK,
          },
        ],
      },
      {
        kind: "schedule",
        title: "Escala da equipe, semana de 7 a 12 de setembro",
        legend: [
          { c: LINE_STRONG, label: "trabalha" },
          { c: "#FAFAFB", label: "folga" },
          { c: AMBER_LINE, label: "meio período" },
          { c: "#FFCDC0", label: "férias ou feriado" },
        ],
        days: ["Seg 07", "Ter 08", "Qua 09", "Qui 10", "Sex 11", "Sáb 12"],
        rows: [
          {
            name: "Bruno",
            days: [
              shift("09—20", "", "on"),
              shift("09—20", "", "on"),
              shift("09—20", "", "on"),
              shift("09—21", "", "on"),
              shift("09—21", "", "on"),
              shift("08—18", "", "on"),
            ],
          },
          {
            name: "Léo",
            days: [
              shift("—", "folga", "off"),
              shift("09—20", "", "on"),
              shift("09—20", "", "on"),
              shift("09—21", "", "on"),
              shift("09—21", "", "on"),
              shift("08—18", "", "on"),
            ],
          },
          {
            name: "Ana",
            days: [
              shift("13—20", "meio", "half"),
              shift("09—20", "", "on"),
              shift("—", "férias", "away"),
              shift("—", "férias", "away"),
              shift("—", "férias", "away"),
              shift("—", "férias", "away"),
            ],
          },
          {
            name: "Sérgio",
            days: [
              shift("14—20", "meio", "half"),
              shift("14—20", "meio", "half"),
              shift("—", "folga", "off"),
              shift("14—21", "meio", "half"),
              shift("14—21", "meio", "half"),
              shift("08—14", "meio", "half"),
            ],
          },
        ],
      },
      {
        kind: "layers",
        title: "O que o cliente vê como vaga",
        sub: "Funcionamento, menos quem não está na escala, menos o que já está agendado. Bruno, quarta 9.",
        ruler: HOUR_RULER,
        layers: [
          {
            label: "Funcionamento",
            note: "09:00 — 20:00",
            labelFg: MUTED,
            h: 16,
            blocks: layerBlocks((i) => (i < 2 ? SURFACE_2 : LINE_DARK)),
          },
          {
            label: "Escala do Bruno",
            note: "integral, almoço 12h",
            labelFg: MUTED,
            h: 16,
            blocks: layerBlocks((i) => (i < 2 || i === 8 || i === 9 ? SURFACE_2 : "#B8BBBE")),
          },
          {
            label: "Já agendado",
            note: "7 atendimentos",
            labelFg: MUTED,
            h: 16,
            blocks: layerBlocks((i) => (BOOKED.includes(i) ? MUTED_SOFT : SURFACE_2)),
          },
          {
            label: "Sobra para o cliente",
            note: "9 vagas de 30min",
            labelFg: CORAL,
            h: 24,
            blocks: layerBlocks((i) =>
              i >= 2 && i !== 8 && i !== 9 && !BOOKED.includes(i) ? CORAL : SURFACE,
            ),
          },
        ],
        slots: ["09:30", "10:00", "11:30", "13:30", "14:00", "16:30", "17:00", "18:30", "19:00"],
      },
    ];
  }

  if (section === "finance") {
    const days = Array.from({ length: 31 }, (_, i) => {
      const dow = (i + 1) % 7;
      const base = dow === 0 ? 8 : dow === 6 ? 122 : dow === 5 ? 108 : 70 + ((i * 17) % 30);
      return {
        h: Math.round(base * 1.15),
        c: dow === 0 ? SURFACE_5 : dow >= 5 ? CORAL : "#C4C6C9",
        t: `dia ${i + 1} · R$ ${base * 14}`,
      };
    });
    return [
      {
        kind: "chips",
        chips: [
          chip("Semana", false, "8px"),
          chip("Mês", true, "8px"),
          chip("Trimestre", false, "8px"),
          chip("Ano", false, "8px"),
        ],
        note: "01 ago — 31 ago 2026 · comparado com julho",
        cta: "Exportar CSV",
      },
      {
        kind: "kpis",
        gc: "repeat(4,minmax(0,1fr))",
        items: [
          kpi("Faturamento do mês", "R$ 38.720", "+14,2%", GREEN, "julho: R$ 33.910"),
          kpi("Ticket médio", "R$ 74", "+R$ 6", GREEN, "523 atendimentos"),
          kpi("Recebido pelo app", "R$ 12.480", "32%", MUTED, "do faturamento total"),
          kpi("A caminho da conta", "R$ 2.910", "cai 11/09", AMBER, "repasse em até 2 dias úteis"),
        ],
      },
      {
        kind: "chart",
        title: "Faturamento dia a dia",
        sub: "coral = sexta e sábado, os dois dias que carregam o mês",
        bars: days,
        axis: ["01", "07", "14", "21", "28", "31"],
      },
      {
        kind: "table",
        title: "Desempenho por profissional",
        sub: "agosto de 2026",
        gc: "1.7fr .8fr .9fr 1.1fr 1fr",
        cols: [
          { t: "PROFISSIONAL", a: "left" },
          { t: "ATEND.", a: "right" },
          { t: "TICKET", a: "right" },
          { t: "FATUROU", a: "right" },
          { t: "OCUPAÇÃO", a: "right" },
        ],
        rows: [
          ["Bruno Salvador", "178", "R$ 74", "R$ 13.170", "91%"],
          ["Ana Rocha", "61", "R$ 168", "R$ 10.248", "68%"],
          ["Léo Ferraz", "149", "R$ 63", "R$ 9.387", "74%"],
          ["Sérgio Alcântara", "135", "R$ 44", "R$ 5.915", "52%"],
        ].map((r) => {
          const rate = parseInt(at(r, 4), 10);
          return [
            cell(at(r, 0), { w: "600" }),
            num(at(r, 1)),
            num(at(r, 2)),
            num(at(r, 3), { w: "600", fs: "13.5px" }),
            num(at(r, 4), { fg: rate > 80 ? GREEN : rate < 60 ? AMBER : INK }),
          ];
        }),
      },
      {
        kind: "table",
        title: "Serviços mais vendidos",
        sub: "e o quanto cada um pesa no faturamento",
        gc: "2fr .8fr 1fr 1fr 1.6fr",
        cols: [
          { t: "SERVIÇO", a: "left" },
          { t: "VEZES", a: "right" },
          { t: "FATUROU", a: "right" },
          { t: "% DO TOTAL", a: "right" },
          { t: "", a: "right" },
        ],
        rows: (
          [
            ["Corte + barba", "201", "R$ 18.090", "46,7%", 47],
            ["Corte social", "166", "R$ 9.130", "23,6%", 24],
            ["Platinado", "38", "R$ 7.980", "20,6%", 21],
            ["Barba na navalha", "72", "R$ 3.240", "8,4%", 8],
          ] as [string, string, string, string, number][]
        ).map((r) => [
          cell(r[0], { w: "600" }),
          num(r[1]),
          num(r[2], { w: "600" }),
          num(r[3]),
          cell("", { a: "right", bar: { pct: r[4], c: MUTED_SOFT } }),
        ]),
      },
      {
        kind: "table",
        title: "Recebimentos do app",
        sub: "o que a Vez já repassou e o que ainda está a caminho",
        gc: "1.2fr 1fr 1fr 1.2fr 1.2fr",
        cols: [
          { t: "PERÍODO", a: "left" },
          { t: "BRUTO", a: "right" },
          { t: "TAXA", a: "right" },
          { t: "LÍQUIDO", a: "right" },
          { t: "SITUAÇÃO", a: "right" },
        ],
        rows: (
          [
            ["01 — 07 set", "R$ 2.910", "R$ 116", "R$ 2.794", "a caminho, cai 11/09", AMBER],
            ["25 — 31 ago", "R$ 3.180", "R$ 127", "R$ 3.053", "repassado 04/09", GREEN],
            ["18 — 24 ago", "R$ 2.740", "R$ 110", "R$ 2.630", "repassado 28/08", GREEN],
            ["11 — 17 ago", "R$ 3.410", "R$ 136", "R$ 3.274", "repassado 21/08", GREEN],
          ] as [string, string, string, string, string, string][]
        ).map((r) => [
          cell(r[0], { ff: MONO, w: "600" }),
          num(r[1]),
          num(r[2], { fg: MUTED }),
          num(r[3], { w: "600", fs: "13.5px" }),
          cell(r[4], { a: "right", w: "600", fs: "12px", fg: r[5] }),
        ]),
      },
    ];
  }

  if (section === "profile") {
    return [
      {
        kind: "profile",
        photos: ["fachada", "cadeira 1", "corte pronto", "+ adicionar"],
        fields: [
          {
            label: "Descrição que aparece no app",
            value:
              "Corte clássico e barba feita à navalha. Sem enrolação, no horário. Estamos na Vila Mariana desde 2019.",
          },
          { label: "Endereço", value: "Rua Joaquim Távora, 412 — Vila Mariana, São Paulo" },
          { label: "Telefone e WhatsApp", value: "(11) 3271-0088 · (11) 99730-2210" },
          { label: "Instagram", value: "@cortereto.sp" },
        ],
        colors: ["#1F6FEB", "#14171A", "#0E7C3E", "#8B3A1E", "#6D3AC7"],
        current: brandColor,
        slots: ["09:30", "10:00", "11:30", "13:30"],
      },
    ];
  }

  if (section === "settings") {
    return [
      {
        kind: "list",
        title: "Regras de agendamento",
        sub: "Como os pedidos de horário chegam até você.",
        items: [
          {
            label: "Aprovar cada pedido na mão",
            desc: "Nada entra na sua agenda sem você dizer sim. Se desligar, o horário é confirmado na hora.",
            toggle: true,
            on: true,
          },
          {
            label: "Antecedência mínima",
            desc: "O cliente não consegue marcar para daqui a menos de 2 horas.",
            value: "2 horas",
            valueFg: INK,
          },
          {
            label: "Cancelar sem custo até",
            desc: "Depois desse prazo, o sinal não volta.",
            value: "12 horas antes",
            valueFg: INK,
          },
          {
            label: "Pedir sinal para reservar",
            desc: "Cobrado no app na hora de marcar. Vale para serviços acima de R$ 100.",
            value: "30% · reembolsável",
            valueFg: INK,
            toggle: true,
            on: true,
          },
        ],
      },
      {
        kind: "list",
        title: "Regras de pagamento",
        sub: "Onde o dinheiro entra.",
        items: [
          {
            label: "Aceitar pagamento pelo app",
            desc: "A Vez recebe e repassa para sua conta em até 2 dias úteis, com taxa de 4%.",
            toggle: true,
            on: true,
          },
          {
            label: "Aceitar somente presencial",
            desc: "O cliente marca pelo app e paga no balcão.",
            toggle: true,
            on: false,
          },
        ],
      },
      {
        kind: "list",
        title: "Regras de fila",
        sub: "Vale para quem chega sem hora marcada.",
        items: [
          {
            label: "Usar fila neste estabelecimento",
            desc: "Sem isso, só funciona agendamento com hora marcada.",
            toggle: true,
            on: true,
          },
          {
            label: "Deixar entrar na fila antes de chegar",
            desc: "A pessoa entra pelo app de casa e vai vindo. Fica na pré-fila até confirmar chegada.",
            toggle: true,
            on: true,
          },
          {
            label: "Exigir confirmação de chegada",
            desc: "Quem entrou remotamente só assume a posição depois de confirmar que está aqui.",
            toggle: true,
            on: true,
          },
          {
            label: "QR code no balcão",
            desc: "Quem chega lê o código e entra sozinho, sem passar pelo atendente.",
            toggle: true,
            on: true,
          },
          {
            label: "Fila única ou por profissional",
            desc: "Na fila única, atende quem chegou primeiro com quem estiver livre.",
            value: "fila única",
            valueFg: INK,
          },
          {
            label: "Fechar a fila quando a espera passar de",
            desc: "Evita gente esperando uma hora e meia na porta.",
            value: "45 minutos",
            valueFg: INK,
          },
          {
            label: "Pular quem não responde à chamada",
            desc: "Depois de chamar duas vezes, a pessoa vai para o fim.",
            value: "após 2 chamadas",
            valueFg: INK,
          },
          {
            label: "Avisar o cliente por",
            desc: "Aviso quando falta pouco e quando chegar a vez.",
            value: "app e WhatsApp",
            valueFg: INK,
          },
        ],
      },
      {
        kind: "list",
        title: "Avisos que a equipe recebe",
        sub: "Cada profissional escolhe os dele no app.",
        items: [
          {
            label: "Novo pedido de horário",
            desc: "Chega para você e para os gerentes.",
            toggle: true,
            on: true,
          },
          {
            label: "Cancelamento em cima da hora",
            desc: "Menos de 4 horas antes do atendimento.",
            toggle: true,
            on: true,
          },
          {
            label: "Resumo do dia às 20h",
            desc: "Faturamento, atendimentos e faltas do dia por e-mail.",
            toggle: true,
            on: false,
          },
        ],
      },
      {
        kind: "list",
        title: "Dados do estabelecimento",
        sub: "Usados na nota e no contrato com a Vez.",
        items: [
          {
            label: "Razão social",
            desc: "Corte Reto Barbearia Ltda",
            value: "CNPJ 41.882.001/0001-16",
            valueFg: MUTED,
          },
          {
            label: "Responsável",
            desc: "Rafael Nunes · rafael@cortereto.com.br",
            value: "dono",
            valueFg: MUTED,
          },
        ],
      },
    ];
  }

  if (section === "billing") {
    return [
      {
        kind: "list",
        title: "Cobrança recusada em 05/09",
        sub: "Você continua usando a Vez normalmente até 12/09. Depois disso o perfil sai do app do cliente e a agenda fica só para leitura.",
        items: [
          {
            label: "Cartão terminado em 4471",
            desc: "O banco recusou a cobrança. Pode ser limite ou cartão vencido.",
            value: "atualizar agora",
            valueFg: RED,
          },
          {
            label: "Tentaremos de novo em 09/09",
            desc: "Se quiser, pague agora por Pix e a tentativa é cancelada.",
            value: "R$ 149,00",
            valueFg: INK,
          },
        ],
      },
      {
        kind: "kpis",
        gc: "repeat(4,minmax(0,1fr))",
        items: [
          kpi("Plano", "Profissional", "até 6 profissionais", MUTED, "mensal, sem fidelidade"),
          kpi("Mensalidade", "R$ 149", "+ 4% por venda no app", MUTED, "cobrado dia 5"),
          kpi("Próxima cobrança", "09/09", "em 1 dia", RED, "nova tentativa no cartão"),
          kpi("Cliente desde", "mar/2024", "30 meses", MUTED, "R$ 4.470 pagos até hoje"),
        ],
      },
      {
        kind: "table",
        title: "Histórico de pagamentos",
        gc: "1fr 1.6fr 1fr 1.1fr 1.2fr",
        cols: [
          { t: "DATA", a: "left" },
          { t: "DESCRIÇÃO", a: "left" },
          { t: "VALOR", a: "right" },
          { t: "FORMA", a: "right" },
          { t: "SITUAÇÃO", a: "right" },
        ],
        rows: (
          [
            ["05/09/2026", "Mensalidade setembro", "R$ 149,00", "cartão 4471", "recusado", RED],
            ["05/08/2026", "Mensalidade agosto", "R$ 149,00", "cartão 4471", "pago", GREEN],
            ["05/07/2026", "Mensalidade julho", "R$ 149,00", "cartão 4471", "pago", GREEN],
            ["05/06/2026", "Mensalidade junho", "R$ 149,00", "Pix", "pago", GREEN],
            ["05/05/2026", "Mensalidade maio", "R$ 129,00", "cartão 4471", "pago", GREEN],
          ] as [string, string, string, string, string, string][]
        ).map((r) => [
          cell(r[0], { ff: MONO }),
          cell(r[1]),
          num(r[2], { w: "600" }),
          cell(r[3], { a: "right", ff: MONO, fs: "12px", fg: MUTED }),
          cell(r[4], { a: "right", w: "600", fs: "12px", fg: r[5] }),
        ]),
      },
    ];
  }

  if (section === "onboarding") {
    return [
      {
        kind: "checklist",
        title: "Falta pouco para você aparecer no app",
        sub: "Publique o perfil e a Barbearia Corte Reto entra na busca dos clientes da sua região.",
        progress: "3 de 4",
        steps: [
          {
            n: "✓",
            title: "Cadastrar serviços",
            desc: "14 serviços em 3 categorias. Você pode ajustar preço a qualquer momento.",
            cta: "Revisar",
            done: true,
          },
          {
            n: "✓",
            title: "Montar horários",
            desc: "Funcionamento de segunda a sábado, com almoço bloqueado e buffer de 10 minutos.",
            cta: "Revisar",
            done: true,
          },
          {
            n: "✓",
            title: "Adicionar equipe",
            desc: "4 profissionais na agenda. 1 convite ainda não foi aceito.",
            cta: "Revisar",
            done: true,
          },
          {
            n: "4",
            title: "Publicar o perfil público",
            desc: "Falta a galeria de fotos. Sem foto, o perfil aparece bem abaixo na busca.",
            empty:
              "Nenhuma foto ainda. Suba de 3 a 8 fotos da fachada, do salão e de cortes prontos — é o que o cliente olha primeiro.",
            cta: "Subir fotos",
            done: false,
          },
        ],
      },
      {
        kind: "kpis",
        gc: "repeat(3,minmax(0,1fr))",
        items: [
          kpi(
            "Agenda",
            "vazia",
            "primeira semana",
            MUTED,
            "Assim que publicar, os pedidos começam a chegar aqui",
          ),
          kpi(
            "Fila",
            "desligada",
            "opcional",
            MUTED,
            "Ligue em Configurações quando quiser atender sem hora marcada",
          ),
          kpi(
            "Perfil",
            "rascunho",
            "não publicado",
            AMBER,
            "Só você vê. O cliente ainda não encontra a barbearia",
          ),
        ],
      },
    ];
  }

  return [];
}
