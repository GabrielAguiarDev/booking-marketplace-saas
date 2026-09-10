import { supabase } from "../../lib/supabase";
import type { CategoryKey } from "./catalog";
import { useAsync } from "@vez/mobile-kit/async";

/** Cartões que a resposta pode trazer — o app desenha nativo, não em texto. */
export type EstablishmentCard = {
  kind: "establishment";
  id: string;
  name: string;
  category: CategoryKey;
  neighborhood: string | null;
  rating_avg: number | null;
  rating_count: number;
  booking_mode: "scheduled" | "queue" | "both";
};

export type SlotCard = {
  kind: "slot";
  establishment_id: string;
  service_id: string;
  professional_id: string;
  slot_start: string;
};

export type Card = EstablishmentCard | SlotCard;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards: Card[];
};

export type AskResult =
  | { ok: true; conversationId: string; reply: string; cards: Card[]; remaining: number }
  | { ok: false; code: string; message: string };

/**
 * Manda a pergunta para a Edge Function.
 *
 * Não existe caminho do app direto para a OpenAI, e isso não é preferência: a
 * chave estaria no bundle, e bundle de app nativo se abre com um zip.
 */
export async function ask(input: {
  message: string;
  conversationId: string | null;
  cityId: string | null;
}): Promise<AskResult> {
  const { data, error } = await supabase.functions.invoke("assistant", {
    body: {
      message: input.message,
      conversation_id: input.conversationId,
      city_id: input.cityId,
    },
  });

  if (error) {
    const body = await readErrorBody(error);
    return {
      ok: false,
      code: body?.code ?? "network",
      message: body?.message ?? "Não foi possível falar com o assistente.",
    };
  }

  const payload = data as {
    conversation_id: string;
    reply: string;
    cards: Card[];
    remaining: number;
  };
  return {
    ok: true,
    conversationId: payload.conversation_id,
    reply: payload.reply,
    cards: payload.cards ?? [],
    remaining: payload.remaining,
  };
}

/** Quantas perguntas ainda cabem hoje. */
export function useAssistantUsage(enabled: boolean) {
  return useAsync(
    "assistant-usage",
    async () => {
      const { data, error } = await supabase.rpc("assistant_usage_today");
      if (error) throw new Error(error.message);
      const row = (data ?? [])[0] as
        { used: number; remaining: number; day_limit: number } | undefined;
      return row ?? { used: 0, remaining: 0, day_limit: 0 };
    },
    { enabled },
  );
}

async function readErrorBody(error: unknown): Promise<{ code: string; message: string } | null> {
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try {
    const body = (await context.json()) as { error?: { code: string; message: string } };
    return body.error ?? null;
  } catch {
    return null;
  }
}
