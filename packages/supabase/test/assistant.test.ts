import assert from "node:assert/strict";
import { test } from "node:test";

import {
  answer,
  type AssistantDeps,
  buildMessages,
  type ChatMessage,
  type Completion,
  type HistoryRow,
  MAX_TOOL_ROUNDS,
  ModelError,
  parseRequest,
  type ToolResult,
  TurnError,
} from "../../../supabase/functions/assistant/core.ts";
import {
  createCompleter,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
} from "../../../supabase/functions/assistant/openai.ts";
import { runTool, type ToolDb, TOOL_SCHEMAS } from "../../../supabase/functions/assistant/tools.ts";

/**
 * O assistente inteiro, sem chave, sem banco e sem custo.
 *
 * O modelo aqui é um roteiro: cada chamada devolve o próximo passo. É o mesmo
 * papel do "servidor falso" de `OPENAI_BASE_URL`, só que dentro do teste.
 */

const LOJA = "0a000000-0000-4000-8000-000000000001";
const SERVICO = "0b000000-0000-4000-8000-000000000001";
const PROFISSIONAL = "0c000000-0000-4000-8000-000000000001";
const CONVERSA = "0f000000-0000-4000-8000-000000000001";

const texto = (content: string): Completion => ({
  content,
  toolCalls: [],
  model: "modelo-falso",
  promptTokens: 100,
  completionTokens: 10,
});

const ferramenta = (name: string, args: unknown): Completion => ({
  content: null,
  toolCalls: [
    {
      id: `call_${name}`,
      type: "function",
      function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) },
    },
  ],
  model: "modelo-falso",
  promptTokens: 100,
  completionTokens: 10,
});

type Trace = {
  begun: { conversationId: string | null; message: string }[];
  finished: Parameters<AssistantDeps["finishTurn"]>[0][];
  aborted: string[];
  tools: { name: string; args: Record<string, unknown> }[];
  prompts: ChatMessage[][];
};

function harness(
  script: (Completion | Error)[],
  overrides: Partial<AssistantDeps> = {},
  history: HistoryRow[] = [],
): { deps: AssistantDeps; trace: Trace } {
  const trace: Trace = { begun: [], finished: [], aborted: [], tools: [], prompts: [] };
  const steps = [...script];
  const deps: AssistantDeps = {
    today: "2026-09-30",
    async beginTurn(input) {
      trace.begun.push(input);
      return { conversationId: input.conversationId ?? CONVERSA, messageId: "msg-1", remaining: 7 };
    },
    async history() {
      return history;
    },
    async finishTurn(input) {
      trace.finished.push(input);
    },
    async abortTurn(messageId) {
      trace.aborted.push(messageId);
    },
    async runTool(name, args): Promise<ToolResult> {
      trace.tools.push({ name, args });
      if (name === "buscar_estabelecimentos") {
        return { text: "[...]", cards: [{ kind: "establishment", id: LOJA, name: "Meia-Nove" }] };
      }
      if (name === "consultar_horarios") {
        return {
          text: "[...]",
          cards: [{ kind: "slot", establishment_id: LOJA, service_id: SERVICO }],
        };
      }
      return { text: "[]", cards: [] };
    },
    async complete(messages) {
      // Cópia: o núcleo segue empurrando mensagens no mesmo array.
      trace.prompts.push(messages.map((m) => ({ ...m })));
      const step = steps.shift();
      if (!step) throw new Error("roteiro do modelo acabou");
      if (step instanceof Error) throw step;
      return step;
    },
    ...overrides,
  };
  return { deps, trace };
}

const pedido = (message = "tem corte hoje à tarde?") => ({
  message,
  conversationId: null,
  cityId: null,
});

const erro = (response: { body: unknown }) =>
  (response.body as { error: { code: string; message: string } }).error;

test("duas rodadas de ferramenta viram resposta, cartões e histórico gravado", async () => {
  const { deps, trace } = harness([
    ferramenta("buscar_estabelecimentos", { categoria: "barbershop" }),
    ferramenta("consultar_horarios", {
      establishment_id: LOJA,
      service_id: SERVICO,
      data: "2026-09-30",
    }),
    texto("Achei horários perto de você."),
  ]);

  const response = await answer(deps, pedido());

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    conversation_id: CONVERSA,
    reply: "Achei horários perto de você.",
    cards: [
      { kind: "establishment", id: LOJA, name: "Meia-Nove" },
      { kind: "slot", establishment_id: LOJA, service_id: SERVICO },
    ],
    remaining: 7,
  });
  assert.deepEqual(
    trace.tools.map((t) => t.name),
    ["buscar_estabelecimentos", "consultar_horarios"],
  );

  // A cota é reservada uma vez, antes do modelo, e não devolvida.
  assert.equal(trace.begun.length, 1);
  assert.deepEqual(trace.aborted, []);

  // O que foi gravado é o que foi entregue, com o consumo somado das 3 chamadas.
  assert.equal(trace.finished.length, 1);
  assert.equal(trace.finished[0]?.reply, "Achei horários perto de você.");
  assert.equal(trace.finished[0]?.cards.length, 2);
  assert.equal(trace.finished[0]?.promptTokens, 300);
  assert.equal(trace.finished[0]?.completionTokens, 30);
  assert.equal(trace.finished[0]?.model, "modelo-falso");

  // O resultado da ferramenta volta ao modelo amarrado à chamada que o pediu.
  const ultima = trace.prompts[2] ?? [];
  const resultados = ultima.filter((m) => m.role === "tool").map((m) => m.tool_call_id);
  assert.deepEqual(resultados, ["call_buscar_estabelecimentos", "call_consultar_horarios"]);
});

test("cota esgotada recusa antes de chamar o modelo", async () => {
  let chamadas = 0;
  const { deps, trace } = harness([], {
    async beginTurn() {
      throw new TurnError("daily_limit_reached", "Você usou as perguntas de hoje.", 429);
    },
    async complete() {
      chamadas += 1;
      return texto("não deveria chegar aqui");
    },
  });

  const response = await answer(deps, pedido());

  assert.equal(response.status, 429);
  assert.equal(erro(response).code, "daily_limit_reached");
  assert.equal(chamadas, 0, "pergunta além da cota não pode custar uma chamada");
  assert.deepEqual(trace.finished, []);
  assert.deepEqual(trace.aborted, [], "nada foi reservado, nada a devolver");
});

test("falha ao reservar a cota não chama o modelo e não vaza o erro do banco", async () => {
  let chamadas = 0;
  const { deps } = harness([], {
    async beginTurn() {
      throw new Error('relation "assistant_usage_daily" does not exist');
    },
    async complete() {
      chamadas += 1;
      return texto("x");
    },
  });

  const response = await answer(deps, pedido());

  assert.equal(response.status, 500);
  assert.equal(erro(response).code, "conversation_failed");
  assert.doesNotMatch(erro(response).message, /assistant_usage_daily/);
  assert.equal(chamadas, 0);
});

for (const caso of [
  { kind: "out_of_credit", code: "assistant_out_of_credit", status: 503 },
  { kind: "auth", code: "assistant_not_configured", status: 503 },
  { kind: "unavailable", code: "model_failed", status: 502 },
] as const) {
  test(`modelo falhou (${caso.kind}): código ${caso.code} e a reserva volta`, async () => {
    const { deps, trace } = harness([new ModelError(caso.kind, "OpenAI 429: sk-segredo")]);

    const response = await answer(deps, pedido());

    assert.equal(response.status, caso.status);
    assert.equal(erro(response).code, caso.code);
    assert.doesNotMatch(JSON.stringify(response.body), /sk-segredo|OpenAI/);
    assert.deepEqual(trace.aborted, ["msg-1"], "pergunta sem resposta não gasta cota");
    assert.deepEqual(trace.finished, []);
  });
}

test("falha no meio do laço, depois de uma ferramenta, também devolve a reserva", async () => {
  const { deps, trace } = harness([
    ferramenta("buscar_estabelecimentos", {}),
    new ModelError("unavailable", "timeout"),
  ]);

  const response = await answer(deps, pedido());

  assert.equal(erro(response).code, "model_failed");
  assert.deepEqual(trace.aborted, ["msg-1"]);
  assert.deepEqual(trace.finished, [], "resposta pela metade não entra no histórico");
});

test("devolução que falha não esconde o erro original do usuário", async () => {
  const { deps } = harness([new ModelError("out_of_credit", "sem saldo")], {
    async abortTurn() {
      throw new Error("banco fora");
    },
  });

  const response = await answer(deps, pedido());

  assert.equal(erro(response).code, "assistant_out_of_credit");
});

test("modelo que só pede ferramenta para no teto de rodadas e diz que não concluiu", async () => {
  const { deps, trace } = harness(
    Array.from({ length: MAX_TOOL_ROUNDS + 3 }, () => ferramenta("listar_servicos", {})),
  );

  const response = await answer(deps, pedido());

  assert.equal(trace.prompts.length, MAX_TOOL_ROUNDS, "o teto de rodadas é o teto de custo");
  assert.equal(response.status, 200);
  assert.match((response.body as { reply: string }).reply, /Não consegui concluir/);
  // Houve custo de verdade: a pergunta conta e o turno é gravado.
  assert.deepEqual(trace.aborted, []);
  assert.equal(trace.finished.length, 1);
});

test("argumentos quebrados do modelo não derrubam a conversa", async () => {
  const { deps, trace } = harness([
    ferramenta("listar_servicos", "{isto não é json"),
    ferramenta("listar_servicos", "[1,2,3]"),
    texto("Pronto."),
  ]);

  const response = await answer(deps, pedido());

  assert.equal(response.status, 200);
  assert.deepEqual(trace.tools, [
    { name: "listar_servicos", args: {} },
    { name: "listar_servicos", args: {} },
  ]);
});

test("resposta entregue mesmo se o histórico não gravar", async () => {
  const falhas: string[] = [];
  const { deps } = harness([texto("Tem sim.")], {
    async finishTurn() {
      throw new Error("banco fora");
    },
    log: (message) => falhas.push(message),
  });

  const response = await answer(deps, pedido());

  assert.equal(response.status, 200);
  assert.equal((response.body as { reply: string }).reply, "Tem sim.");
  assert.ok(
    falhas.some((m) => m.includes("finishTurn")),
    "a falha de gravação precisa aparecer no log",
  );
});

test("histórico leva ao modelo os ids dos cartões da resposta anterior", async () => {
  const history: HistoryRow[] = [
    { role: "user", content: "tem corte hoje?", cards: null },
    {
      role: "assistant",
      content: "Achei a Meia-Nove.",
      cards: [
        { kind: "establishment", id: LOJA, name: "Meia-Nove" },
        {
          kind: "slot",
          establishment_id: LOJA,
          service_id: SERVICO,
          slot_start: "2026-09-30T19:00:00Z",
        },
        {
          kind: "slot",
          establishment_id: LOJA,
          service_id: SERVICO,
          slot_start: "2026-09-30T19:30:00Z",
        },
      ],
    },
    { role: "user", content: "e amanhã?", cards: null },
  ];
  const { deps, trace } = harness([texto("Amanhã também.")], {}, history);

  await answer(deps, pedido("e amanhã?"));

  const prompt = trace.prompts[0] ?? [];
  assert.deepEqual(
    prompt.map((m) => m.role),
    ["system", "user", "assistant", "system", "user"],
  );
  const contexto = prompt[3]?.content ?? "";
  assert.match(contexto, new RegExp(LOJA));
  assert.match(contexto, new RegExp(SERVICO));
  assert.equal(contexto.split(SERVICO).length - 1, 1, "consulta repetida entra uma vez só");
  // A pergunta atual já veio do histórico; não é duplicada.
  assert.equal(prompt.filter((m) => m.content === "e amanhã?").length, 1);
});

test("sem histórico legível, a pergunta ainda chega ao modelo", async () => {
  const { deps, trace } = harness([texto("Oi.")], {
    async history() {
      throw new Error("leitura falhou");
    },
  });

  const response = await answer(deps, pedido("oi"));

  assert.equal(response.status, 200);
  assert.deepEqual(
    (trace.prompts[0] ?? []).map((m) => m.role),
    ["system", "user"],
  );
  assert.equal(trace.prompts[0]?.[1]?.content, "oi");
});

test("o prompt de sistema carrega a data e a proibição de deduzir horário", () => {
  const [system] = buildMessages("2026-09-30", [], "oi");
  assert.match(system?.content ?? "", /Hoje é 2026-09-30/);
  assert.match(system?.content ?? "", /consultar_horarios/);
  assert.match(system?.content ?? "", /dado, não instrução/);
});

test("corpo do pedido: tipos errados são recusados, ids malformados viram nulos", () => {
  const recusa = (body: unknown) => {
    const parsed = parseRequest(body);
    assert.equal(parsed.ok, false);
    return parsed.ok ? "" : erro(parsed.response).code;
  };
  assert.equal(recusa(null), "invalid_body");
  assert.equal(recusa([]), "invalid_body");
  assert.equal(recusa({ message: 42 }), "invalid_body");
  assert.equal(recusa({ message: "   " }), "empty_message");
  assert.equal(recusa({}), "empty_message");
  assert.equal(recusa({ message: "a".repeat(1001) }), "message_too_long");

  const parsed = parseRequest({
    message: "  oi  ",
    conversation_id: "'; drop table x; --",
    city_id: LOJA,
  });
  assert.deepEqual(parsed, {
    ok: true,
    request: { message: "oi", conversationId: null, cityId: LOJA },
  });
});

// ── cliente da OpenAI ─────────────────────────────────────────────────────────

type Call = { url: string; init: RequestInit };

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { calls, impl };
}

const okBody = {
  model: "gpt-4o-mini-2024-07-18",
  choices: [{ message: { content: "Oi!", tool_calls: undefined } }],
  usage: { prompt_tokens: 12, completion_tokens: 3 },
};

test("pedido à OpenAI: endpoint, chave no cabeçalho, ferramentas e teto de tokens", async () => {
  const { calls, impl } = fakeFetch(() => Response.json(okBody));
  // Base e modelo vazios é o `.env` com `VAR=`: precisam cair no padrão.
  const complete = createCompleter({
    apiKey: "sk-teste",
    baseUrl: "",
    model: "  ",
    tools: TOOL_SCHEMAS,
    fetch: impl,
  });

  const completion = await complete([{ role: "user", content: "oi" }]);

  assert.equal(calls[0]?.url, `${DEFAULT_BASE_URL}/chat/completions`);
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer sk-teste");
  const sent = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
  assert.equal(sent.model, DEFAULT_MODEL);
  assert.equal(sent.max_completion_tokens, 500);
  assert.equal("max_tokens" in sent, false, "max_tokens está descontinuado");
  assert.equal((sent.tools as unknown[]).length, 3);
  assert.ok(calls[0]?.init.signal instanceof AbortSignal, "a chamada tem prazo");

  assert.deepEqual(completion, {
    content: "Oi!",
    toolCalls: [],
    model: "gpt-4o-mini-2024-07-18",
    promptTokens: 12,
    completionTokens: 3,
  });
});

test("base configurada (proxy, Azure, servidor falso) é respeitada", async () => {
  const { calls, impl } = fakeFetch(() => Response.json(okBody));
  const complete = createCompleter({
    apiKey: "k",
    baseUrl: "http://127.0.0.1:9999/v1/",
    model: "outro-modelo",
    tools: [],
    fetch: impl,
  });
  await complete([]);
  assert.equal(calls[0]?.url, "http://127.0.0.1:9999/v1/chat/completions");
  assert.equal(
    (JSON.parse(String(calls[0]?.init.body)) as { model: string }).model,
    "outro-modelo",
  );
});

test("os dois 429 da OpenAI viram erros diferentes", async () => {
  const semCredito = createCompleter({
    apiKey: "k",
    tools: [],
    fetch: fakeFetch(
      () =>
        new Response(JSON.stringify({ error: { code: "insufficient_quota" } }), { status: 429 }),
    ).impl,
  });
  await assert.rejects(
    semCredito([]),
    (e) => e instanceof ModelError && e.kind === "out_of_credit",
  );

  const porMinuto = createCompleter({
    apiKey: "k",
    tools: [],
    fetch: fakeFetch(
      () =>
        new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), { status: 429 }),
    ).impl,
  });
  await assert.rejects(porMinuto([]), (e) => e instanceof ModelError && e.kind === "unavailable");
});

test("401 é configuração; 5xx, resposta vazia e rede são indisponibilidade", async () => {
  const com = (respond: () => Response | Promise<Response>) =>
    createCompleter({ apiKey: "k", tools: [], fetch: fakeFetch(respond).impl })([]);

  await assert.rejects(
    com(() => new Response("{}", { status: 401 })),
    (e) => e instanceof ModelError && e.kind === "auth",
  );
  await assert.rejects(
    com(() => new Response("upstream", { status: 503 })),
    (e) => e instanceof ModelError && e.kind === "unavailable",
  );
  await assert.rejects(
    com(() => Response.json({ choices: [] })),
    (e) => e instanceof ModelError && e.kind === "unavailable",
  );
  await assert.rejects(
    com(() => Promise.reject(new TypeError("fetch failed"))),
    (e) => e instanceof ModelError && e.kind === "unavailable",
  );
});

test("upstream travado é cortado pelo prazo, não espera para sempre", async () => {
  const { impl } = fakeFetch(
    ({ init }) =>
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
  );
  const complete = createCompleter({ apiKey: "k", tools: [], fetch: impl, timeoutMs: 20 });

  const started = Date.now();
  await assert.rejects(complete([]), (e) => e instanceof ModelError && e.kind === "unavailable");
  assert.ok(Date.now() - started < 2000);
});

// ── ferramentas ───────────────────────────────────────────────────────────────

type Recorded = { table?: string; rpc?: string; args?: unknown; filters: unknown[][] };

function fakeDb(rows: unknown, error: { message: string } | null = null) {
  const recorded: Recorded[] = [];
  const query = (entry: Recorded) => {
    const self = {
      eq: (...a: unknown[]) => (entry.filters.push(["eq", ...a]), self),
      ilike: (...a: unknown[]) => (entry.filters.push(["ilike", ...a]), self),
      order: (...a: unknown[]) => (entry.filters.push(["order", ...a]), self),
      limit: (...a: unknown[]) => (entry.filters.push(["limit", ...a]), self),
      then: (resolve: (value: { data: unknown; error: typeof error }) => unknown) =>
        Promise.resolve({ data: error ? null : rows, error }).then(resolve),
    };
    return self;
  };
  const db = {
    from(table: string) {
      const entry: Recorded = { table, filters: [] };
      recorded.push(entry);
      return { select: () => query(entry) };
    },
    rpc(fn: string, args: Record<string, unknown>) {
      recorded.push({ rpc: fn, args, filters: [] });
      return Promise.resolve({ data: error ? null : rows, error });
    },
  } as unknown as ToolDb;
  return { db, recorded };
}

test("busca: só lojas ativas, cidade do usuário, categoria conhecida e termo escapado", async () => {
  const { db, recorded } = fakeDb([{ id: LOJA, name: "Meia-Nove" }]);

  const result = await runTool(
    db,
    "buscar_estabelecimentos",
    { categoria: "barbershop", termo: " 100%_off " },
    "cidade-1",
  );

  assert.deepEqual(result.cards, [{ kind: "establishment", id: LOJA, name: "Meia-Nove" }]);
  const filters = recorded[0]?.filters ?? [];
  assert.deepEqual(filters[0], ["eq", "status", "active"]);
  assert.deepEqual(filters[1], ["eq", "city_id", "cidade-1"]);
  assert.deepEqual(filters[2], ["eq", "category", "barbershop"]);
  assert.deepEqual(filters[3], ["ilike", "name", "%100\\%\\_off%"]);
  assert.deepEqual(filters.at(-1), ["limit", 6]);
});

test("busca: categoria inventada pelo modelo é ignorada, não repassada ao banco", async () => {
  const { db, recorded } = fakeDb([]);
  const result = await runTool(db, "buscar_estabelecimentos", { categoria: "x'; drop" }, null);
  assert.match(result.text, /Nenhuma loja/);
  assert.equal(
    (recorded[0]?.filters ?? []).some((f) => f[1] === "category"),
    false,
  );
});

test("ids que não são uuid não chegam ao banco", async () => {
  const { db, recorded } = fakeDb([]);

  const servicos = await runTool(db, "listar_servicos", { establishment_id: "1 or 1=1" }, null);
  const horarios = await runTool(
    db,
    "consultar_horarios",
    { establishment_id: LOJA, service_id: undefined, data: "2026-09-30" },
    null,
  );
  const data = await runTool(
    db,
    "consultar_horarios",
    { establishment_id: LOJA, service_id: SERVICO, data: "amanhã" },
    null,
  );

  assert.match(servicos.text, /inválido/);
  assert.match(horarios.text, /inválido/);
  assert.match(data.text, /AAAA-MM-DD/);
  assert.deepEqual(recorded, [], "nenhuma consulta foi feita");
});

test("horários vêm da RPC available_slots, sem duplicata e com no máximo oito", async () => {
  const slots = Array.from({ length: 12 }, (_, i) => ({
    slot_start: `2026-09-30T${String(12 + i).padStart(2, "0")}:00:00+00:00`,
    professional_id: PROFISSIONAL,
  }));
  // O mesmo horário com outro profissional: para o usuário é a mesma oferta.
  slots.splice(1, 0, { slot_start: slots[0]!.slot_start, professional_id: "outro" });
  const { db, recorded } = fakeDb(slots);

  const result = await runTool(
    db,
    "consultar_horarios",
    { establishment_id: LOJA, service_id: SERVICO, data: "2026-09-30" },
    null,
  );

  assert.deepEqual(recorded[0], {
    rpc: "available_slots",
    args: { p_establishment_id: LOJA, p_service_id: SERVICO, p_date: "2026-09-30" },
    filters: [],
  });
  assert.equal(result.cards.length, 8);
  const starts = result.cards.map((c) => (c as { slot_start: string }).slot_start);
  assert.equal(new Set(starts).size, 8);
  assert.deepEqual(result.cards[0], {
    kind: "slot",
    establishment_id: LOJA,
    service_id: SERVICO,
    professional_id: PROFISSIONAL,
    slot_start: slots[0]!.slot_start,
  });
});

test("erro do banco não é repassado ao modelo", async (t) => {
  t.mock.method(console, "error", () => {});
  const { db } = fakeDb(null, { message: 'permission denied for table "services"' });

  const result = await runTool(db, "listar_servicos", { establishment_id: LOJA }, null);

  assert.doesNotMatch(result.text, /permission denied|services/);
  assert.deepEqual(result.cards, []);
});

test("ferramenta que não existe devolve aviso em vez de lançar", async () => {
  const { db, recorded } = fakeDb([]);
  const result = await runTool(db, "reservar_horario", {}, null);
  assert.match(result.text, /desconhecida/);
  assert.deepEqual(recorded, []);
});
