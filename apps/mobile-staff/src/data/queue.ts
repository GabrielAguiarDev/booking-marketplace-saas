import { useCallback, useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";

export type QueueSource = "app" | "qr" | "counter";
export type QueueStatus = "waiting" | "called" | "in_service" | "done" | "left" | "no_show";

export type QueueRow = {
  id: string;
  /** 0 quando a pessoa não está na fila: já foi chamada, sentou, ou não confirmou chegada. */
  position: number;
  status: QueueStatus;
  source: QueueSource;
  name: string;
  phone: string | null;
  hasAccount: boolean;
  serviceName: string | null;
  serviceMinutes: number | null;
  joinedAt: string;
  calledAt: string | null;
  servedAt: string | null;
  arrivedAt: string | null;
  estimatedWaitMinutes: number;
};

type StateRow = {
  entry_id: string;
  queue_position: number;
  estimated_wait_minutes: number;
};

type EntryRow = {
  id: string;
  status: QueueStatus;
  source: QueueSource;
  joined_at: string;
  called_at: string | null;
  served_at: string | null;
  arrived_at: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  customer_id: string | null;
  services: { name: string; duration_minutes: number } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

const ENTRY_COLUMNS =
  "id, status, source, joined_at, called_at, served_at, arrived_at, guest_name, guest_phone," +
  " customer_id, services(name, duration_minutes), profiles:customer_id(full_name, phone)";

/**
 * A fila viva da loja.
 *
 * Duas consultas, e a divisão não é acidente. `queue_state()` é a única fonte
 * de posição e de espera (decisão 0001): se esta tela contasse por conta
 * própria, o balcão diria "você é o segundo" e o celular do cliente diria
 * "primeiro", os dois lendo o mesmo banco. A segunda consulta traz só o que a
 * função de propósito não devolve — nome, serviço, origem.
 *
 * O Realtime refaz as duas. É a tela que menos pode estar desatualizada do
 * produto inteiro: alguém entra na fila enquanto o atendente olha para ela.
 */
export function useQueueLive(establishmentId: string | null) {
  // O resultado guarda de qual loja ele é. É o mesmo motivo do `useAsync` do
  // kit: sem a chave, a fila da loja anterior aparece por um instante na tela
  // da loja nova — e numa tela de operação isso significa chamar a pessoa
  // errada.
  const [result, setResult] = useState<{
    key: string;
    rows: QueueRow[];
    error: string | null;
  } | null>(null);
  const [tick, setTick] = useState(0);

  const key = `${establishmentId}:${tick}`;
  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!establishmentId) return;

    let active = true;

    async function load(id: string) {
      const [state, entries] = await Promise.all([
        supabase.rpc("queue_state", { p_establishment_id: id }),
        supabase
          .from("queue_entries")
          .select(ENTRY_COLUMNS)
          .eq("establishment_id", id)
          .in("status", ["waiting", "called", "in_service"])
          .order("joined_at"),
      ]);

      if (!active) return;

      if (state.error || entries.error) {
        setResult({
          key,
          rows: [],
          error: state.error?.message ?? entries.error?.message ?? "Falha ao ler a fila.",
        });
        return;
      }

      const positions = new Map(
        ((state.data ?? []) as StateRow[]).map((row) => [row.entry_id, row]),
      );

      const rows = ((entries.data ?? []) as unknown as EntryRow[]).map((entry) => {
        const state = positions.get(entry.id);
        return {
          id: entry.id,
          position: state?.queue_position ?? 0,
          status: entry.status,
          source: entry.source,
          // Cliente com conta tem nome no perfil; quem entrou pelo balcão tem
          // o nome escrito à mão. Não existe linha sem os dois: a constraint
          // `queue_entries_has_someone` garante.
          name: entry.profiles?.full_name ?? entry.guest_name ?? "Sem nome",
          phone: entry.profiles?.phone ?? entry.guest_phone,
          hasAccount: entry.customer_id !== null,
          serviceName: entry.services?.name ?? null,
          serviceMinutes: entry.services?.duration_minutes ?? null,
          joinedAt: entry.joined_at,
          calledAt: entry.called_at,
          servedAt: entry.served_at,
          arrivedAt: entry.arrived_at,
          estimatedWaitMinutes: state?.estimated_wait_minutes ?? 0,
        };
      });

      setResult({ key, rows, error: null });
    }

    void load(establishmentId);

    const channel = supabase
      .channel(`staff-queue:${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => {
          void load(establishmentId);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
    // `key` já embute loja e recarga; o Realtime refaz o resto sozinho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result?.key === key ? result : null;

  return {
    rows: current?.rows ?? [],
    loading: Boolean(establishmentId) && current === null,
    error: current?.error ?? null,
    reload,
  };
}

type Result = { ok: boolean; message?: string };

function done(error: { message: string } | null, fallback: string): Result {
  return error ? { ok: false, message: fallback } : { ok: true };
}

/** Chama quem está na primeira posição. O cliente vira 'called' e ainda não sentou. */
export async function callEntry(entryId: string): Promise<Result> {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "called", called_at: new Date().toISOString() })
    .eq("id", entryId);
  return done(error, "Não foi possível chamar.");
}

/** Sentou na cadeira. É aqui que o atendimento começa a contar. */
export async function seatEntry(entryId: string): Promise<Result> {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "in_service", served_at: new Date().toISOString() })
    .eq("id", entryId);
  return done(error, "Não foi possível sentar o cliente.");
}

export async function finishEntry(entryId: string): Promise<Result> {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "done", finished_at: new Date().toISOString() })
    .eq("id", entryId);
  return done(error, "Não foi possível concluir.");
}

export async function markEntryAbsent(entryId: string): Promise<Result> {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "no_show" })
    .eq("id", entryId);
  return done(error, "Não foi possível marcar a ausência.");
}

export async function confirmEntryArrival(entryId: string): Promise<Result> {
  const { error } = await supabase
    .from("queue_entries")
    .update({ arrived_at: new Date().toISOString() })
    .eq("id", entryId);
  return done(error, "Não foi possível confirmar a chegada.");
}

/**
 * Sobe uma pessoa uma posição.
 *
 * A posição não é coluna — é a ordem de `joined_at` entre quem espera, e isso é
 * proposital: coluna de posição corrompe sob concorrência. Subir alguém, então,
 * é trocar os dois horários de entrada. Fica registrado no dado, não numa
 * ordenação que só existe nesta tela.
 */
export async function swapQueueOrder(
  entry: { id: string; joinedAt: string },
  above: { id: string; joinedAt: string },
): Promise<Result> {
  const first = await supabase
    .from("queue_entries")
    .update({ joined_at: above.joinedAt })
    .eq("id", entry.id);
  if (first.error) return { ok: false, message: "Não foi possível reordenar." };

  const second = await supabase
    .from("queue_entries")
    .update({ joined_at: entry.joinedAt })
    .eq("id", above.id);
  return done(second.error, "Não foi possível reordenar.");
}

/** Quem chegou no balcão sem usar o app. Entra já com chegada confirmada. */
export async function addWalkIn(input: {
  establishmentId: string;
  name: string;
  phone: string | null;
  serviceId: string | null;
}): Promise<Result> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("queue_entries").insert({
    establishment_id: input.establishmentId,
    customer_id: null,
    guest_name: input.name,
    guest_phone: input.phone,
    service_id: input.serviceId,
    source: "counter",
    status: "waiting",
    joined_at: now,
    // Quem está de pé no balcão chegou por definição.
    arrived_at: now,
  });
  return done(error, "Não foi possível colocar na fila.");
}
