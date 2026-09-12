import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";
import { runTool, TOOL_SCHEMAS } from "./tools.ts";

/**
 * O assistente do Vez.
 *
 * Existe como Edge Function por um motivo que não admite alternativa: a chave da
 * OpenAI. Bundle de app nativo é extraível — qualquer pessoa com o .ipa lê a
 * chave e passa a gastar na conta do projeto. A chave nunca sai daqui.
 *
 * O modelo não sabe nada sobre lojas ou agendas: ele pergunta, por ferramentas,
 * e responde com o que voltou. Horário livre vem sempre da RPC `available_slots`
 * (decisão 0001) — nem o assistente é exceção a isso.
 */

const DAILY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 4;
const HISTORY_LIMIT = 12;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) {
    // Falta de configuração é diferente de falha: a tela precisa dizer "o
    // assistente não está configurado", não "algo deu errado".
    return fail(
      "assistant_not_configured",
      "O assistente ainda não está configurado neste ambiente.",
      503,
    );
  }

  const {
    data: { user },
  } = await asUser(req).auth.getUser();
  if (!user) return fail("unauthorized", "Entre para usar o assistente.", 401);

  let body: { conversation_id?: string; message?: string; city_id?: string };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }

  const pergunta = (body.message ?? "").trim();
  if (!pergunta) return fail("empty_message", "Escreva sua pergunta.");
  if (pergunta.length > 1000) return fail("message_too_long", "Pergunta muito longa.");

  const admin = asAdmin();

  // Cota diária. A conta de testes tem crédito finito e sem aviso.
  const { count } = await admin
    .from("assistant_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", new Date(new Date().toDateString()).toISOString());

  if ((count ?? 0) >= DAILY_LIMIT) {
    return fail(
      "daily_limit_reached",
      `Você usou as ${DAILY_LIMIT} perguntas de hoje. Amanhã tem mais.`,
      429,
    );
  }

  // Conversa: continua a existente ou abre uma nova com o título já preenchido.
  let conversationId = body.conversation_id ?? null;
  if (conversationId) {
    const { data: owned } = await admin
      .from("assistant_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owned) conversationId = null;
  }
  if (!conversationId) {
    const { data: created, error } = await admin
      .from("assistant_conversations")
      .insert({ user_id: user.id, title: pergunta.slice(0, 80) })
      .select("id")
      .single();
    if (error || !created)
      return fail("conversation_failed", "Não foi possível abrir a conversa.", 500);
    conversationId = created.id;
  }

  const { data: historico } = await admin
    .from("assistant_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const cidade = await resolveCity(admin, body.city_id ?? null);
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(hoje) },
    ...(historico ?? []).reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: pergunta },
  ];

  const cards: unknown[] = [];
  let resposta = "";

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await callOpenAI(apiKey, messages);
      const choice = completion.choices?.[0]?.message;
      if (!choice) return fail("model_failed", "O assistente não respondeu.", 502);

      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        resposta = choice.content ?? "";
        break;
      }

      messages.push({
        role: "assistant",
        content: choice.content ?? null,
        tool_calls: choice.tool_calls,
      });

      for (const call of choice.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // Modelo mandou JSON quebrado: devolve o erro como resultado da
          // ferramenta em vez de derrubar a conversa — ele costuma se corrigir.
        }
        const result = await runTool(admin, call.function.name, args, cidade?.id ?? null);
        cards.push(...result.cards);
        messages.push({ role: "tool", tool_call_id: call.id, content: result.text });
      }
    }
  } catch (cause) {
    console.error("assistant:", cause);
    if (cause instanceof OpenAIError) {
      if (cause.status === 401 || cause.status === 403) {
        return fail(
          "assistant_not_configured",
          "O assistente ainda não está configurado neste ambiente.",
          503,
        );
      }
      if (cause.outOfCredit) {
        return fail(
          "assistant_out_of_credit",
          "O assistente está sem crédito. Avise o suporte.",
          503,
        );
      }
    }
    return fail("model_failed", "O assistente está indisponível agora. Tente em instantes.", 502);
  }

  if (!resposta) {
    // Estourou as rodadas de ferramenta sem uma resposta em texto. Dizer isso é
    // melhor do que devolver um balão vazio.
    resposta = "Não consegui concluir essa consulta. Pode reformular a pergunta?";
  }

  // Só grava depois de ter resposta: pergunta sem resposta consumiria cota sem
  // entregar nada.
  await admin.from("assistant_messages").insert([
    { conversation_id: conversationId, user_id: user.id, role: "user", content: pergunta },
    {
      conversation_id: conversationId,
      user_id: user.id,
      role: "assistant",
      content: resposta,
      cards: cards.length > 0 ? cards : null,
    },
  ]);

  await admin
    .from("assistant_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return json({
    conversation_id: conversationId,
    reply: resposta,
    cards,
    remaining: Math.max(DAILY_LIMIT - (count ?? 0) - 1, 0),
  });
});

class OpenAIError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Conta sem crédito: nenhuma tentativa futura passa até alguém pagar. */
    readonly outOfCredit = false,
  ) {
    super(message);
  }
}

/** Lê a variável tratando "declarada e vazia" como ausente. */
function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function systemPrompt(hoje: string): string {
  return [
    "Você é o assistente do Vez, um app para marcar horário em barbearias, salões,",
    "clínicas e petshops. Responda sempre em português do Brasil.",
    "",
    `Hoje é ${hoje}.`,
    "",
    "REGRAS QUE NÃO PODEM SER QUEBRADAS:",
    "- Nunca invente loja, serviço, preço ou horário. Use apenas o que as",
    "  ferramentas devolverem. Se a ferramenta não devolveu, diga que não encontrou.",
    "- Horário livre vem SÓ de `consultar_horarios`. Nunca deduza horário a partir",
    "  do funcionamento da loja: o que parece livre pode estar vendido.",
    "- Antes de consultar horários, descubra o serviço com `listar_servicos` — a",
    "  grade depende da duração dele.",
    "- Você não reserva nada. Quem confirma é o usuário, tocando no horário.",
    "- Nunca cite cidade ou estado: o app não mostra localidade. As buscas já",
    "  trazem só lojas perto do usuário; diga \"perto de você\" ou \"por perto\".",
    "",
    "ESTILO:",
    "- Curto. Duas ou três frases, no máximo.",
    "- Não repita em texto a lista de lojas e horários: o app já desenha cartões",
    "  com eles. Diga o que encontrou e deixe o usuário escolher.",
    "- Se a pergunta não tem a ver com marcar horário, diga em uma frase que você",
    "  só ajuda com isso.",
  ].join("\n");
}

async function resolveCity(
  db: ReturnType<typeof asAdmin>,
  cityId: string | null,
): Promise<{ id: string; name: string } | null> {
  if (cityId) {
    const { data } = await db.from("cities").select("id, name").eq("id", cityId).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function callOpenAI(apiKey: string, messages: ChatMessage[]) {
  // Base configurável: serve para Azure OpenAI, para um proxy corporativo e —
  // o motivo prático — para apontar a um servidor falso e testar o loop de
  // ferramentas sem gastar cota de verdade.
  //
  // `env()` e não `??`: uma variável declarada e vazia no .env (`VAR=`) chega
  // como string vazia, não como undefined, e `??` não cairia no padrão. O
  // resultado seria um fetch para "/chat/completions" — URL relativa, que num
  // servidor não resolve para lugar nenhum.
  const base = env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Configurável para trocar de modelo sem mexer em código — inclusive para
      // um mais barato quando o crédito de teste apertar.
      model: env("OPENAI_MODEL") ?? "gpt-4o-mini",
      messages,
      tools: TOOL_SCHEMAS,
      // Teto de custo por resposta. O estilo pedido já é curto; isto é a rede.
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const detalhe = await response.text();
    // O 429 da OpenAI é dois erros com o mesmo número, e eles pedem ações
    // opostas: `insufficient_quota` é conta sem crédito (esperar não resolve,
    // alguém precisa pagar) e o outro é excesso de requisições por minuto
    // (esperar resolve). Tratar os dois igual manda metade dos casos para o
    // conselho errado.
    const semCredito = detalhe.includes("insufficient_quota");
    throw new OpenAIError(response.status, `OpenAI ${response.status}: ${detalhe}`, semCredito);
  }
  return (await response.json()) as {
    choices?: {
      message: {
        content: string | null;
        tool_calls?: {
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }[];
      };
    }[];
  };
}
