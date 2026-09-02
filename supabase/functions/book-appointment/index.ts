import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";

/**
 * Cria uma reserva.
 *
 * Existe como Edge Function, e não como insert direto com RLS, por três coisas
 * que a RLS não sabe fazer:
 *
 * 1. **Congelar o preço.** Se o cliente inserisse a linha, ele escolheria
 *    `price_cents`. O preço tem que vir do serviço, lido no servidor.
 * 2. **Validar o horário.** O slot precisa ser um dos que `available_slots()`
 *    devolve — não qualquer timestamp que caiba na tabela.
 * 3. **Calcular o sinal** a partir da política da loja.
 *
 * A corrida entre dois clientes no mesmo horário NÃO é resolvida aqui: é
 * resolvida pela constraint de exclusão `appointments_no_overlap`. Esta função
 * só traduz o 23P01 numa mensagem que a tela sabe mostrar.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const {
    data: { user },
  } = await asUser(req).auth.getUser();
  if (!user) return fail("unauthorized", "Entre para reservar.", 401);

  let body: {
    establishment_id?: string;
    service_id?: string;
    professional_id?: string;
    starts_at?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }

  const { establishment_id, service_id, professional_id, starts_at, notes } = body;
  if (!establishment_id || !service_id || !professional_id || !starts_at) {
    return fail("missing_fields", "Informe estabelecimento, serviço, profissional e horário.");
  }

  const startsAt = new Date(starts_at);
  if (Number.isNaN(startsAt.getTime())) {
    return fail("invalid_date", "Horário inválido.");
  }

  const admin = asAdmin();

  const { data: establishment, error: estError } = await admin
    .from("establishments")
    .select("id, status, timezone, deposit_percent, booking_mode")
    .eq("id", establishment_id)
    .maybeSingle();

  if (estError) return fail("lookup_failed", "Não foi possível ler a loja.", 500);
  if (!establishment || establishment.status !== "active") {
    return fail("establishment_unavailable", "Esta loja não está disponível.", 404);
  }
  if (establishment.booking_mode === "queue") {
    return fail("scheduling_disabled", "Esta loja atende só por ordem de chegada.", 409);
  }

  const { data: service } = await admin
    .from("services")
    .select("id, duration_minutes, price_cents, is_active, establishment_id")
    .eq("id", service_id)
    .maybeSingle();

  if (!service || !service.is_active || service.establishment_id !== establishment_id) {
    return fail("service_unavailable", "Este serviço não está disponível.", 404);
  }

  // A data local da loja, que é o parâmetro que `available_slots` espera.
  // Usar a data em UTC erraria o dia para qualquer reserva noturna.
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: establishment.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(startsAt);

  const { data: slots, error: slotsError } = await admin.rpc("available_slots", {
    p_establishment_id: establishment_id,
    p_service_id: service_id,
    p_date: localDate,
    p_professional_id: professional_id,
  });

  if (slotsError) return fail("availability_failed", "Não foi possível conferir a agenda.", 500);

  // Comparação por instante, não por string: o cliente pode mandar o mesmo
  // momento com outro deslocamento de fuso e continua sendo o mesmo horário.
  const wanted = startsAt.getTime();
  const match = (slots ?? []).find(
    (slot: { slot_start: string }) => new Date(slot.slot_start).getTime() === wanted,
  );

  if (!match) {
    return fail("slot_unavailable", "Esse horário não está mais livre. Escolha outro.", 409);
  }

  const priceCents = service.price_cents;
  const depositCents = Math.round((priceCents * establishment.deposit_percent) / 100);
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);

  const { data: appointment, error: insertError } = await admin
    .from("appointments")
    .insert({
      establishment_id,
      professional_id,
      service_id,
      customer_id: user.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_cents: priceCents,
      deposit_cents: depositCents,
      notes: notes ?? null,
    })
    .select("id, starts_at, ends_at, price_cents, deposit_cents, status")
    .single();

  if (insertError) {
    // 23P01: a constraint de exclusão pegou a corrida. Alguém comprou este
    // horário entre a consulta acima e este insert.
    if (insertError.code === "23P01") {
      return fail("slot_taken", "Alguém acabou de reservar esse horário. Escolha outro.", 409);
    }
    return fail("insert_failed", "Não foi possível concluir a reserva.", 500);
  }

  return json({ appointment }, 201);
});
