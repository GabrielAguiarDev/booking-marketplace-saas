/**
 * Dado fixo do canvas `Vez Landing.dc.html` (projeto Claude Design
 * `fe25ed41-2e78-475f-b0e0-1b4cb32c37f5`).
 *
 * O canvas vendia vagas de mensalidade limitadas por cidade. A venda não vai
 * começar por cidades, então a página não fala de localidade nem de vagas: são
 * dois planos, e a loja escolhe. Preço e comissão vivem aqui até o billing
 * existir no banco.
 */

/** Mensalidade fixa, em reais. */
export const PRICE = 189;
/** Comissão por agendamento concluído, em %. */
export const COMMISSION = 6;
/** Ticket médio usado na comparação entre os planos. */
const TICKET = 60;

const whole = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const brl = (value: number) => whole.format(value);

export type PlanRow = { n: number; fixed: string; comm: string; winner: string; tie: boolean };

/** A tabela "qual sai mais barato", com o ponto de virada entre as linhas. */
export function pricing() {
  const perBooking = (TICKET * COMMISSION) / 100;
  const breakEven = Math.ceil(PRICE / perBooking);

  const rows: PlanRow[] = [20, 40, breakEven, 90, 140].map((n) => {
    const comm = n * perBooking;
    const tie = Math.abs(comm - PRICE) < perBooking / 2;
    return {
      n,
      fixed: `R$ ${brl(PRICE)}`,
      comm: `R$ ${brl(Math.round(comm))}`,
      winner: tie ? "empata" : comm < PRICE ? "comissão" : "mensalidade",
      tie,
    };
  });

  return { perBooking: cents.format(perBooking), breakEven, rows };
}

// ── maquetes ─────────────────────────────────────────────────────

/** Cor de cada profissional nas maquetes de agenda. */
export type Tone = "coral" | "ink" | "green" | "blocked" | "pending";

export type CalendarBlock = {
  col: number;
  rows: string;
  tone: Tone;
  title?: string;
  meta?: string;
};

export const TEAM = [
  { name: "Rafa", tone: "coral" },
  { name: "Dani", tone: "ink" },
  { name: "Bru", tone: "green" },
] as const;

export const WEEK_DAYS = ["seg", "ter", "qua", "qui", "sex", "sáb"];
export const WEEK_HOURS = ["09", "10", "11", "12", "13", "14", "15", "16", "17", "18"];

export const WEEK_BLOCKS: CalendarBlock[] = [
  { col: 2, rows: "1/3", tone: "coral", title: "Corte + barba", meta: "09:00 Léo" },
  { col: 2, rows: "4/6", tone: "blocked", meta: "almoço" },
  { col: 2, rows: "7/9", tone: "ink", title: "Escova", meta: "15:00 Carla" },
  { col: 3, rows: "2/4", tone: "green", title: "Manicure", meta: "10:00 Tati" },
  { col: 3, rows: "6/8", tone: "coral", title: "Corte", meta: "14:00 Ivo" },
  { col: 4, rows: "1/2", tone: "ink", title: "Retoque" },
  { col: 4, rows: "3/6", tone: "green", title: "Alongamento", meta: "11:00 Sol" },
  { col: 5, rows: "2/4", tone: "coral", title: "Corte + barba", meta: "10:00 Jonas" },
  { col: 5, rows: "7/10", tone: "ink", title: "Coloração", meta: "15:00 Rita" },
  { col: 6, rows: "4/6", tone: "green", title: "Pé e mão", meta: "12:00 Ana" },
  { col: 6, rows: "8/10", tone: "pending", title: "Novo pedido", meta: "16:30 · aprovar" },
  { col: 7, rows: "1/4", tone: "coral", title: "3 cortes seguidos", meta: "09:00–11:30" },
  { col: 7, rows: "5/8", tone: "green", title: "Fila de espera", meta: "4 na fila" },
];

export const DAY_HOURS = ["13", "14", "15", "16", "17"];

export const DAY_BLOCKS: CalendarBlock[] = [
  { col: 2, rows: "1/3", tone: "coral", title: "Corte · Léo", meta: "13:00" },
  { col: 2, rows: "4/6", tone: "pending", title: "arrastando…", meta: "16:00 → 16:30" },
  { col: 3, rows: "2/4", tone: "ink", title: "Escova · Rita", meta: "14:00" },
  { col: 4, rows: "1/4", tone: "blocked", meta: "bloqueado" },
  { col: 4, rows: "4/6", tone: "green", title: "Pé e mão", meta: "16:00 Ana" },
];

// ── texto ────────────────────────────────────────────────────────

export const PROBLEMS = [
  {
    tag: "15:00",
    text: "A cliente das três não apareceu e não avisou. Ninguém entrou no lugar dela, e a cadeira ficou parada uma hora inteira.",
  },
  {
    tag: "caderno",
    text: "A agenda está escrita à mão e só você entende. No dia da sua folga, alguém liga para perguntar se tem horário na quinta.",
  },
  {
    tag: "14 msgs",
    text: "O celular vibra no meio do corte. Você para, seca a mão, responde “amanhã às 10 pode?” e volta de onde parou.",
  },
  {
    tag: "na porta",
    text: "Alguém passou na frente, olhou pra dentro e seguiu andando, porque não tinha como saber se hoje ainda tem vaga.",
  },
];

export const FAQ = [
  {
    q: "Preciso mudar a forma como recebo dos meus clientes?",
    a: "Não. Maquininha, pix e dinheiro continuam do jeito que estão. O Vez cuida do horário. Se você quiser cobrar sinal para reduzir falta, aí sim o pagamento passa pelo app — e é você que decide isso serviço por serviço.",
  },
  {
    q: "Tem fidelidade ou multa se eu sair?",
    a: "Não tem contrato de fidelidade nem multa. Você cancela pelo próprio portal e usa até o fim do mês já pago.",
  },
  {
    q: "Já uso outro sistema de agenda. Dá pra trazer meus clientes e horários?",
    a: "Sim. Se você conseguir exportar sua lista de clientes e a agenda dos próximos dias em planilha, a gente importa para você antes de você começar. Muita gente roda os dois em paralelo por duas semanas antes de desligar o antigo, e isso é normal.",
  },
  {
    q: "Quem paga a taxa do cartão?",
    a: "Se você recebe fora do app, nenhuma taxa passa por nós. Se você optar por receber pelo app, a taxa da operadora é descontada do repasse e aparece linha por linha no extrato: valor do serviço, taxa, valor líquido. A gente não coloca nada em cima dela.",
  },
  {
    q: "Meus clientes precisam baixar o app?",
    a: "Não. Quem já é seu cliente pode agendar pelo link da sua página, no navegador, sem instalar nada. Quem chega ao balcão sem app entra na fila por você e acompanha a posição por um link no WhatsApp. O app serve principalmente para o cliente novo, que está procurando alguém por perto.",
  },
  {
    q: "Quanto tempo até eu começar a aparecer para clientes novos?",
    a: "Você aparece na busca no mesmo dia em que termina o cadastro dos serviços e horários. O volume de cliente novo depende de quanta gente já usa o app perto de você, e a gente é honesto sobre isso na conversa: no começo, o primeiro ganho é a organização da sua agenda, não a enxurrada de cliente novo.",
  },
  {
    q: "O que acontece com meus agendamentos se eu cancelar?",
    a: "Os agendamentos já marcados continuam valendo até a data, e a sua página fica no ar avisando que você não recebe mais horário pelo app. Antes de encerrar, você baixa sua lista de clientes e o histórico em planilha. Os dados são seus.",
  },
];
