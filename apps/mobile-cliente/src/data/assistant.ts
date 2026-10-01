import { supabase } from "../../lib/supabase";
import { type Card, parseCards } from "../domain/assistant";
import { useAsync } from "@vez/mobile-kit/async";

export type { Card, EstablishmentCard, SlotCard } from "../domain/assistant";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards: Card[];
  /**
   * Quando a mensagem veio do histórico, a hora em que foi escrita. Os
   * horários de uma resposta antiga não são mais oferta: a tela usa isto para
   * dizer de quando eles são em vez de deixá-los tocáveis.
   */
  restoredAt?: string;
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
    // Com resposta do servidor o corpo traz `{code, message}`; sem resposta
    // (rede caiu, função fora do ar) não há corpo e o código é `network`.
    const body = await readErrorBody(error);
    return {
      ok: false,
      code: body?.code ?? "network",
      message: body?.message ?? "Não foi possível falar com o assistente.",
    };
  }

  const payload = data as {
    conversation_id?: unknown;
    reply?: unknown;
    cards?: unknown;
    remaining?: unknown;
  } | null;

  if (
    !payload ||
    typeof payload.conversation_id !== "string" ||
    typeof payload.reply !== "string"
  ) {
    // 200 com corpo que não é o combinado: tratar como resposta seria desenhar
    // um balão vazio.
    return { ok: false, code: "model_failed", message: "O assistente não respondeu." };
  }

  return {
    ok: true,
    conversationId: payload.conversation_id,
    reply: payload.reply,
    cards: parseCards(payload.cards),
    remaining: typeof payload.remaining === "number" ? payload.remaining : 0,
  };
}

export type AssistantUsage = { used: number; remaining: number; dayLimit: number };

/** Quantas perguntas ainda cabem hoje. */
export function useAssistantUsage(enabled: boolean) {
  return useAsync(
    "assistant-usage",
    async (): Promise<AssistantUsage> => {
      const { data, error } = await supabase.rpc("assistant_usage_today");
      if (error) throw new Error(error.message);
      const row = (data ?? [])[0];
      // A função agrega e sempre devolve uma linha. Sem linha, o número é
      // desconhecido — e desconhecido não é zero (R7).
      if (!row) throw new Error("Cota indisponível.");
      return { used: row.used, remaining: row.remaining, dayLimit: row.day_limit };
    },
    { enabled },
  );
}

export type ConversationSummary = { id: string; title: string | null; updatedAt: string };

/**
 * As conversas da pessoa, da mais recente para a mais antiga.
 *
 * Leitura direta na tabela: a política `assistant_conversations_select_own`
 * já limita ao dono, então não há filtro por usuário aqui — repetir a regra no
 * cliente cria um segundo lugar onde ela pode divergir.
 */
export function useConversations(enabled: boolean) {
  return useAsync(
    "assistant-conversations",
    async (): Promise<ConversationSummary[]> => {
      const { data, error } = await supabase
        .from("assistant_conversations")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: row.updated_at,
      }));
    },
    { enabled },
  );
}

/** As mensagens de uma conversa, na ordem em que foram ditas. */
export async function loadConversation(
  conversationId: string,
): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id, role, content, cards, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return { ok: false, message: error.message };

  const rows = [...(data ?? [])];
  // Pergunta e resposta são gravadas no mesmo insert e nascem com o mesmo
  // `created_at`. O banco não promete ordem entre empates; a conversa promete:
  // a pergunta vem antes da resposta.
  rows.sort((a, b) => {
    const byTime = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (byTime !== 0) return byTime;
    if (a.role === b.role) return 0;
    return a.role === "user" ? -1 : 1;
  });

  return {
    ok: true,
    messages: rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      cards: parseCards(row.cards),
      restoredAt: row.created_at,
    })),
  };
}

/**
 * Apaga uma conversa. As mensagens vão junto (`on delete cascade`).
 *
 * A contagem do dia é feita sobre `assistant_messages`, então ela muda quando
 * as mensagens somem. A tela recarrega a cota depois de apagar para mostrar o
 * número que o servidor vai de fato aplicar, e não um que ela mesma calculou.
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  const { error } = await supabase
    .from("assistant_conversations")
    .delete()
    .eq("id", conversationId);
  return !error;
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
