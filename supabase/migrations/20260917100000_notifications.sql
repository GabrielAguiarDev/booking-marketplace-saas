-- ---------------------------------------------------------------------------
-- Avisos: aparelhos, caixa de saída e os eventos que a enchem (N6)
-- ---------------------------------------------------------------------------
-- Até aqui nenhum aviso saía. Os eventos já existiam — reserva nova, fila
-- chamando, chamado respondido, decisão de cadastro — mas morriam na tabela,
-- e a fila só andava com o app aberto.
--
-- O desenho tem três peças, e só a última fala com provedor:
--
--   1. `push_devices` — o token Expo de cada aparelho, gravado pelo próprio
--      app por RPC (`register_push_device`).
--   2. `notification_outbox` — uma linha por aviso a entregar, escrita SÓ por
--      gatilhos e funções do banco, na mesma transação do evento. Se a reserva
--      não gravou, o aviso não existe; se gravou, o aviso não se perde.
--   3. A Edge Function `notifications-dispatch` — reivindica lotes da caixa,
--      entrega por Expo Push / e-mail e devolve o resultado. Ela é chamada pelo
--      `pg_cron` a cada minuto (via `pg_net`), com URL e segredo guardados no
--      Vault. Sem esses dois segredos o cron não chama nada, e a caixa acumula
--      com status `pending` — visível, não perdido.
--
-- Canal sem provedor configurado não queima tentativa: a linha vai para
-- `unconfigured` e volta à fila sozinha no primeiro despacho com o provedor
-- ligado. Nenhuma credencial mora aqui.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create type public.notification_channel as enum ('push', 'email', 'sms', 'whatsapp');

create type public.notification_status as enum (
  'pending',       -- esperando o próximo despacho
  'sending',       -- reivindicada por um despacho em andamento
  'sent',          -- o provedor aceitou
  'failed',        -- esgotou as tentativas ou erro permanente
  'unconfigured',  -- o canal não tem provedor configurado; volta sozinha
  'skipped'        -- não havia para onde mandar (sem aparelho, sem e-mail)
);

-- Qual app recebe o push. A mesma pessoa pode ter o app do cliente e o da loja
-- no mesmo telefone, e o aviso "novo cliente na fila" não é para o primeiro.
create type public.notification_app as enum ('cliente', 'staff');

-- ---------------------------------------------------------------------------
-- Aparelhos
-- ---------------------------------------------------------------------------

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_token text not null,
  app public.notification_app not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_name text check (device_name is null or char_length(device_name) <= 80),
  last_seen_at timestamptz not null default now(),
  -- Preenchido quando o Expo responde `DeviceNotRegistered` ou a pessoa sai da
  -- conta. A linha fica para a auditoria de entrega; o despacho a ignora.
  disabled_at timestamptz,
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_token_key unique (expo_token),
  constraint push_devices_token_format
    check (expo_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$')
);

comment on table public.push_devices is
  'Token Expo por aparelho. Escrita só por register_push_device/unregister_push_device; o despacho desliga token recusado pelo Expo.';

create index push_devices_user_idx on public.push_devices (user_id, app) where disabled_at is null;

create trigger push_devices_set_updated_at
  before update on public.push_devices
  for each row execute function public.set_updated_at();

alter table public.push_devices enable row level security;

create policy push_devices_select_own
  on public.push_devices for select
  to authenticated
  using (user_id = (select auth.uid()));

-- O token é do aparelho, não da pessoa: quando outra conta entra no mesmo
-- telefone, o token muda de dono. Sem isso a conta anterior continuaria
-- recebendo o aviso da nova.
create function public.register_push_device(
  p_expo_token text,
  p_app public.notification_app,
  p_platform text,
  p_device_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_token text := btrim(coalesce(p_expo_token, ''));
  l_id uuid;
begin
  if l_uid is null then
    raise exception 'Entre na sua conta para receber avisos.' using errcode = '42501';
  end if;
  if l_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Token de aviso inválido.' using errcode = 'P0001';
  end if;
  if p_app is null then
    raise exception 'Informe o app.' using errcode = 'P0001';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android', 'web') then
    raise exception 'Plataforma inválida.' using errcode = 'P0001';
  end if;

  insert into public.push_devices (user_id, expo_token, app, platform, device_name)
  values (l_uid, l_token, p_app, p_platform, nullif(left(btrim(coalesce(p_device_name, '')), 80), ''))
  on conflict (expo_token) do update
  set user_id = excluded.user_id,
      app = excluded.app,
      platform = excluded.platform,
      device_name = coalesce(excluded.device_name, public.push_devices.device_name),
      last_seen_at = now(),
      disabled_at = null,
      disabled_reason = null
  returning id into l_id;

  return l_id;
end;
$$;

-- Chamado ao sair da conta. Token de outra pessoa não é revelado nem desligado.
create function public.unregister_push_device(p_expo_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Entre na sua conta.' using errcode = '42501';
  end if;
  update public.push_devices d
  set disabled_at = now(), disabled_reason = 'signed_out'
  where d.expo_token = btrim(coalesce(p_expo_token, ''))
    and d.user_id = (select auth.uid())
    and d.disabled_at is null;
end;
$$;

revoke execute on function public.register_push_device(text, public.notification_app, text, text)
  from public, anon;
grant execute on function public.register_push_device(text, public.notification_app, text, text)
  to authenticated, service_role;
revoke execute on function public.unregister_push_device(text) from public, anon;
grant execute on function public.unregister_push_device(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Caixa de saída
-- ---------------------------------------------------------------------------

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  -- Destinatário com conta. Nulo só para convidado de balcão (telefone) ou
  -- e-mail avulso.
  user_id uuid references public.profiles (id) on delete cascade,
  email text,
  phone text,
  channel public.notification_channel not null,
  app public.notification_app,
  -- O tipo do evento, estável, para o app rotear o toque ("queue_called").
  kind text not null check (kind ~ '^[a-z][a-z0-9_]{2,40}$'),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 1000),
  data jsonb not null default '{}'::jsonb,
  -- O mesmo evento não vira dois avisos (gatilho reexecutado, cron repetido).
  dedupe_key text,
  establishment_id uuid references public.establishments (id) on delete set null,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_dedupe_key unique (dedupe_key),
  constraint notification_outbox_has_target
    check (user_id is not null or email is not null or phone is not null),
  constraint notification_outbox_push_has_app
    check (channel <> 'push' or (app is not null and user_id is not null))
);

comment on table public.notification_outbox is
  'Avisos a entregar. Escrita só pelo banco (gatilhos) e pelo despacho (service role). O destinatário lê os próprios.';

create index notification_outbox_due_idx
  on public.notification_outbox (channel, available_at)
  where status in ('pending', 'unconfigured', 'sending');
create index notification_outbox_user_idx on public.notification_outbox (user_id, created_at desc);
create index notification_outbox_establishment_idx on public.notification_outbox (establishment_id);

create trigger notification_outbox_set_updated_at
  before update on public.notification_outbox
  for each row execute function public.set_updated_at();

alter table public.notification_outbox enable row level security;

-- Quem recebe vê os próprios avisos — é a base de uma caixa de entrada no app.
create policy notification_outbox_select_own
  on public.notification_outbox for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Enfileirar
-- ---------------------------------------------------------------------------
-- Interna: só gatilho e função do banco chamam. `on conflict do nothing` pela
-- chave de deduplicação — reexecutar o evento não repete o aviso.

create function public.notify_enqueue(
  p_user_id uuid,
  p_channel public.notification_channel,
  p_kind text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb,
  p_app public.notification_app default null,
  p_dedupe_key text default null,
  p_establishment_id uuid default null,
  p_email text default null,
  p_phone text default null,
  p_available_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null and p_email is null and p_phone is null then
    return;
  end if;
  insert into public.notification_outbox (
    user_id, email, phone, channel, app, kind, title, body, data, dedupe_key, establishment_id,
    available_at
  ) values (
    p_user_id, p_email, p_phone, p_channel, p_app, p_kind,
    left(p_title, 120), left(p_body, 1000), coalesce(p_data, '{}'::jsonb),
    case when p_dedupe_key is null then null else p_dedupe_key || ':' || p_channel::text end,
    p_establishment_id, coalesce(p_available_at, now())
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke execute on function public.notify_enqueue(
  uuid, public.notification_channel, text, text, text, jsonb, public.notification_app, text, uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.notify_enqueue(
  uuid, public.notification_channel, text, text, text, jsonb, public.notification_app, text, uuid, text, text, timestamptz
) to service_role;

-- Quem da loja recebe um evento, respeitando `member_notification_prefs`. Sem
-- linha de preferência vale o padrão da tabela (os três primeiros ligados, o
-- resumo desligado). Dono e gerência recebem tudo da loja; a equipe só o que é
-- da cadeira dela (ou o que não tem cadeira). Quem causou o evento não é
-- avisado do que acabou de fazer.
create function public.notification_staff_recipients(
  p_establishment_id uuid,
  p_pref text,
  p_professional_id uuid default null
)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id
  from public.establishment_members m
  left join public.member_notification_prefs np
    on np.user_id = m.user_id and np.establishment_id = m.establishment_id
  where m.establishment_id = p_establishment_id
    and m.user_id is distinct from (select auth.uid())
    and case p_pref
      when 'new_appointment' then coalesce(np.notify_new_appointment, true)
      when 'cancellation' then coalesce(np.notify_cancellation, true)
      when 'queue_join' then coalesce(np.notify_queue_join, true)
      when 'daily_summary' then coalesce(np.notify_daily_summary, false)
      when 'always' then true
      else false
    end
    and (
      m.role in ('owner', 'manager')
      or p_professional_id is null
      or exists (
        select 1 from public.professionals p
        where p.id = p_professional_id and p.user_id = m.user_id
      )
    );
$$;

revoke execute on function public.notification_staff_recipients(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.notification_staff_recipients(uuid, text, uuid) to service_role;

-- O cliente escolhe o que aceita receber. Aqui a resposta é sempre "sim"; a
-- migration das preferências do cliente (`customer_notification_prefs`, que
-- nasce depois desta) substitui o corpo para ler a escolha da pessoa.
create function public.notification_customer_allows(p_user_id uuid, p_pref text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null;
$$;

revoke execute on function public.notification_customer_allows(uuid, text)
  from public, anon, authenticated;

-- "18/09 às 14:30", no fuso da loja.
create function public.notification_when(p_at timestamptz, p_establishment_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select to_char(
    p_at at time zone coalesce(
      (select e.timezone from public.establishments e where e.id = p_establishment_id),
      'America/Sao_Paulo'
    ),
    'DD/MM "às" HH24:MI'
  );
$$;

revoke execute on function public.notification_when(timestamptz, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Eventos: reservas
-- ---------------------------------------------------------------------------

create function public.notify_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_est public.establishments;
  l_service text;
  l_who text;
  l_when text;
  l_user uuid;
  l_data jsonb;
begin
  select * into l_est from public.establishments e where e.id = new.establishment_id;
  select s.name into l_service from public.services s where s.id = new.service_id;
  l_who := coalesce(
    nullif(new.guest_name, ''),
    (select nullif(p.full_name, '') from public.profiles p where p.id = new.customer_id),
    'Cliente'
  );
  l_when := public.notification_when(new.starts_at, new.establishment_id);
  l_data := jsonb_build_object(
    'type', 'appointment',
    'appointment_id', new.id,
    'establishment_id', new.establishment_id
  );

  if tg_op = 'INSERT' then
    for l_user in
      select * from public.notification_staff_recipients(new.establishment_id, 'new_appointment', new.professional_id)
    loop
      perform public.notify_enqueue(
        l_user, 'push', 'appointment_new',
        case when new.status = 'scheduled' then 'Reserva para aprovar' else 'Nova reserva' end,
        l_who || ' · ' || coalesce(l_service, 'serviço') || ' · ' || l_when,
        l_data, 'staff', 'appointment_new:' || new.id || ':' || l_user, new.establishment_id
      );
    end loop;

    if new.status = 'confirmed'
      and public.notification_customer_allows(new.customer_id, 'appointment_changes')
    then
      perform public.notify_enqueue(
        new.customer_id, 'push', 'appointment_confirmed', 'Reserva confirmada',
        coalesce(l_service, 'Seu horário') || ' em ' || l_est.name || ', ' || l_when || '.',
        l_data, 'cliente', 'appointment_confirmed:' || new.id, new.establishment_id
      );
    end if;
    return new;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then
    if new.status = 'cancelled_by_customer' then
      for l_user in
        select * from public.notification_staff_recipients(new.establishment_id, 'cancellation', new.professional_id)
      loop
        perform public.notify_enqueue(
          l_user, 'push', 'appointment_cancelled', 'Reserva cancelada',
          l_who || ' cancelou ' || coalesce(l_service, 'o horário') || ' de ' || l_when || '.',
          l_data, 'staff', 'appointment_cancelled:' || new.id || ':' || l_user, new.establishment_id
        );
      end loop;
    elsif new.status = 'confirmed' and old.status = 'scheduled'
      and public.notification_customer_allows(new.customer_id, 'appointment_changes')
    then
      perform public.notify_enqueue(
        new.customer_id, 'push', 'appointment_confirmed', 'Reserva confirmada',
        l_est.name || ' confirmou ' || coalesce(l_service, 'seu horário') || ', ' || l_when || '.',
        l_data, 'cliente', 'appointment_confirmed:' || new.id, new.establishment_id
      );
    elsif new.status = 'cancelled_by_establishment'
      and public.notification_customer_allows(new.customer_id, 'appointment_changes')
    then
      perform public.notify_enqueue(
        new.customer_id, 'push', 'appointment_declined', 'Reserva cancelada pela loja',
        l_est.name || ' cancelou ' || coalesce(l_service, 'seu horário') || ' de ' || l_when
          || coalesce(': ' || nullif(new.cancellation_reason, ''), '.'),
        l_data, 'cliente', 'appointment_declined:' || new.id, new.establishment_id
      );
      perform public.notify_enqueue(
        new.customer_id, 'email', 'appointment_declined', 'Sua reserva foi cancelada',
        l_est.name || ' cancelou ' || coalesce(l_service, 'seu horário') || ' de ' || l_when
          || coalesce('. Motivo: ' || nullif(new.cancellation_reason, '') || '.', '.')
          || ' Abra o app Vez para escolher outro horário.',
        l_data, null, 'appointment_declined:' || new.id, new.establishment_id
      );
    end if;
  elsif new.starts_at is distinct from old.starts_at
    and new.status in ('scheduled', 'confirmed')
    and public.notification_customer_allows(new.customer_id, 'appointment_changes')
  then
    perform public.notify_enqueue(
      new.customer_id, 'push', 'appointment_rescheduled', 'Reserva remarcada',
      coalesce(l_service, 'Seu horário') || ' em ' || l_est.name || ' agora é ' || l_when || '.',
      l_data, 'cliente', 'appointment_rescheduled:' || new.id || ':' || extract(epoch from new.starts_at)::bigint,
      new.establishment_id
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.notify_appointment_event() from public, anon, authenticated, service_role;

create trigger appointments_notify_insert
  after insert on public.appointments
  for each row execute function public.notify_appointment_event();

create trigger appointments_notify_update
  after update of status, starts_at on public.appointments
  for each row execute function public.notify_appointment_event();

-- ---------------------------------------------------------------------------
-- Eventos: fila
-- ---------------------------------------------------------------------------
-- `queue_notify_enabled` e `queue_notify_channel` passam a atuar aqui: quando a
-- equipe chama (status → 'called'), o cliente é avisado pelo canal escolhido.
-- SMS e WhatsApp não têm provedor ainda — a linha nasce e fica `unconfigured`,
-- o que é diferente de fingir que foi. Convidado de balcão só é alcançável por
-- telefone; em push, não há para onde mandar.

create function public.notify_queue_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_est public.establishments;
  l_settings public.establishment_settings;
  l_who text;
  l_user uuid;
  l_data jsonb;
  l_channel public.notification_channel;
begin
  select * into l_est from public.establishments e where e.id = new.establishment_id;
  l_data := jsonb_build_object(
    'type', 'queue',
    'queue_entry_id', new.id,
    'establishment_id', new.establishment_id
  );

  if tg_op = 'INSERT' then
    if new.source in ('app', 'qr') then
      l_who := coalesce(
        (select nullif(p.full_name, '') from public.profiles p where p.id = new.customer_id),
        'Cliente'
      );
      for l_user in
        select * from public.notification_staff_recipients(new.establishment_id, 'queue_join', new.professional_id)
      loop
        perform public.notify_enqueue(
          l_user, 'push', 'queue_join', 'Novo cliente na fila',
          l_who || case when new.source = 'qr' then ' entrou pelo QR do balcão.' else ' entrou pelo app.' end,
          l_data, 'staff', 'queue_join:' || new.id || ':' || l_user, new.establishment_id
        );
      end loop;
    end if;
    return new;
  end if;

  if new.status = 'called' and old.status is distinct from 'called' then
    select * into l_settings from public.establishment_settings s where s.establishment_id = new.establishment_id;
    if not coalesce(l_settings.queue_notify_enabled, true) then
      return new;
    end if;
    -- Quem tem conta e desligou "minha vez na fila" não recebe; o convidado de
    -- balcão não tem onde desligar e deixou o telefone para isso.
    if new.customer_id is not null
      and not public.notification_customer_allows(new.customer_id, 'queue_turn')
    then
      return new;
    end if;
    l_channel := coalesce(l_settings.queue_notify_channel, 'push')::text::public.notification_channel;

    if l_channel = 'push' then
      if new.customer_id is not null then
        perform public.notify_enqueue(
          new.customer_id, 'push', 'queue_called', 'É a sua vez',
          l_est.name || ' está chamando você. Vá até o balcão.',
          l_data, 'cliente', 'queue_called:' || new.id || ':' || coalesce(extract(epoch from new.called_at)::bigint, 0),
          new.establishment_id
        );
      end if;
    else
      perform public.notify_enqueue(
        new.customer_id, l_channel, 'queue_called', 'É a sua vez',
        l_est.name || ': é a sua vez. Vá até o balcão.',
        l_data, null, 'queue_called:' || new.id || ':' || coalesce(extract(epoch from new.called_at)::bigint, 0),
        new.establishment_id, null,
        coalesce(
          nullif(new.guest_phone, ''),
          (select nullif(p.phone, '') from public.profiles p where p.id = new.customer_id)
        )
      );
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.notify_queue_event() from public, anon, authenticated, service_role;

create trigger queue_entries_notify_insert
  after insert on public.queue_entries
  for each row execute function public.notify_queue_event();

create trigger queue_entries_notify_update
  after update of status on public.queue_entries
  for each row execute function public.notify_queue_event();

-- ---------------------------------------------------------------------------
-- Eventos: suporte, cadastro, moderação e interessados
-- ---------------------------------------------------------------------------

-- Resposta da equipe chega a quem abriu, por push e por e-mail. Chamado da
-- loja também chega por push a quem abriu, no app da loja.
create function public.notify_support_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_ticket public.support_tickets;
  l_data jsonb;
begin
  if not new.from_staff then
    return new;
  end if;
  select * into l_ticket from public.support_tickets t where t.id = new.ticket_id;
  if l_ticket.requester_id is null then
    return new;
  end if;
  l_data := jsonb_build_object('type', 'support_ticket', 'ticket_id', l_ticket.id, 'number', l_ticket.number);

  perform public.notify_enqueue(
    l_ticket.requester_id, 'push', 'support_reply', 'Resposta do suporte',
    'Chamado #' || l_ticket.number || ': ' || left(new.body, 140),
    l_data,
    case when l_ticket.requester_kind = 'establishment' then 'staff' else 'cliente' end::public.notification_app,
    'support_reply:' || new.id, l_ticket.establishment_id
  );
  perform public.notify_enqueue(
    l_ticket.requester_id, 'email', 'support_reply',
    'Resposta ao chamado #' || l_ticket.number || ' — ' || l_ticket.subject,
    new.body, l_data, null, 'support_reply:' || new.id, l_ticket.establishment_id
  );
  return new;
end;
$$;

revoke execute on function public.notify_support_reply() from public, anon, authenticated, service_role;

create trigger support_ticket_messages_notify
  after insert on public.support_ticket_messages
  for each row execute function public.notify_support_reply();

-- Aprovação, recusa ou pedido de correção chega aos donos por e-mail e push.
create function public.notify_establishment_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text;
  l_title text;
  l_body text;
  l_user uuid;
  l_data jsonb;
begin
  select e.name into l_name from public.establishments e where e.id = new.establishment_id;
  l_title := case new.decision
    when 'approved' then l_name || ' foi aprovada'
    when 'rejected' then 'Cadastro de ' || l_name || ' não aprovado'
    else 'Cadastro de ' || l_name || ' precisa de correção'
  end;
  l_body := case new.decision
    when 'approved' then 'Sua loja já aparece para os clientes no app Vez.'
    when 'rejected' then 'O cadastro não foi aprovado.'
    else 'Revise o cadastro no portal e envie de novo.'
  end || coalesce(' Mensagem da equipe: ' || nullif(btrim(new.message), ''), '');
  l_data := jsonb_build_object('type', 'establishment_decision', 'establishment_id', new.establishment_id,
                               'decision', new.decision);

  for l_user in
    select m.user_id from public.establishment_members m
    where m.establishment_id = new.establishment_id and m.role = 'owner'
  loop
    perform public.notify_enqueue(l_user, 'email', 'establishment_decision', l_title, l_body, l_data,
                                  null, 'establishment_decision:' || new.id || ':' || l_user, new.establishment_id);
    perform public.notify_enqueue(l_user, 'push', 'establishment_decision', l_title, l_body, l_data,
                                  'staff', 'establishment_decision:' || new.id || ':' || l_user, new.establishment_id);
  end loop;
  return new;
end;
$$;

revoke execute on function public.notify_establishment_decision() from public, anon, authenticated, service_role;

create trigger establishment_decisions_notify
  after insert on public.establishment_decisions
  for each row execute function public.notify_establishment_decision();

-- Pedido de esclarecimento sobre uma denúncia: a loja precisava abrir o app
-- para descobrir. Agora dono e gerência recebem.
create function public.notify_review_clarification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_user uuid;
begin
  if new.status <> 'awaiting_establishment'
    or new.clarification_request is null
    or new.clarification_request is not distinct from old.clarification_request and old.status = new.status
  then
    return new;
  end if;
  for l_user in
    select m.user_id from public.establishment_members m
    where m.establishment_id = new.establishment_id and m.role in ('owner', 'manager')
  loop
    perform public.notify_enqueue(
      l_user, 'push', 'review_clarification', 'A equipe Vez pediu um esclarecimento',
      left(new.clarification_request, 200),
      jsonb_build_object('type', 'review_report', 'report_id', new.id, 'establishment_id', new.establishment_id),
      'staff', 'review_clarification:' || new.id || ':' || md5(new.clarification_request) || ':' || l_user,
      new.establishment_id
    );
  end loop;
  return new;
end;
$$;

revoke execute on function public.notify_review_clarification() from public, anon, authenticated, service_role;

create trigger review_reports_notify_clarification
  after update of status, clarification_request on public.review_reports
  for each row execute function public.notify_review_clarification();

-- Interessado novo na landing: e-mail para quem cuida da entrada (admin e
-- operações). Antes a equipe só sabia abrindo a tela.
create function public.notify_new_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_user uuid;
begin
  for l_user in
    select pa.user_id from public.platform_admins pa where pa.role in ('admin', 'operations')
  loop
    perform public.notify_enqueue(
      l_user, 'email', 'lead_new', 'Novo interessado: ' || new.establishment_name,
      new.name || ' (' || new.contact || ') quer conhecer o Vez para ' || new.establishment_name || '.'
        || coalesce(' Mensagem: ' || nullif(btrim(new.message), ''), '')
        || ' Veja em Admin › Interessados.',
      jsonb_build_object('type', 'lead', 'lead_id', new.id),
      null, 'lead_new:' || new.id || ':' || l_user
    );
  end loop;
  return new;
end;
$$;

revoke execute on function public.notify_new_lead() from public, anon, authenticated, service_role;

create trigger leads_notify_insert
  after insert on public.leads
  for each row execute function public.notify_new_lead();

-- ---------------------------------------------------------------------------
-- Resumo do dia (`notify_daily_summary`)
-- ---------------------------------------------------------------------------
-- Roda a cada 15 minutos pelo cron; manda uma vez por dia, a partir das 7h no
-- fuso da loja. A chave de deduplicação inclui a data local, então rodar de
-- novo no mesmo dia não repete.

create function public.notification_daily_summaries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_row record;
  l_user uuid;
  l_count integer := 0;
begin
  for l_row in
    select
      e.id,
      e.name,
      e.timezone,
      (now() at time zone e.timezone)::date as local_day,
      count(a.id) filter (where a.status in ('scheduled', 'confirmed')) as total,
      min(a.starts_at) filter (where a.status in ('scheduled', 'confirmed')) as first_at
    from public.establishments e
    left join public.appointments a
      on a.establishment_id = e.id
     and (a.starts_at at time zone e.timezone)::date = (now() at time zone e.timezone)::date
    where e.status = 'active'
      and extract(hour from now() at time zone e.timezone) >= 7
    group by e.id
  loop
    for l_user in
      select * from public.notification_staff_recipients(l_row.id, 'daily_summary', null)
    loop
      perform public.notify_enqueue(
        l_user, 'push', 'daily_summary', 'Hoje em ' || l_row.name,
        case
          when l_row.total = 0 then 'Nenhuma reserva marcada para hoje.'
          when l_row.total = 1 then '1 reserva hoje, às ' || to_char(l_row.first_at at time zone l_row.timezone, 'HH24:MI') || '.'
          else l_row.total || ' reservas hoje; a primeira às ' || to_char(l_row.first_at at time zone l_row.timezone, 'HH24:MI') || '.'
        end,
        jsonb_build_object('type', 'daily_summary', 'establishment_id', l_row.id, 'day', l_row.local_day),
        'staff', 'daily_summary:' || l_row.id || ':' || l_user || ':' || l_row.local_day, l_row.id
      );
      l_count := l_count + 1;
    end loop;
  end loop;
  return l_count;
end;
$$;

revoke execute on function public.notification_daily_summaries() from public, anon, authenticated;
grant execute on function public.notification_daily_summaries() to service_role;

-- ---------------------------------------------------------------------------
-- Despacho (service role — só a Edge Function `notifications-dispatch`)
-- ---------------------------------------------------------------------------

-- Canal sem provedor: a linha vai para `unconfigured`, sem gastar tentativa.
create function public.notification_hold_unconfigured(p_channels public.notification_channel[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_count integer;
begin
  update public.notification_outbox o
  set status = 'unconfigured',
      last_error = 'Canal ' || o.channel::text || ' sem provedor configurado.'
  where o.status = 'pending'
    and o.channel = any (coalesce(p_channels, '{}'))
    and o.available_at <= now();
  get diagnostics l_count = row_count;
  return l_count;
end;
$$;

-- Reivindica um lote. `skip locked` deixa dois despachos concorrentes pegarem
-- linhas diferentes; `sending` parado há mais de 10 minutos (despacho que
-- morreu no meio) volta a ser elegível. Devolve junto o e-mail da conta e os
-- tokens ativos do app certo — o despacho não precisa de outra consulta.
create function public.notification_claim(
  p_channels public.notification_channel[],
  p_limit integer default 50
)
returns table (
  id uuid,
  channel public.notification_channel,
  app public.notification_app,
  kind text,
  title text,
  body text,
  data jsonb,
  attempts integer,
  email text,
  phone text,
  expo_tokens text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select o.id
    from public.notification_outbox o
    where o.channel = any (coalesce(p_channels, '{}'))
      and (
        (o.status in ('pending', 'unconfigured') and o.available_at <= now())
        or (o.status = 'sending' and o.locked_at < now() - interval '10 minutes')
      )
    order by o.available_at
    limit least(greatest(coalesce(p_limit, 50), 1), 500)
    for update skip locked
  ),
  claimed as (
    update public.notification_outbox o
    set status = 'sending', locked_at = now(), attempts = o.attempts + 1
    from due
    where o.id = due.id
    returning o.*
  )
  select
    c.id, c.channel, c.app, c.kind, c.title, c.body, c.data, c.attempts,
    coalesce(c.email, u.email::text),
    c.phone,
    coalesce(
      (
        select array_agg(d.expo_token order by d.last_seen_at desc)
        from public.push_devices d
        where c.channel = 'push'
          and d.user_id = c.user_id
          and d.app = c.app
          and d.disabled_at is null
      ),
      '{}'
    )
  from claimed c
  left join auth.users u on u.id = c.user_id;
end;
$$;

-- Resultado do lote: [{"id", "outcome": "sent"|"retry"|"failed"|"skipped",
-- "error", "provider_message_id", "disable_tokens": [...]}]. `retry` volta à
-- fila com espera exponencial (1, 2, 4, 8… min) até `max_attempts`.
create function public.notification_complete(p_results jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_item jsonb;
  l_count integer := 0;
  l_outcome text;
begin
  for l_item in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
  loop
    l_outcome := l_item ->> 'outcome';
    update public.notification_outbox o
    set status = case
          when l_outcome = 'sent' then 'sent'
          when l_outcome = 'skipped' then 'skipped'
          when l_outcome = 'retry' and o.attempts < o.max_attempts then 'pending'
          else 'failed'
        end::public.notification_status,
        sent_at = case when l_outcome = 'sent' then now() else o.sent_at end,
        available_at = case
          when l_outcome = 'retry' then now() + make_interval(mins => power(2, greatest(o.attempts - 1, 0))::integer)
          else o.available_at
        end,
        locked_at = null,
        last_error = left(l_item ->> 'error', 500),
        provider_message_id = coalesce(l_item ->> 'provider_message_id', o.provider_message_id)
    where o.id = (l_item ->> 'id')::uuid
      and o.status = 'sending';
    l_count := l_count + 1;

    if jsonb_typeof(l_item -> 'disable_tokens') = 'array' then
      update public.push_devices d
      set disabled_at = now(), disabled_reason = 'device_not_registered'
      where d.expo_token in (select jsonb_array_elements_text(l_item -> 'disable_tokens'))
        and d.disabled_at is null;
    end if;
  end loop;
  return l_count;
end;
$$;

revoke execute on function public.notification_hold_unconfigured(public.notification_channel[])
  from public, anon, authenticated;
revoke execute on function public.notification_claim(public.notification_channel[], integer)
  from public, anon, authenticated;
revoke execute on function public.notification_complete(jsonb) from public, anon, authenticated;
grant execute on function public.notification_hold_unconfigured(public.notification_channel[]) to service_role;
grant execute on function public.notification_claim(public.notification_channel[], integer) to service_role;
grant execute on function public.notification_complete(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- O cron chama o despacho
-- ---------------------------------------------------------------------------
-- URL e segredo ficam no Vault, não aqui: o endereço muda entre local e
-- produção e o segredo não pode estar no repositório. Faltando qualquer um, a
-- função devolve 'unconfigured' e não chama nada. Ver docs/notificacoes.md.

create function public.notification_dispatch_kick()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_url text;
  l_secret text;
begin
  select s.decrypted_secret into l_url
  from vault.decrypted_secrets s where s.name = 'notifications_dispatch_url';
  select s.decrypted_secret into l_secret
  from vault.decrypted_secrets s where s.name = 'notifications_dispatch_secret';

  if nullif(l_url, '') is null or nullif(l_secret, '') is null then
    return 'unconfigured';
  end if;

  if not exists (
    select 1 from public.notification_outbox o
    where (o.status in ('pending', 'unconfigured') and o.available_at <= now())
       or (o.status = 'sending' and o.locked_at < now() - interval '10 minutes')
  ) then
    return 'idle';
  end if;

  perform net.http_post(
    url := l_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', l_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  return 'kicked';
end;
$$;

revoke execute on function public.notification_dispatch_kick() from public, anon, authenticated;
grant execute on function public.notification_dispatch_kick() to service_role;

-- Situação da caixa para o painel da plataforma: quantos avisos em cada canal
-- e status nas últimas 24h, e o último erro de cada canal.
create function public.admin_notification_health()
returns table (
  channel public.notification_channel,
  status public.notification_status,
  total integer,
  last_error text,
  oldest_due timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require(array['operations', 'support']::public.platform_role[]);
  return query
    select
      o.channel,
      o.status,
      count(*)::integer,
      (array_agg(o.last_error order by o.updated_at desc) filter (where o.last_error is not null))[1],
      min(o.available_at) filter (where o.status in ('pending', 'unconfigured'))
    from public.notification_outbox o
    where o.created_at >= now() - interval '24 hours'
       or o.status in ('pending', 'unconfigured', 'sending')
    group by o.channel, o.status
    order by o.channel, o.status;
end;
$$;

revoke execute on function public.admin_notification_health() from public, anon;
grant execute on function public.admin_notification_health() to authenticated, service_role;

select cron.schedule('notifications-dispatch', '* * * * *', 'select public.notification_dispatch_kick()');
select cron.schedule('notifications-daily-summary', '*/15 * * * *', 'select public.notification_daily_summaries()');
select cron.schedule(
  'notifications-outbox-prune',
  '17 3 * * *',
  $$delete from public.notification_outbox
    where status in ('sent', 'skipped', 'failed') and created_at < now() - interval '90 days'$$
);
