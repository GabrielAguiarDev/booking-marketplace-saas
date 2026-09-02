/**
 * Formatação para exibição.
 *
 * Tudo em pt-BR e no fuso do aparelho. Preço vive em centavos no banco — inteiro
 * não acumula erro de ponto flutuante, e "R$ 18,00" nunca vira "R$ 17,999999".
 */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(cents: number): string {
  return BRL.format(cents / 100);
}

/** "R$ 180" quando é redondo, "R$ 55,50" quando não é — como o design escreve. */
export function moneyShort(cents: number): string {
  return cents % 100 === 0 ? `R$ ${Math.round(cents / 100)}` : money(cents);
}

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function weekdayShort(date: Date): string {
  return WEEKDAYS[date.getDay()]!;
}

export function dayNumber(date: Date): string {
  return String(date.getDate()).padStart(2, "0");
}

/** "15:20" */
export function hourMinute(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** "QUI 04 · 15:20" — o rótulo que Horário, Confirmar e Avaliação repetem. */
export function slotLabel(iso: string): string {
  const date = new Date(iso);
  return `${weekdayShort(date)} ${dayNumber(date)} · ${hourMinute(date)}`;
}

/** "40 MIN" / "1H20" */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} MIN`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}H` : `${hours}H${String(rest).padStart(2, "0")}`;
}

/** "1,2 KM" a partir de coordenadas. Nulo quando falta alguma ponta. */
export function distanceLabel(
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number | null; longitude: number | null },
): string | null {
  if (!from || to.latitude === null || to.longitude === null) return null;

  // Haversine. A Terra não é esfera, mas o erro disso a 5 km é de metros — e o
  // usuário está decidindo se vai a pé, não navegando.
  const R = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return km < 1 ? `${Math.round(km * 1000)} M` : `${km.toFixed(1).replace(".", ",")} KM`;
}

/** Data local no formato que `available_slots` espera (YYYY-MM-DD). */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** "há 2 dias", "há 3 semanas" — usado nas avaliações. */
export function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "HOJE";
  if (days === 1) return "ONTEM";
  if (days < 7) return `HÁ ${days} DIAS`;
  if (days < 30) return `HÁ ${Math.floor(days / 7)} SEM`;
  if (days < 365) return `HÁ ${Math.floor(days / 30)} MESES`;
  return `HÁ ${Math.floor(days / 365)} ANOS`;
}
