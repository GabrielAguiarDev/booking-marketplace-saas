import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";
import { answer, parseRequest } from "./core.ts";
import { createCompleter } from "./openai.ts";
import { createStore, type StoreDb } from "./store.ts";
import { runTool, type ToolDb, TOOL_SCHEMAS } from "./tools.ts";

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
 *
 * Este arquivo só liga as pontas. O turno em si (cota, laço de ferramentas,
 * devolução da reserva) está em `core.ts`; a gravação, em `store.ts`. Nenhum
 * dos dois depende do runtime, e ambos são testados em
 * `packages/supabase/test/assistant*.test.ts`.
 *
 * Dois clientes, e a divisão importa:
 *   - `asAdmin` grava cota e histórico, pelas RPCs `assistant_*_turn`, que só a
 *     chave secreta executa. O cliente não escreve nessas tabelas.
 *   - `asUser` roda as ferramentas, sob a RLS de quem perguntou.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const userClient = asUser(req);
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return fail("unauthorized", "Entre para usar o assistente.", 401);

  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) {
    // Falta de configuração é diferente de falha: a tela precisa dizer "o
    // assistente não está configurado", não "algo deu errado". E vem antes da
    // reserva: sem chave, nenhuma pergunta gasta cota.
    return fail(
      "assistant_not_configured",
      "O assistente ainda não está configurado neste ambiente.",
      503,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) return json(parsed.response.body, parsed.response.status);
  const request = parsed.request;

  const admin = asAdmin();

  // A cidade vem do app e é conferida sob a RLS: cidade inativa ou inventada
  // vira "sem filtro de cidade", não um filtro que esconde tudo.
  let cityId: string | null = null;
  if (request.cityId) {
    const { data } = await userClient
      .from("cities")
      .select("id")
      .eq("id", request.cityId)
      .maybeSingle();
    cityId = data?.id ?? null;
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const response = await answer(
    {
      today,
      log: (message, cause) => console.error(message, cause),
      complete: createCompleter({
        apiKey,
        // Configuráveis para trocar de modelo sem mexer em código — inclusive
        // para um mais barato quando o crédito de teste apertar.
        baseUrl: env("OPENAI_BASE_URL"),
        model: env("OPENAI_MODEL"),
        tools: TOOL_SCHEMAS,
      }),
      // Os casts (aqui e no armazenamento) são só de tipo: comparar o
      // construtor de consultas genérico do supabase-js com o contrato mínimo
      // destes módulos estoura a profundidade do verificador. Os métodos
      // usados existem nos dois, e o teste de integração roda os mesmos
      // módulos com o cliente de verdade.
      runTool: (name, args) => runTool(userClient as unknown as ToolDb, name, args, cityId),

      ...createStore(admin as unknown as StoreDb, user.id),
    },
    request,
  );

  return json(response.body, response.status);
});

/**
 * Lê a variável tratando "declarada e vazia" como ausente: `VAR=` no .env
 * chega como string vazia, não como undefined.
 */
function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}
