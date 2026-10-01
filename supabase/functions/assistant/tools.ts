import type { ToolResult } from "./core.ts";

/**
 * As ferramentas que o modelo pode chamar.
 *
 * A regra que sustenta tudo: **o modelo nunca calcula horário livre**. Ele
 * chama `consultar_horarios`, que chama a RPC `available_slots`. Deixar o
 * modelo deduzir horários a partir do funcionamento da loja produziria
 * respostas plausíveis e erradas — e "plausível e errado" é exatamente o que
 * faz alguém aparecer numa barbearia que não o espera.
 *
 * A segunda regra: as ferramentas rodam com o cliente **do usuário**, sob a
 * RLS. Os argumentos vêm do modelo, e o modelo lê texto que não controlamos
 * (a pergunta, o nome das lojas). Com a chave secreta, um `establishment_id`
 * qualquer devolveria serviço de loja pendente ou suspensa; com a RLS, o
 * assistente enxerga exatamente o que a pessoa enxerga no app.
 */

const CATEGORIES = [
  "barbershop",
  "salon",
  "nail_salon",
  "aesthetic_clinic",
  "dermatology",
  "dentistry",
  "petshop",
  "massage",
] as const;

export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "buscar_estabelecimentos",
      description:
        "Busca lojas ativas perto do usuário. Use quando ele descrever o que precisa " +
        "(corte, unhas, dermatologista) ou citar um nome. Devolve id, nome, categoria e nota.",
      parameters: {
        type: "object",
        properties: {
          termo: { type: "string", description: "Parte do nome da loja, se ele citou um." },
          categoria: { type: "string", enum: [...CATEGORIES] },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listar_servicos",
      description:
        "Lista serviços de uma loja, com duração e preço. Necessário antes de consultar horários, " +
        "porque a grade depende da duração do serviço.",
      parameters: {
        type: "object",
        properties: { establishment_id: { type: "string" } },
        required: ["establishment_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "consultar_horarios",
      description:
        "Horários realmente livres de um serviço num dia. Esta é a ÚNICA fonte de horário. " +
        "Nunca deduza horário a partir do funcionamento da loja.",
      parameters: {
        type: "object",
        properties: {
          establishment_id: { type: "string" },
          service_id: { type: "string" },
          data: { type: "string", description: "AAAA-MM-DD na data local." },
        },
        required: ["establishment_id", "service_id", "data"],
      },
    },
  },
];

type DbResult = { data: unknown; error: { message: string } | null };

interface DbQuery extends PromiseLike<DbResult> {
  eq(column: string, value: string | boolean): DbQuery;
  ilike(column: string, pattern: string): DbQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): DbQuery;
  limit(count: number): DbQuery;
}

/**
 * O pedaço do cliente Supabase que as ferramentas usam. Declarado aqui, e não
 * importado, para o arquivo não depender do runtime: a Edge Function passa o
 * cliente de verdade, o teste passa um falso.
 */
export type ToolDb = {
  from(table: string): { select(columns: string): DbQuery };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<DbResult>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Quantas lojas e quantos horários voltam: o modelo cita três de qualquer forma. */
const MAX_ESTABLISHMENTS = 6;
const MAX_SLOTS = 8;

const uuid = (value: unknown) => (typeof value === "string" && UUID.test(value) ? value : null);

/**
 * Falha de consulta vira uma frase fixa. O erro cru do Postgres não vai para o
 * modelo: ele pode repeti-lo ao usuário, e nome de tabela não é resposta.
 */
function unavailable(db: string, cause: { message: string }): ToolResult {
  console.error(`assistant: ferramenta ${db} falhou`, cause.message);
  return {
    text: "Não foi possível consultar agora. Diga ao usuário para tentar de novo.",
    cards: [],
  };
}

export async function runTool(
  db: ToolDb,
  name: string,
  args: Record<string, unknown>,
  cityId: string | null,
): Promise<ToolResult> {
  if (name === "buscar_estabelecimentos") {
    let query = db
      .from("establishments")
      .select("id, name, category, neighborhood, rating_avg, rating_count, booking_mode")
      .eq("status", "active");

    if (cityId) query = query.eq("city_id", cityId);
    // Categoria fora da lista é ignorada, não repassada: o enum do Postgres
    // recusaria o valor e a busca inteira cairia.
    if (
      typeof args.categoria === "string" &&
      (CATEGORIES as readonly string[]).includes(args.categoria)
    ) {
      query = query.eq("category", args.categoria);
    }
    if (typeof args.termo === "string" && args.termo.trim()) {
      // `%` e `_` são curingas do LIKE: sem escapar, "100%" casaria com tudo.
      const termo = args.termo
        .trim()
        .slice(0, 80)
        .replace(/[\\%_]/g, "\\$&");
      query = query.ilike("name", `%${termo}%`);
    }

    // Ordem estável: sem ela, a mesma pergunta devolvia lojas diferentes.
    const { data, error } = await query
      .order("rating_avg", { ascending: false, nullsFirst: false })
      .order("name")
      .limit(MAX_ESTABLISHMENTS);
    if (error) return unavailable("buscar_estabelecimentos", error);
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) {
      return { text: "Nenhuma loja encontrada por perto com esse critério.", cards: [] };
    }
    return {
      text: JSON.stringify(rows),
      cards: rows.map((row) => ({ kind: "establishment", ...row })),
    };
  }

  if (name === "listar_servicos") {
    const establishmentId = uuid(args.establishment_id);
    if (!establishmentId) {
      return {
        text: "establishment_id inválido. Use o id devolvido por buscar_estabelecimentos.",
        cards: [],
      };
    }
    const { data, error } = await db
      .from("services")
      .select("id, name, duration_minutes, price_cents")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("sort_order");

    if (error) return unavailable("listar_servicos", error);
    const rows = (data ?? []) as unknown[];
    if (rows.length === 0) return { text: "Esta loja não tem serviços publicados.", cards: [] };
    return { text: JSON.stringify(rows), cards: [] };
  }

  if (name === "consultar_horarios") {
    const establishmentId = uuid(args.establishment_id);
    const serviceId = uuid(args.service_id);
    if (!establishmentId || !serviceId) {
      return {
        text:
          "establishment_id ou service_id inválido. Use os ids devolvidos por " +
          "buscar_estabelecimentos e listar_servicos.",
        cards: [],
      };
    }
    if (typeof args.data !== "string" || !ISO_DATE.test(args.data)) {
      return { text: "Data inválida. Use o formato AAAA-MM-DD.", cards: [] };
    }

    const { data, error } = await db.rpc("available_slots", {
      p_establishment_id: establishmentId,
      p_service_id: serviceId,
      p_date: args.data,
    });
    if (error) return unavailable("consultar_horarios", error);

    const slots = (data ?? []) as { slot_start: string; professional_id: string }[];
    if (slots.length === 0) {
      return { text: "Nenhum horário livre nesse dia para esse serviço.", cards: [] };
    }

    // Um horário livre com dois profissionais volta duas vezes da RPC. Para o
    // usuário são a mesma oferta: "16h" aparecendo duas vezes na tela parece
    // defeito, e mandar a duplicata para o modelo ainda faz ele contar errado.
    const porHorario = new Map<string, { slot_start: string; professional_id: string }>();
    for (const slot of slots) {
      if (!porHorario.has(slot.slot_start)) porHorario.set(slot.slot_start, slot);
    }

    // Só os primeiros: mandar 30 horários de volta para o modelo gasta contexto
    // e ele vai citar três de qualquer forma.
    const primeiros = [...porHorario.values()].slice(0, MAX_SLOTS);
    return {
      text: JSON.stringify(primeiros.map((s) => s.slot_start)),
      cards: primeiros.map((s) => ({
        kind: "slot",
        establishment_id: establishmentId,
        service_id: serviceId,
        professional_id: s.professional_id,
        slot_start: s.slot_start,
      })),
    };
  }

  return { text: `Ferramenta desconhecida: ${name}`, cards: [] };
}
