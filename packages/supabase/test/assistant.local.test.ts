import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  answer,
  type AssistantDeps,
  type Completion,
  ModelError,
} from "../../../supabase/functions/assistant/core.ts";
import { createStore, type StoreDb } from "../../../supabase/functions/assistant/store.ts";
import { runTool, type ToolDb } from "../../../supabase/functions/assistant/tools.ts";

/**
 * O assistente contra o Supabase LOCAL de verdade — banco, RLS e RPCs —, com
 * o modelo trocado por um roteiro. Nenhuma chamada sai para a OpenAI.
 *
 * São os mesmos módulos que a Edge Function liga (`core`, `store`, `tools`);
 * só o Deno e o `fetch` do modelo ficam de fora.
 *
 * Roda só com o banco local no ar e a demo carregada:
 *
 *   eval "$(pnpm exec supabase status -o env)" && \
 *     API_URL=$API_URL ANON_KEY=$ANON_KEY SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
 *     pnpm --filter @vez/supabase test
 *
 * Sem essas variáveis o arquivo inteiro é pulado — `pnpm test` continua
 * passando em máquina sem Docker.
 */

const url = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceKey = process.env.SERVICE_ROLE_KEY;
const local = Boolean(url && anonKey && serviceKey && /127\.0\.0\.1|localhost/.test(url));
const skip = local ? false : "Supabase local não configurado (API_URL, ANON_KEY, SERVICE_ROLE_KEY)";

const LOJA = "0a000000-0000-4000-8000-000000000001";
const SERVICO = "0b000000-0000-4000-8000-000000000001";
const DAY_LIMIT = 20;

const options = { auth: { persistSession: false, autoRefreshToken: false } };
let admin: SupabaseClient;
let user: SupabaseClient;
let userId = "";

/** Uma data de semana daqui a alguns dias: a demo não abre todo dia. */
function nextWeekday(): string {
  const date = new Date(Date.now() + 3 * 86_400_000);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 1 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

const texto = (content: string): Completion => ({
  content,
  toolCalls: [],
  model: "roteiro",
  promptTokens: 50,
  completionTokens: 5,
});

const ferramenta = (name: string, args: unknown): Completion => ({
  content: null,
  toolCalls: [
    { id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
  ],
  model: "roteiro",
  promptTokens: 50,
  completionTokens: 5,
});

function deps(script: (Completion | Error)[]): AssistantDeps {
  const steps = [...script];
  return {
    today: new Date().toISOString().slice(0, 10),
    ...createStore(admin as unknown as StoreDb, userId),
    runTool: (name, args) => runTool(user as unknown as ToolDb, name, args, null),
    async complete() {
      const step = steps.shift() ?? texto("Pronto.");
      if (step instanceof Error) throw step;
      return step;
    },
  };
}

const ask = (script: (Completion | Error)[], message: string, conversationId: string | null) =>
  answer(deps(script), { message, conversationId, cityId: null });

async function usage() {
  const { data, error } = await user.rpc("assistant_usage_today");
  assert.equal(error, null);
  return (data as { used: number; remaining: number; day_limit: number }[])[0]!;
}

before(async () => {
  if (!local) return;
  admin = createClient(url!, serviceKey!, options);
  user = createClient(url!, anonKey!, options);

  // Conta descartável: o teste não encosta nas contas da demo nem deixa rastro.
  const email = `assistente-${randomUUID()}@vez.local`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null);
  userId = created.data.user!.id;
  const signedIn = await user.auth.signInWithPassword({ email, password });
  assert.equal(signedIn.error, null);
});

after(async () => {
  if (!local || !userId) return;
  // Apagar a conta leva perfil, conversas e registro de uso em cascata.
  await admin.auth.admin.deleteUser(userId);
});

test("turno completo: ferramentas sob RLS, resposta e consumo gravados", { skip }, async () => {
  const data = nextWeekday();
  const response = await ask(
    [
      ferramenta("buscar_estabelecimentos", { categoria: "barbershop" }),
      ferramenta("listar_servicos", { establishment_id: LOJA }),
      ferramenta("consultar_horarios", { establishment_id: LOJA, service_id: SERVICO, data }),
      texto("Achei horários perto de você."),
    ],
    "tem corte nessa semana?",
    null,
  );

  assert.equal(response.status, 200);
  const body = response.body as {
    conversation_id: string;
    reply: string;
    cards: { kind: string; id?: string; slot_start?: string }[];
    remaining: number;
  };
  assert.equal(body.reply, "Achei horários perto de você.");
  assert.equal(body.remaining, DAY_LIMIT - 1);

  // A loja da demo veio da busca feita com o cliente do usuário.
  assert.ok(body.cards.some((card) => card.kind === "establishment" && card.id === LOJA));

  // Todo horário oferecido existe em `available_slots`: o assistente não inventa.
  const { data: slots } = await user.rpc("available_slots", {
    p_establishment_id: LOJA,
    p_service_id: SERVICO,
    p_date: data,
  });
  const livres = new Set(
    ((slots ?? []) as { slot_start: string }[]).map((s) => new Date(s.slot_start).getTime()),
  );
  const oferecidos = body.cards.filter((card) => card.kind === "slot");
  assert.ok(livres.size > 0, "a demo precisa ter horário livre para o teste valer");
  assert.ok(oferecidos.length > 0 && oferecidos.length <= 8);
  for (const card of oferecidos) {
    assert.ok(
      livres.has(new Date(card.slot_start!).getTime()),
      `horário inventado: ${card.slot_start}`,
    );
  }

  // O histórico que a tela lê, com o cliente do usuário e na ordem certa.
  const { data: messages } = await user
    .from("assistant_messages")
    .select("role, content, cards, model, prompt_tokens, completion_tokens")
    .eq("conversation_id", body.conversation_id)
    .order("created_at", { ascending: true });
  assert.deepEqual(
    (messages ?? []).map((m) => m.role),
    ["user", "assistant"],
  );
  assert.equal(messages?.[1]?.content, body.reply);
  assert.equal((messages?.[1]?.cards as unknown[]).length, body.cards.length);
  assert.equal(messages?.[1]?.model, "roteiro");
  assert.equal(messages?.[1]?.prompt_tokens, 200);
  assert.equal(messages?.[1]?.completion_tokens, 20);

  const { data: conversations } = await user.from("assistant_conversations").select("id, title");
  assert.deepEqual(conversations, [{ id: body.conversation_id, title: "tem corte nessa semana?" }]);

  assert.deepEqual(await usage(), { used: 1, remaining: DAY_LIMIT - 1, day_limit: DAY_LIMIT });
});

test(
  "modelo sem crédito: erro com código, cota devolvida, histórico intacto",
  { skip },
  async () => {
    const antes = await usage();

    const response = await ask([new ModelError("out_of_credit", "429")], "e amanhã?", null);

    assert.equal(response.status, 503);
    assert.equal(
      (response.body as { error: { code: string } }).error.code,
      "assistant_out_of_credit",
    );
    assert.deepEqual(await usage(), antes);
    const { data: conversations } = await user.from("assistant_conversations").select("id");
    assert.equal(
      conversations?.length,
      1,
      "a conversa aberta para a pergunta que falhou não sobra",
    );
    const { count } = await user
      .from("assistant_messages")
      .select("id", { count: "exact", head: true });
    assert.equal(count, 2);
  },
);

test("o usuário não reserva cota nem grava resposta por conta própria", { skip }, async () => {
  const begin = await user.rpc("assistant_begin_turn", {
    p_user_id: userId,
    p_conversation_id: null,
    p_message: "direto",
  });
  assert.equal(begin.error?.code, "42501");

  const forged = await user
    .from("assistant_messages")
    .insert({ conversation_id: randomUUID(), user_id: userId, role: "assistant", content: "x" });
  assert.equal(forged.error?.code, "42501");

  const ledger = await user
    .from("assistant_usage_daily")
    .update({ used: 0 })
    .eq("user_id", userId)
    .select();
  assert.equal(ledger.error?.code, "42501");
});

test("30 perguntas em paralelo: passam exatamente as que cabem na cota", { skip }, async () => {
  const antes = await usage();

  const responses = await Promise.all(
    Array.from({ length: 30 }, (_, i) => ask([texto("ok")], `pergunta paralela ${i}`, null)),
  );

  const aceitas = responses.filter((r) => r.status === 200).length;
  const recusadas = responses.filter(
    (r) =>
      r.status === 429 &&
      (r.body as { error: { code: string } }).error.code === "daily_limit_reached",
  ).length;
  assert.equal(aceitas, antes.remaining, "nenhuma pergunta além da cota chega ao modelo");
  assert.equal(recusadas, 30 - antes.remaining);
  assert.deepEqual(await usage(), { used: DAY_LIMIT, remaining: 0, day_limit: DAY_LIMIT });

  const { count } = await user
    .from("assistant_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user");
  assert.equal(count, DAY_LIMIT, "uma pergunta gravada por pergunta contada");
});

test("apagar o histórico inteiro não devolve a cota", { skip }, async () => {
  const removed = await user.from("assistant_conversations").delete().eq("user_id", userId);
  assert.equal(removed.error, null);
  const { count } = await user
    .from("assistant_messages")
    .select("id", { count: "exact", head: true });
  assert.equal(count, 0, "as mensagens vão junto com a conversa");

  let chamadas = 0;
  const response = await answer(
    {
      ...deps([]),
      async complete() {
        chamadas += 1;
        return texto("não deveria");
      },
    },
    { message: "mais uma", conversationId: null, cityId: null },
  );

  assert.equal(response.status, 429);
  assert.equal(chamadas, 0);
  assert.deepEqual(await usage(), { used: DAY_LIMIT, remaining: 0, day_limit: DAY_LIMIT });
});
