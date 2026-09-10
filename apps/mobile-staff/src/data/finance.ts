import { useAsync } from "@vez/mobile-kit/async";

import { supabase } from "../../lib/supabase";

export type Period = "dia" | "semana" | "mes";

export type FinanceBar = { label: string; cents: number };

export type Finance = {
  totalCents: number;
  count: number;
  ticketCents: number;
  bars: FinanceBar[];
  previousCents: number;
  compareLabel: string;
  periodLabel: string;
  topServices: { name: string; cents: number }[];
};

type Row = { starts_at: string; price_cents: number; services: { name: string } | null };

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Início e fim do período atual e do anterior, para a comparação. */
function bounds(period: Period, now: Date) {
  const today = startOfDay(now);

  if (period === "dia") {
    return {
      from: today,
      to: shiftDays(today, 1),
      previousFrom: shiftDays(today, -1),
      previousTo: today,
      periodLabel: "DE HOJE",
      compareLabel: "Ontem",
    };
  }

  if (period === "semana") {
    // Semana corrida de sete dias terminando hoje: é o que o dono compara, não
    // a semana do calendário.
    const from = shiftDays(today, -6);
    return {
      from,
      to: shiftDays(today, 1),
      previousFrom: shiftDays(from, -7),
      previousTo: from,
      periodLabel: "DOS 7 DIAS",
      compareLabel: "7 dias anteriores",
    };
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from,
    to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    previousFrom: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    previousTo: from,
    periodLabel: "DO MÊS",
    compareLabel: "Mês anterior",
  };
}

function emptyBars(
  period: Period,
  from: Date,
  now: Date,
  dayRange: { first: number; last: number },
): FinanceBar[] {
  if (period === "dia") {
    // A faixa de horas sai do próprio dia, não de um 8h–20h fixo. Uma loja que
    // abre às 7h perderia a primeira hora do gráfico — e o total continuaria
    // certo, o que é o pior tipo de erro: a soma bate e o desenho mente.
    return Array.from({ length: dayRange.last - dayRange.first + 1 }, (_, index) => ({
      label: `${String(dayRange.first + index).padStart(2, "0")}h`,
      cents: 0,
    }));
  }
  if (period === "semana") {
    const names = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    return Array.from({ length: 7 }, (_, index) => ({
      label: names[shiftDays(from, index).getDay()] ?? "",
      cents: 0,
    }));
  }
  const weeks = Math.ceil(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() / 7);
  return Array.from({ length: weeks }, (_, index) => ({ label: `S${index + 1}`, cents: 0 }));
}

function bucketIndex(period: Period, date: Date, from: Date, firstHour: number): number {
  if (period === "dia") return date.getHours() - firstHour;
  if (period === "semana") {
    return Math.floor((startOfDay(date).getTime() - from.getTime()) / 86_400_000);
  }
  return Math.floor((date.getDate() - 1) / 7);
}

/**
 * Faturamento a partir de atendimento concluído.
 *
 * Não sai de `payments`: aquela tabela existe como esquema e nunca recebeu uma
 * linha, porque o provedor de pagamento ainda não foi escolhido. O que a loja
 * realmente faturou é a soma do preço congelado das reservas que viraram
 * `completed` — o preço combinado no ato, que é o número que ela reconhece.
 *
 * Fila de espera não entra: entrada de fila não guarda preço. É uma lacuna
 * conhecida, e a tela diz isso em vez de somar um número inventado.
 */
export function useFinance(establishmentId: string | null, period: Period) {
  return useAsync(
    `finance:${establishmentId}:${period}`,
    async () => {
      const now = new Date();
      const range = bounds(period, now);

      const [current, previous] = await Promise.all([
        supabase
          .from("appointments")
          .select("starts_at, price_cents, services(name)")
          .eq("establishment_id", establishmentId!)
          .eq("status", "completed")
          .gte("starts_at", range.from.toISOString())
          .lt("starts_at", range.to.toISOString()),
        supabase
          .from("appointments")
          .select("price_cents")
          .eq("establishment_id", establishmentId!)
          .eq("status", "completed")
          .gte("starts_at", range.previousFrom.toISOString())
          .lt("starts_at", range.previousTo.toISOString()),
      ]);

      if (current.error) throw new Error(current.error.message);
      if (previous.error) throw new Error(previous.error.message);

      const rows = (current.data ?? []) as unknown as Row[];
      const hoursPresent = rows.map((row) => new Date(row.starts_at).getHours());
      const dayRange = {
        first: Math.min(8, ...hoursPresent),
        last: Math.max(19, ...hoursPresent),
      };

      const bars = emptyBars(period, range.from, now, dayRange);
      const byService = new Map<string, number>();
      let totalCents = 0;

      for (const row of rows) {
        totalCents += row.price_cents;

        const index = bucketIndex(period, new Date(row.starts_at), range.from, dayRange.first);
        const bar = bars[index];
        if (bar) bar.cents += row.price_cents;

        const name = row.services?.name ?? "Sem serviço";
        byService.set(name, (byService.get(name) ?? 0) + row.price_cents);
      }

      const previousCents = (previous.data ?? []).reduce((sum, row) => sum + row.price_cents, 0);

      return {
        totalCents,
        count: rows.length,
        ticketCents: rows.length === 0 ? 0 : Math.round(totalCents / rows.length),
        bars,
        previousCents,
        compareLabel: range.compareLabel,
        periodLabel: range.periodLabel,
        topServices: [...byService.entries()]
          .map(([name, cents]) => ({ name, cents }))
          .sort((a, b) => b.cents - a.cents)
          .slice(0, 5),
      } satisfies Finance;
    },
    { enabled: Boolean(establishmentId) },
  );
}

/** Total do dia para o cabeçalho de Hoje. */
export function useTodayRevenue(establishmentId: string | null) {
  return useAsync(
    `today-revenue:${establishmentId}`,
    async () => {
      const from = startOfDay(new Date());
      const { data, error } = await supabase
        .from("appointments")
        .select("price_cents")
        .eq("establishment_id", establishmentId!)
        .eq("status", "completed")
        .gte("starts_at", from.toISOString())
        .lt("starts_at", shiftDays(from, 1).toISOString());
      if (error) throw new Error(error.message);
      return {
        cents: (data ?? []).reduce((sum, row) => sum + row.price_cents, 0),
        count: (data ?? []).length,
      };
    },
    { enabled: Boolean(establishmentId) },
  );
}
