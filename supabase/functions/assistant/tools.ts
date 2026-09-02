import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * As ferramentas que o modelo pode chamar.
 *
 * A regra que sustenta tudo: **o modelo nunca calcula horário livre**. Ele
 * chama `consultar_horarios`, que chama a RPC `available_slots`. Deixar o
 * modelo deduzir horários a partir do funcionamento da loja produziria
 * respostas plausíveis e erradas — e "plausível e errado" é exatamente o que
 * faz alguém aparecer numa barbearia que não o espera.
 */
export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "buscar_estabelecimentos",
      description:
        "Busca lojas ativas na cidade do usuário. Use quando ele descrever o que precisa " +
        "(corte, unhas, dermatologista) ou citar um nome. Devolve id, nome, categoria e nota.",
      parameters: {
        type: "object",
        properties: {
          termo: { type: "string", description: "Parte do nome da loja, se ele citou um." },
          categoria: {
            type: "string",
            enum: [
              "barbershop",
              "salon",
              "nail_salon",
              "aesthetic_clinic",
              "dermatology",
              "dentistry",
              "petshop",
              "massage",
            ],
          },
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

export type ToolResult = { text: string; cards: unknown[] };

export async function runTool(
  db: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  cityId: string | null,
): Promise<ToolResult> {
  if (name === "buscar_estabelecimentos") {
    let query = db
      .from("establishments")
      .select("id, name, category, neighborhood, rating_avg, rating_count, booking_mode")
      .eq("status", "active")
      .limit(6);

    if (cityId) query = query.eq("city_id", cityId);
    if (typeof args.categoria === "string") query = query.eq("category", args.categoria);
    if (typeof args.termo === "string" && args.termo.trim()) {
      query = query.ilike("name", `%${args.termo.trim()}%`);
    }

    const { data, error } = await query;
    if (error) return { text: `Erro na busca: ${error.message}`, cards: [] };
    if (!data || data.length === 0) {
      return { text: "Nenhuma loja encontrada com esse critério nesta cidade.", cards: [] };
    }
    return {
      text: JSON.stringify(data),
      cards: data.map((row) => ({ kind: "establishment", ...row })),
    };
  }

  if (name === "listar_servicos") {
    const { data, error } = await db
      .from("services")
      .select("id, name, duration_minutes, price_cents")
      .eq("establishment_id", String(args.establishment_id))
      .eq("is_active", true)
      .order("sort_order");

    if (error) return { text: `Erro: ${error.message}`, cards: [] };
    if (!data || data.length === 0)
      return { text: "Esta loja não tem serviços publicados.", cards: [] };
    return { text: JSON.stringify(data), cards: [] };
  }

  if (name === "consultar_horarios") {
    const { data, error } = await db.rpc("available_slots", {
      p_establishment_id: String(args.establishment_id),
      p_service_id: String(args.service_id),
      p_date: String(args.data),
    });

    if (error) return { text: `Erro ao consultar agenda: ${error.message}`, cards: [] };

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
    const primeiros = [...porHorario.values()].slice(0, 8);
    return {
      text: JSON.stringify(primeiros.map((s) => s.slot_start)),
      cards: primeiros.map((s) => ({
        kind: "slot",
        establishment_id: String(args.establishment_id),
        service_id: String(args.service_id),
        professional_id: s.professional_id,
        slot_start: s.slot_start,
      })),
    };
  }

  return { text: `Ferramenta desconhecida: ${name}`, cards: [] };
}
