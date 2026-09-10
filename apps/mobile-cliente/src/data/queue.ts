import { useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";
import { useAsync } from "@vez/mobile-kit/async";

export type QueueStatus = "waiting" | "called" | "in_service" | "done" | "left" | "no_show";

export type QueueSlot = {
  entry_id: string;
  customer_id: string;
  queue_position: number;
  status: QueueStatus;
  joined_at: string;
  estimated_wait_minutes: number;
};

export type MyQueueEntry = {
  id: string;
  establishment_id: string;
  status: QueueStatus;
  joined_at: string;
  arrived_at: string | null;
  establishments: { id: string; name: string; neighborhood: string | null };
};

/**
 * Estado da fila de uma loja, com atualização ao vivo.
 *
 * É a única tela do app que precisa mudar sozinha na mão do usuário: ninguém
 * fica puxando para atualizar enquanto espera a vez. A assinatura de Realtime
 * escuta a tabela e refaz a chamada da função — a posição vem sempre do
 * servidor, nunca de uma conta local que poderia divergir do balcão.
 */
export function useQueueState(establishmentId: string | null) {
  const [tick, setTick] = useState(0);

  const query = useAsync(
    `queue:${establishmentId}:${tick}`,
    async () => {
      const { data, error } = await supabase.rpc("queue_state", {
        p_establishment_id: establishmentId!,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as QueueSlot[];
    },
    { enabled: Boolean(establishmentId) },
  );

  useEffect(() => {
    if (!establishmentId) return;

    const channel = supabase
      .channel(`queue:${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => setTick((value) => value + 1),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [establishmentId]);

  return query;
}

/** A entrada ativa do próprio usuário, em qualquer loja. */
export function useMyQueueEntry(enabled: boolean) {
  const [tick, setTick] = useState(0);

  const query = useAsync(
    `my-queue:${tick}`,
    async () => {
      const { data, error } = await supabase
        .from("queue_entries")
        .select(
          "id, establishment_id, status, joined_at, arrived_at, establishments(id, name, neighborhood)",
        )
        .in("status", ["waiting", "called", "in_service"])
        .order("joined_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return ((data ?? [])[0] ?? null) as MyQueueEntry | null;
    },
    { enabled },
  );

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("my-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, () =>
        setTick((value) => value + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return query;
}

export async function joinQueue(input: {
  establishmentId: string;
  customerId: string;
  serviceId?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("queue_entries").insert({
    establishment_id: input.establishmentId,
    customer_id: input.customerId,
    service_id: input.serviceId ?? null,
  });

  if (error) {
    // 23505: o índice parcial `queue_entries_one_active_per_customer`. Já está
    // na fila — não é erro do ponto de vista do usuário.
    if (error.code === "23505") return { ok: false, message: "Você já está nesta fila." };
    return { ok: false, message: "Não foi possível entrar na fila." };
  }
  return { ok: true };
}

export async function leaveQueue(entryId: string): Promise<boolean> {
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "left" })
    .eq("id", entryId);
  return !error;
}

export async function confirmArrival(entryId: string): Promise<boolean> {
  const { error } = await supabase
    .from("queue_entries")
    .update({ arrived_at: new Date().toISOString() })
    .eq("id", entryId);
  return !error;
}
