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
 * 4. **Aplicar bloqueios administrativos** antes de criar uma nova reserva.
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

  const { data: customerBlock, error: blockError } = await admin
    .from("customer_blocks")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (blockError) return fail("lookup_failed", "Não foi possível conferir a conta.", 500);

  let blocked = Boolean(customerBlock);
  if (!blocked) {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [settingsResult, appointmentsResult, queueResult] = await Promise.all([
      admin.from("platform_settings").select("no_show_block_threshold").eq("id", true).single(),
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", user.id)
        .eq("status", "no_show")
        .gte("starts_at", since),
      admin
        .from("queue_entries")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", user.id)
        .eq("status", "no_show")
        .gte("joined_at", since),
    ]);

    if (settingsResult.error || appointmentsResult.error || queueResult.error) {
      return fail("lookup_failed", "Não foi possível conferir a conta.", 500);
    }

    const threshold = settingsResult.data.no_show_block_threshold;
    const misses = (appointmentsResult.count ?? 0) + (queueResult.count ?? 0);
    if (misses >= threshold) {
      const { error: autoBlockError } = await admin.from("customer_blocks").upsert(
        {
          user_id: user.id,
          reason: `Bloqueio automático: ${misses} ${misses === 1 ? "falta" : "faltas"} nos últimos 30 dias.`,
        },
        { onConflict: "user_id" },
      );
      if (autoBlockError) return fail("lookup_failed", "Não foi possível conferir a conta.", 500);
      blocked = true;
    }
  }

  if (blocked) {
    return fail(
      "customer_blocked",
      "Sua conta está impedida de fazer novos agendamentos. Fale com o suporte.",
      403,
    );
  }

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

  // "Aprovar agendamentos automaticamente", da tela de regras do app do
  // estabelecimento. Desligado (o padrão), a reserva nasce 'scheduled' e espera
  // o sim da loja; ligado, já nasce 'confirmed'. A decisão é da loja e por isso
  // é lida aqui, no servidor — o app do cliente não escolhe o próprio status.
  const { data: settings } = await admin
    .from("establishment_settings")
    .select("auto_approve")
    .eq("establishment_id", establishment_id)
    .maybeSingle();

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
      status: settings?.auto_approve ? "confirmed" : "scheduled",
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
