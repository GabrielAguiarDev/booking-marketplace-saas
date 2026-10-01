import { type ChatMessage, type Completion, ModelError, type ToolCall } from "./core.ts";

/**
 * A única porta para a OpenAI.
 *
 * Chat Completions com ferramentas. `fetch` e a base são injetáveis: base
 * serve para Azure OpenAI ou proxy corporativo, e os dois juntos deixam o laço
 * inteiro ser testado contra um servidor falso, sem gastar cota.
 */

export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_MODEL = "gpt-4o-mini";
/** Teto de custo por resposta. O estilo pedido já é curto; isto é a rede. */
export const MAX_COMPLETION_TOKENS = 500;
/**
 * Prazo por chamada. Sem ele, um upstream travado segura a função até a
 * plataforma derrubá-la — e a pessoa fica olhando um balão que nunca chega.
 */
export const DEFAULT_TIMEOUT_MS = 20_000;

export type CompleterConfig = {
  apiKey: string;
  /** Vazio ou ausente cai no padrão: `VAR=` no .env chega como string vazia. */
  baseUrl?: string | null;
  model?: string | null;
  tools: unknown[];
  timeoutMs?: number;
  fetch?: typeof fetch;
};

type RawCompletion = {
  model?: string;
  choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export function createCompleter(
  config: CompleterConfig,
): (messages: ChatMessage[]) => Promise<Completion> {
  const base = (config.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = config.model?.trim() || DEFAULT_MODEL;
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (messages) => {
    let response: Response;
    try {
      response = await doFetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          tools: config.tools,
          // `max_tokens` está descontinuado em Chat Completions; o nome atual
          // conta também os tokens de raciocínio, quando o modelo os tem.
          max_completion_tokens: MAX_COMPLETION_TOKENS,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new ModelError("unavailable", `OpenAI: sem resposta (${describe(cause)})`);
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 500);
      const message = `OpenAI ${response.status}: ${detail}`;
      if (response.status === 401 || response.status === 403) throw new ModelError("auth", message);
      // O 429 da OpenAI é dois erros com o mesmo número, e eles pedem ações
      // opostas: `insufficient_quota` é conta sem crédito (esperar não
      // resolve, alguém precisa pagar) e o outro é excesso de requisições por
      // minuto (esperar resolve).
      if (detail.includes("insufficient_quota")) throw new ModelError("out_of_credit", message);
      throw new ModelError("unavailable", message);
    }

    let payload: RawCompletion;
    try {
      payload = (await response.json()) as RawCompletion;
    } catch (cause) {
      throw new ModelError("unavailable", `OpenAI: resposta ilegível (${describe(cause)})`);
    }
    const choice = payload.choices?.[0]?.message;
    if (!choice) throw new ModelError("unavailable", "OpenAI: resposta sem escolha");

    return {
      content: choice.content ?? null,
      toolCalls: (choice.tool_calls ?? []).filter(
        (call) => call?.type === "function" && typeof call.function?.name === "string",
      ),
      model: payload.model ?? model,
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
    };
  };
}

function describe(cause: unknown): string {
  return cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
}
