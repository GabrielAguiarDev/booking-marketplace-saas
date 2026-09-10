/**
 * Formatação que só o app do estabelecimento precisa.
 *
 * O que os dois apps escrevem igual — dinheiro, hora, duração, data — está em
 * `@vez/mobile-kit/format`. O que está aqui é o vocabulário de quem opera o
 * dia: cronômetro correndo, espera em minutos, faixa de funcionamento.
 */

const DECIMAL = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const DECIMAL_CENTS = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Só o número, sem "R$" — o bloco do cabeçalho já tem o símbolo no rótulo.
 *
 * Não dá para tirar o prefixo de `money()` com `replace("R$ ", "")`: o
 * `Intl.NumberFormat` separa símbolo e número com espaço estreito (U+00A0), não
 * com o espaço comum. O replace falharia em silêncio e a tela mostraria
 * "R$ 1.480" embaixo do rótulo "R$ HOJE".
 */
export function moneyPlain(cents: number): string {
  return cents % 100 === 0
    ? DECIMAL.format(Math.round(cents / 100))
    : DECIMAL_CENTS.format(cents / 100);
}

/** "07:12" — cronômetro de atendimento e de espera na fila. */
export function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** "18min" / "1h05" — espera média e folga do dia. */
export function minutesLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe}min`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

/** Segundos decorridos desde um instante ISO. Nunca negativo. */
export function secondsSince(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
}

const WEEKDAY_LONG = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export function weekdayLong(weekday: number): string {
  return WEEKDAY_LONG[weekday] ?? "";
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export function monthName(month: number): string {
  return MONTHS[month] ?? "";
}

/** "SEG 31 AGO" — a linha mono do cabeçalho de Hoje. */
export function headerDate(date: Date): string {
  const weekdays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  const months = [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ];
  return `${weekdays[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

/** "Seg, 31 de agosto" — título do dia na Agenda. */
export function longDate(date: Date): string {
  return `${WEEKDAY_LONG[date.getDay()]?.slice(0, 3)}, ${date.getDate()} de ${monthName(date.getMonth())}`;
}

/** `time` do Postgres ("09:00:00") vira "09:00". */
export function clockFromTime(value: string): string {
  return value.slice(0, 5);
}
