import { type AssistantDeps, HISTORY_LIMIT, type HistoryRow, TurnError } from "./core.ts";

/**
 * Cota e histórico no Postgres.
 *
 * Tudo aqui passa pelas RPCs `assistant_*_turn`, que só a chave secreta
 * executa (migration `20260930120000_assistant_launch.sql`). A regra — limite,
 * dia, dono da conversa — mora no banco; este arquivo só traduz o resultado.
 *
 * Separado de `index.ts` para a mesma ligação ser exercitada contra o banco
 * local pelo teste de integração, sem Deno.
 */

type DbError = { message: string; hint?: string | null };
type DbResult = { data: unknown; error: DbError | null };

interface HistoryQuery extends PromiseLike<DbResult> {
  eq(column: string, value: string): HistoryQuery;
  order(column: string, options: { ascending: boolean }): HistoryQuery;
  limit(count: number): HistoryQuery;
}

/** O pedaço do cliente Supabase (com a chave secreta) que o armazenamento usa. */
export type StoreDb = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<DbResult>;
  from(table: string): { select(columns: string): HistoryQuery };
};

type Store = Pick<AssistantDeps, "beginTurn" | "history" | "finishTurn" | "abortTurn">;

export function createStore(admin: StoreDb, userId: string): Store {
  return {
    async beginTurn({ conversationId, message }) {
      const { data, error } = await admin.rpc("assistant_begin_turn", {
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_message: message,
      });
      if (error) {
        // Códigos estáveis vêm em `hint`; a mensagem do banco não vai à tela.
        if (error.hint === "daily_limit_reached") {
          throw new TurnError(
            "daily_limit_reached",
            "Você usou as perguntas de hoje. Amanhã tem mais.",
            429,
          );
        }
        if (error.hint === "empty_message") {
          throw new TurnError("empty_message", "Escreva sua pergunta.", 400);
        }
        if (error.hint === "message_too_long") {
          throw new TurnError("message_too_long", "Pergunta muito longa.", 400);
        }
        throw new Error(`assistant_begin_turn: ${error.message}`);
      }
      const row = ((data ?? []) as unknown[])[0] as
        { conversation_id: string; message_id: string; remaining: number } | undefined;
      if (!row) throw new Error("assistant_begin_turn: sem retorno");
      return {
        conversationId: row.conversation_id,
        messageId: row.message_id,
        remaining: row.remaining,
      };
    },

    async history(conversationId) {
      // As últimas N, lidas de trás para frente e devolvidas na ordem da conversa.
      const { data, error } = await admin
        .from("assistant_messages")
        .select("role, content, cards")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw new Error(`assistant_messages: ${error.message}`);
      return ((data ?? []) as HistoryRow[]).reverse();
    },

    async finishTurn(input) {
      const { error } = await admin.rpc("assistant_finish_turn", {
        p_user_id: userId,
        p_conversation_id: input.conversationId,
        p_reply: input.reply,
        p_cards: input.cards,
        p_model: input.model,
        p_prompt_tokens: input.promptTokens,
        p_completion_tokens: input.completionTokens,
      });
      if (error) throw new Error(`assistant_finish_turn: ${error.message}`);
    },

    async abortTurn(messageId) {
      const { error } = await admin.rpc("assistant_abort_turn", {
        p_user_id: userId,
        p_message_id: messageId,
      });
      if (error) throw new Error(`assistant_abort_turn: ${error.message}`);
    },
  };
}
