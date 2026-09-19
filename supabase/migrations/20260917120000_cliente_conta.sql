-- ===========================================================================
-- App do cliente: conta, endereços, favoritos, avisos, remarcação e exclusão
-- ===========================================================================
--
-- Tudo aqui é do domínio do cliente final. Nada altera tabela existente além
-- de ler: remarcar usa `available_slots()` e a trava `appointments_no_overlap`
-- que já existem; excluir conta anonimiza no lugar em vez de apagar.
--
--   1. customer_addresses           endereços salvos (referência de "perto de")
--   2. customer_favorites           lojas favoritas
--   3. customer_notification_prefs  o que a pessoa aceita receber de aviso
--   4. customer_reschedule_appointment()  remarcação segura pelo próprio cliente
--   5. account_deletions + customer_delete_account()  exclusão LGPD
--
-- Códigos estáveis de erro vão em `hint` (o PostgREST devolve o campo): o app
-- traduz pelo código, nunca pela mensagem.

-- ---------------------------------------------------------------------------
-- 1. Endereços
-- ---------------------------------------------------------------------------
-- Sem cidade de propósito: o MVP não mostra localidade ao cliente, e a cidade
-- de busca é resolvida sem interface. O endereço serve para a pessoa lembrar
-- onde está e como ponto de referência de distância quando ela não dá
-- permissão de localização — por isso guarda latitude/longitude, obtidas no
-- aparelho, e nunca uma cidade escolhida.

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  street text not null,
  number text,
  complement text,
  neighborhood text,
  postal_code text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_addresses_label_len check (char_length(btrim(label)) between 1 and 40),
  constraint customer_addresses_street_len check (char_length(btrim(street)) between 2 and 120),
  constraint customer_addresses_number_len check (number is null or char_length(number) <= 20),
  constraint customer_addresses_complement_len
    check (complement is null or char_length(complement) <= 80),
  constraint customer_addresses_neighborhood_len
    check (neighborhood is null or char_length(neighborhood) <= 80),
  constraint customer_addresses_postal_code_format
    check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  constraint customer_addresses_coords_pair
    check ((latitude is null) = (longitude is null)),
  constraint customer_addresses_coords_range
    check (latitude is null or (latitude between -90 and 90 and longitude between -180 and 180))
);

comment on table public.customer_addresses is
  'Endereços do cliente. Coordenadas vêm do geocoder do aparelho e servem de referência de distância quando não há permissão de localização.';

create index customer_addresses_customer_idx on public.customer_addresses (customer_id, created_at);
create unique index customer_addresses_one_default
  on public.customer_addresses (customer_id) where is_default;

create trigger customer_addresses_set_updated_at
  before update on public.customer_addresses
  for each row execute function public.set_updated_at();

-- Teto por pessoa: sem ele, a tabela vira depósito de texto livre.
create function public.customer_addresses_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.customer_addresses a where a.customer_id = new.customer_id
  ) >= 10 then
    raise exception 'Você pode guardar até 10 endereços.'
      using errcode = 'P0001', hint = 'address_limit';
  end if;
  return new;
end;
$$;

create trigger customer_addresses_limit
  before insert on public.customer_addresses
  for each row execute function public.customer_addresses_guard();

-- Marcar um como padrão desmarca os outros na mesma transação. Feito aqui, e
-- não em duas chamadas do app, para o índice único parcial nunca ver dois.
create function public.customer_set_default_address(p_address_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
begin
  if l_uid is null then
    raise exception 'Entre para continuar.' using errcode = '42501', hint = 'unauthorized';
  end if;
  if not exists (
    select 1 from public.customer_addresses a
    where a.id = p_address_id and a.customer_id = l_uid
  ) then
    raise exception 'Endereço não encontrado.' using errcode = 'P0002', hint = 'not_found';
  end if;

  update public.customer_addresses set is_default = false
  where customer_id = l_uid and is_default and id <> p_address_id;
  update public.customer_addresses set is_default = true
  where id = p_address_id;
end;
$$;

revoke execute on function public.customer_set_default_address(uuid) from public, anon;
grant execute on function public.customer_set_default_address(uuid) to authenticated, service_role;

alter table public.customer_addresses enable row level security;

create policy customer_addresses_select_own
  on public.customer_addresses for select
  to authenticated
  using (customer_id = (select auth.uid()));

create policy customer_addresses_insert_own
  on public.customer_addresses for insert
  to authenticated
  with check (customer_id = (select auth.uid()));

create policy customer_addresses_update_own
  on public.customer_addresses for update
  to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy customer_addresses_delete_own
  on public.customer_addresses for delete
  to authenticated
  using (customer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Favoritos
-- ---------------------------------------------------------------------------
-- Só loja ativa entra. Loja que sai do ar continua na lista da pessoa (a linha
-- não some), mas o app só mostra as que o `select` público de establishments
-- ainda devolve.

create table public.customer_favorites (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, establishment_id)
);

create index customer_favorites_establishment_idx
  on public.customer_favorites (establishment_id);

alter table public.customer_favorites enable row level security;

create policy customer_favorites_select_own
  on public.customer_favorites for select
  to authenticated
  using (customer_id = (select auth.uid()));

create policy customer_favorites_insert_own
  on public.customer_favorites for insert
  to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.establishments e
      where e.id = establishment_id and e.status = 'active'
    )
  );

create policy customer_favorites_delete_own
  on public.customer_favorites for delete
  to authenticated
  using (customer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Preferências de aviso
-- ---------------------------------------------------------------------------
-- Uma linha por pessoa, criada no primeiro salvar. Ausência de linha é o
-- padrão: avisos operacionais ligados, novidades desligadas (LGPD: marketing
-- só com opt-in). Quem envia aviso ao cliente deve ler esta tabela antes — o
-- app não promete canal nenhum que ainda não exista.

create table public.customer_notification_prefs (
  customer_id uuid primary key references public.profiles (id) on delete cascade,
  queue_turn boolean not null default true,
  appointment_reminder boolean not null default true,
  appointment_changes boolean not null default true,
  review_request boolean not null default true,
  marketing boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.customer_notification_prefs is
  'Opt-in/opt-out do cliente por tipo de aviso. Sem linha = padrão (operacional ligado, marketing desligado).';

create trigger customer_notification_prefs_set_updated_at
  before update on public.customer_notification_prefs
  for each row execute function public.set_updated_at();

alter table public.customer_notification_prefs enable row level security;

create policy customer_notification_prefs_select_own
  on public.customer_notification_prefs for select
  to authenticated
  using (customer_id = (select auth.uid()));

create policy customer_notification_prefs_insert_own
  on public.customer_notification_prefs for insert
  to authenticated
  with check (customer_id = (select auth.uid()));

create policy customer_notification_prefs_update_own
  on public.customer_notification_prefs for update
  to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Remarcação pelo cliente
-- ---------------------------------------------------------------------------
-- Mesmo desenho de `portal_reschedule_appointment`: o horário novo precisa
-- estar em `available_slots()` e a trava de sobreposição resolve a corrida.
-- O que muda é quem pode e quando:
--
--   * só a própria reserva, ativa e ainda no futuro;
--   * só dentro da janela sem custo da loja (`cancellation_window_minutes`):
--     remarcar em cima da hora é, para a loja, um cancelamento tardio;
--   * cliente bloqueado não escolhe horário novo (pode cancelar);
--   * preço e sinal ficam congelados — remarcar não é recomprar;
--   * a reserva volta para `scheduled`: a loja reconfirma o horário novo.

create function public.customer_reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_professional_id uuid default null
)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  professional_id uuid,
  status public.appointment_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_appointment public.appointments;
  l_timezone text;
  l_window integer;
  l_duration integer;
  l_professional uuid;
begin
  if l_uid is null then
    raise exception 'Entre para remarcar.' using errcode = '42501', hint = 'unauthorized';
  end if;

  select * into l_appointment
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  -- Reserva alheia responde igual a inexistente: não confirma id de terceiro.
  if not found or l_appointment.customer_id <> l_uid then
    raise exception 'Reserva não encontrada.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if l_appointment.status not in ('scheduled', 'confirmed')
     or l_appointment.starts_at <= now() then
    raise exception 'Esta reserva não pode mais ser remarcada.'
      using errcode = 'P0001', hint = 'not_reschedulable';
  end if;

  if exists (select 1 from public.customer_blocks b where b.user_id = l_uid) then
    raise exception 'Sua conta está bloqueada para novos horários. Fale com o suporte.'
      using errcode = 'P0001', hint = 'customer_blocked';
  end if;

  select e.timezone, e.cancellation_window_minutes, s.duration_minutes
    into l_timezone, l_window, l_duration
  from public.establishments e
  join public.services s on s.id = l_appointment.service_id
  where e.id = l_appointment.establishment_id and e.status = 'active';

  if l_timezone is null then
    raise exception 'Esta loja não está disponível.'
      using errcode = 'P0001', hint = 'establishment_unavailable';
  end if;

  if now() > l_appointment.starts_at - make_interval(mins => l_window) then
    raise exception 'O prazo para remarcar já passou. Fale com a loja ou cancele.'
      using errcode = 'P0001', hint = 'outside_window';
  end if;

  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'Escolha um horário futuro.' using errcode = 'P0001', hint = 'invalid_date';
  end if;

  l_professional := coalesce(p_professional_id, l_appointment.professional_id);

  if p_starts_at = l_appointment.starts_at and l_professional = l_appointment.professional_id then
    raise exception 'Esse já é o horário da sua reserva.'
      using errcode = 'P0001', hint = 'same_slot';
  end if;

  if not exists (
    select 1
    from public.available_slots(
      l_appointment.establishment_id,
      l_appointment.service_id,
      timezone(l_timezone, p_starts_at)::date,
      l_professional
    ) slot
    where slot.slot_start = p_starts_at and slot.professional_id = l_professional
  ) then
    raise exception 'Esse horário não está mais livre. Escolha outro.'
      using errcode = 'P0001', hint = 'slot_unavailable';
  end if;

  update public.appointments a set
    starts_at = p_starts_at,
    ends_at = p_starts_at + make_interval(mins => l_duration),
    professional_id = l_professional,
    status = 'scheduled'
  where a.id = l_appointment.id;

  return query
    select a.id, a.starts_at, a.ends_at, a.professional_id, a.status
    from public.appointments a
    where a.id = l_appointment.id;
exception
  when exclusion_violation then
    raise exception 'Alguém acabou de reservar esse horário. Escolha outro.'
      using errcode = 'P0001', hint = 'slot_taken';
end;
$$;

comment on function public.customer_reschedule_appointment(uuid, timestamptz, uuid) is
  'Remarca a reserva do próprio cliente para um horário de available_slots(), dentro da janela sem custo da loja.';

revoke execute on function public.customer_reschedule_appointment(uuid, timestamptz, uuid)
  from public, anon;
grant execute on function public.customer_reschedule_appointment(uuid, timestamptz, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Exclusão de conta (LGPD, art. 18, VI)
-- ---------------------------------------------------------------------------
-- Política: anonimizar no lugar, não apagar em cascata.
--
-- Apagar `auth.users` derrubaria em cascata reservas e avaliações — o
-- histórico da loja (agenda, faturamento, nota média) mudaria retroativamente
-- — e seria barrado por `payments.customer_id on delete restrict`. A LGPD
-- permite conservar o necessário para obrigação legal e exercício regular de
-- direitos (art. 16, I e art. 7º, VI). Então:
--
--   APAGADO     nome, telefone e foto do perfil; endereços; favoritos;
--               preferências de aviso; aparelhos de push e avisos recebidos
--               (`push_devices`, `notification_outbox`, de
--               `20260917100000_notifications.sql`); conversas com o
--               assistente; comentário escrito das avaliações; lugar em fila
--               ativa (sai da fila).
--   CANCELADO   reservas futuras ativas (liberam o horário para outra pessoa).
--   PRESERVADO  sem identificação: reservas passadas (histórico da loja),
--               nota e marcadores das avaliações (média da loja), pagamentos
--               (obrigação fiscal), chamados de suporte (defesa de direitos),
--               bloqueio por falta (prevenção a fraude).
--   AUTH        a Edge Function `delete-account` faz soft delete do usuário:
--               e-mail/telefone ofuscados, identidades removidas, sem login.
--
-- `account_deletions` é o registro de que o pedido foi atendido — prova de
-- cumprimento, sem dado pessoal.

create table public.account_deletions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  cancelled_appointments integer not null default 0,
  anonymized_reviews integer not null default 0
);

comment on table public.account_deletions is
  'Registro de exclusão de conta a pedido do titular (LGPD). Sem dado pessoal: o perfil ligado já está anonimizado.';

alter table public.account_deletions enable row level security;

create policy account_deletions_select_admin
  on public.account_deletions for select
  to authenticated
  using (public.is_platform_admin());

create function public.customer_delete_account(p_user_id uuid)
returns table (cancelled_appointments integer, anonymized_reviews integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_cancelled integer := 0;
  l_reviews integer := 0;
begin
  if p_user_id is null or not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Conta não encontrada.' using errcode = 'P0002', hint = 'not_found';
  end if;

  -- Quem opera loja ou a plataforma tem vínculo que não é só dele: excluir a
  -- conta deixaria loja sem dono ou auditoria sem autor. Esse caminho é pelo
  -- suporte, com transferência antes.
  if exists (select 1 from public.establishment_members m where m.user_id = p_user_id) then
    raise exception 'Sua conta administra uma loja. Transfira a loja antes, pelo suporte.'
      using errcode = 'P0001', hint = 'has_establishment';
  end if;
  if exists (select 1 from public.platform_admins a where a.user_id = p_user_id) then
    raise exception 'Conta da equipe da plataforma não é excluída pelo app.'
      using errcode = 'P0001', hint = 'platform_staff';
  end if;

  update public.appointments set
    status = 'cancelled_by_customer',
    cancelled_at = now(),
    cancellation_reason = 'Conta excluída pelo cliente'
  where customer_id = p_user_id
    and status in ('scheduled', 'confirmed')
    and starts_at > now();
  get diagnostics l_cancelled = row_count;

  update public.queue_entries set status = 'left'
  where customer_id = p_user_id and status in ('waiting', 'called');

  update public.reviews set comment = null
  where customer_id = p_user_id and comment is not null;
  get diagnostics l_reviews = row_count;

  delete from public.customer_addresses where customer_id = p_user_id;
  delete from public.customer_favorites where customer_id = p_user_id;
  delete from public.customer_notification_prefs where customer_id = p_user_id;
  delete from public.assistant_messages where user_id = p_user_id;
  delete from public.assistant_conversations where user_id = p_user_id;

  -- Depois dos cancelamentos acima: os gatilhos de aviso enfileiram mensagens
  -- para a própria pessoa, e elas precisam sair junto. Os avisos para a loja
  -- (horário liberado) ficam — são da loja.
  delete from public.notification_outbox where user_id = p_user_id;
  delete from public.push_devices where user_id = p_user_id;

  update public.profiles set full_name = null, phone = null, avatar_url = null
  where id = p_user_id;

  insert into public.account_deletions (user_id, cancelled_appointments, anonymized_reviews)
  values (p_user_id, l_cancelled, l_reviews)
  on conflict (user_id) do update
    set requested_at = now(),
        cancelled_appointments = public.account_deletions.cancelled_appointments + excluded.cancelled_appointments,
        anonymized_reviews = public.account_deletions.anonymized_reviews + excluded.anonymized_reviews;

  return query select l_cancelled, l_reviews;
end;
$$;

comment on function public.customer_delete_account(uuid) is
  'Anonimiza a conta do cliente (LGPD). Só a Edge Function delete-account chama, com service role, depois de conferir o JWT.';

-- Só service role: a função recebe o id por parâmetro, então exposta a
-- `authenticated` deixaria qualquer um anonimizar qualquer conta.
revoke execute on function public.customer_delete_account(uuid) from public, anon, authenticated;
grant execute on function public.customer_delete_account(uuid) to service_role;
