-- Console de leitura da conta: uma autorização curta e auditada abre somente
-- as seções necessárias para o atendimento. A janela é conferida novamente
-- pelo banco em cada leitura; esconder a tela não seria uma barreira de acesso.

alter table public.admin_access_sessions
  add column ended_at timestamptz,
  add column ended_by uuid references public.platform_admins (user_id) on delete set null;

create index admin_access_sessions_active_admin_idx
  on public.admin_access_sessions (admin_id, establishment_id, expires_at desc)
  where ended_at is null;

comment on column public.admin_access_sessions.ended_at is
  'Encerramento antecipado da janela. Nulo não basta para acesso: expires_at também precisa estar no futuro.';

-- ---------------------------------------------------------------------------
-- Sessão: abertura, consulta e encerramento
-- ---------------------------------------------------------------------------

-- Substitui a função original para restringir o console a Suporte/Admin, fechar
-- uma janela anterior da mesma pessoa/loja e descrever o escopo real no log.
create or replace function public.admin_start_access_session(
  p_establishment_id uuid,
  p_reason text,
  p_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text;
  l_admin_name text;
  l_admin_role public.platform_role;
  l_id uuid;
begin
  perform public.admin_require(array['support']::public.platform_role[]);
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'O motivo precisa explicar o acesso — ao menos 10 letras.' using errcode = 'P0001';
  end if;
  if p_minutes not in (15, 30, 60) then
    raise exception 'A sessão dura 15, 30 ou 60 minutos.' using errcode = 'P0001';
  end if;

  select name into l_name
  from public.establishments
  where id = p_establishment_id;
  if l_name is null then
    raise exception 'Estabelecimento não encontrado.' using errcode = 'P0002';
  end if;

  select coalesce(nullif(p.full_name, ''), u.email::text), pa.role
  into l_admin_name, l_admin_role
  from public.profiles p
  join auth.users u on u.id = p.id
  join public.platform_admins pa on pa.user_id = p.id
  where p.id = (select auth.uid());

  update public.admin_access_sessions s
  set ended_at = now(), ended_by = (select auth.uid())
  where s.admin_id = (select auth.uid())
    and s.establishment_id = p_establishment_id
    and s.ended_at is null
    and s.expires_at > now();

  insert into public.admin_access_sessions (
    admin_id, admin_name, admin_role, establishment_id, establishment_name, reason, expires_at
  ) values (
    (select auth.uid()), l_admin_name, l_admin_role, p_establishment_id, l_name,
    btrim(p_reason), now() + make_interval(mins => p_minutes)
  )
  returning id into l_id;

  perform public.admin_write_audit(
    'Autorizou acesso de suporte à conta de ' || l_name,
    'somente leitura · ' || p_minutes || ' min · motivo: ' || btrim(p_reason),
    p_establishment_id,
    true
  );
  return l_id;
end;
$$;

create function public.admin_has_active_access_session(
  p_session_id uuid,
  p_establishment_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require(array['support']::public.platform_role[]);
  return exists (
    select 1
    from public.admin_access_sessions s
    where s.id = p_session_id
      and s.admin_id = (select auth.uid())
      and s.establishment_id = p_establishment_id
      and s.ended_at is null
      and s.started_at <= now()
      and s.expires_at > now()
  );
end;
$$;

create function public.admin_active_access_sessions()
returns table (
  id uuid,
  establishment_id uuid,
  establishment_name text,
  reason text,
  started_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require(array['support']::public.platform_role[]);
  return query
    select s.id, s.establishment_id, s.establishment_name, s.reason, s.started_at, s.expires_at
    from public.admin_access_sessions s
    where s.admin_id = (select auth.uid())
      and s.ended_at is null
      and s.started_at <= now()
      and s.expires_at > now()
    order by s.expires_at desc;
end;
$$;

create function public.admin_end_access_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_session public.admin_access_sessions%rowtype;
begin
  perform public.admin_require(array['support']::public.platform_role[]);

  select * into l_session
  from public.admin_access_sessions s
  where s.id = p_session_id
    and s.admin_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Sessão de acesso não encontrada.' using errcode = 'P0002';
  end if;
  if l_session.ended_at is not null then
    raise exception 'Esta sessão já foi encerrada.' using errcode = 'P0001';
  end if;

  update public.admin_access_sessions
  set ended_at = now(), ended_by = (select auth.uid())
  where id = p_session_id;

  perform public.admin_write_audit(
    'Encerrou acesso à conta de ' || l_session.establishment_name,
    'somente leitura · encerramento antecipado · motivo: ' || l_session.reason,
    l_session.establishment_id,
    true
  );
end;
$$;

-- Helper interno: as cinco leituras usam a mesma porta e recebem 42501 tanto
-- para janela ausente quanto expirada/encerrada, sem revelar outra sessão.
create function public.admin_require_active_access_session(
  p_session_id uuid,
  p_establishment_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require(array['support']::public.platform_role[]);
  if not public.admin_has_active_access_session(p_session_id, p_establishment_id) then
    raise exception 'A janela de acesso à conta não está ativa.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.admin_require_active_access_session(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Leituras do console. Cada RPC audita a seção antes de devolver os dados.
-- ---------------------------------------------------------------------------

create function public.admin_account_agenda(p_session_id uuid, p_establishment_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  customer text,
  service text,
  professional text,
  price_cents integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_timezone text;
  l_name text;
  l_today date;
begin
  perform public.admin_require_active_access_session(p_session_id, p_establishment_id);
  select e.timezone, e.name into l_timezone, l_name
  from public.establishments e where e.id = p_establishment_id;
  l_today := (now() at time zone l_timezone)::date;

  perform public.admin_write_audit(
    'Consultou a agenda da conta de ' || l_name,
    'somente leitura · seção: Agenda', p_establishment_id, true
  );

  return query
    select
      a.id, a.starts_at, a.ends_at, a.status,
      split_part(btrim(coalesce(p.full_name, a.guest_name, 'Cliente')), ' ', 1) || ' •••',
      s.name, pr.display_name, a.price_cents
    from public.appointments a
    join public.services s on s.id = a.service_id
    join public.professionals pr on pr.id = a.professional_id
    left join public.profiles p on p.id = a.customer_id
    where a.establishment_id = p_establishment_id
      and a.starts_at >= (l_today::timestamp at time zone l_timezone)
      and a.starts_at < ((l_today + 8)::timestamp at time zone l_timezone)
    order by a.starts_at;
end;
$$;

create function public.admin_account_services(p_session_id uuid, p_establishment_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  duration_minutes integer,
  price_cents integer,
  is_active boolean,
  professionals integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare l_name text;
begin
  perform public.admin_require_active_access_session(p_session_id, p_establishment_id);
  select e.name into l_name from public.establishments e where e.id = p_establishment_id;
  perform public.admin_write_audit(
    'Consultou os serviços da conta de ' || l_name,
    'somente leitura · seção: Serviços', p_establishment_id, true
  );
  return query
    select s.id, s.name, s.description, s.duration_minutes, s.price_cents, s.is_active,
      (select count(*)::integer from public.professional_services ps
       where ps.service_id = s.id)
    from public.services s
    where s.establishment_id = p_establishment_id
    order by s.is_active desc, s.sort_order, s.name;
end;
$$;

create function public.admin_account_professionals(p_session_id uuid, p_establishment_id uuid)
returns table (
  id uuid,
  name text,
  title text,
  bio text,
  is_active boolean,
  services text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare l_name text;
begin
  perform public.admin_require_active_access_session(p_session_id, p_establishment_id);
  select e.name into l_name from public.establishments e where e.id = p_establishment_id;
  perform public.admin_write_audit(
    'Consultou os profissionais da conta de ' || l_name,
    'somente leitura · seção: Profissionais', p_establishment_id, true
  );
  return query
    select pr.id, pr.display_name, pr.title, pr.bio, pr.is_active,
      array(
        select s.name
        from public.professional_services ps
        join public.services s on s.id = ps.service_id
        where ps.professional_id = pr.id
        order by s.name
      )
    from public.professionals pr
    where pr.establishment_id = p_establishment_id
    order by pr.is_active desc, pr.sort_order, pr.display_name;
end;
$$;

create function public.admin_account_settings(p_session_id uuid, p_establishment_id uuid)
returns table (
  timezone text,
  booking_mode public.booking_mode,
  cancellation_window_minutes integer,
  deposit_percent integer,
  slot_interval_minutes integer,
  min_lead_minutes integer,
  queue_remote_join boolean,
  queue_require_arrival boolean,
  queue_arrival_method public.queue_arrival_method,
  queue_per_professional boolean,
  queue_auto_close boolean,
  queue_close_after_minutes integer,
  queue_auto_skip boolean,
  queue_notify_enabled boolean,
  queue_notify_channel public.queue_notify_channel,
  auto_approve boolean,
  deposit_refundable boolean,
  accept_app_payment boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare l_name text;
begin
  perform public.admin_require_active_access_session(p_session_id, p_establishment_id);
  select e.name into l_name from public.establishments e where e.id = p_establishment_id;
  perform public.admin_write_audit(
    'Consultou os ajustes da conta de ' || l_name,
    'somente leitura · seção: Ajustes', p_establishment_id, true
  );
  return query
    select e.timezone, e.booking_mode, e.cancellation_window_minutes, e.deposit_percent,
      e.slot_interval_minutes, e.min_lead_minutes, s.queue_remote_join,
      s.queue_require_arrival, s.queue_arrival_method, s.queue_per_professional,
      s.queue_auto_close, s.queue_close_after_minutes, s.queue_auto_skip,
      s.queue_notify_enabled, s.queue_notify_channel, s.auto_approve,
      s.deposit_refundable, s.accept_app_payment
    from public.establishments e
    join public.establishment_settings s on s.establishment_id = e.id
    where e.id = p_establishment_id;
end;
$$;

create function public.admin_account_reviews(p_session_id uuid, p_establishment_id uuid)
returns table (
  id uuid,
  rating smallint,
  comment text,
  tags text[],
  customer text,
  professional text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare l_name text;
begin
  perform public.admin_require_active_access_session(p_session_id, p_establishment_id);
  select e.name into l_name from public.establishments e where e.id = p_establishment_id;
  perform public.admin_write_audit(
    'Consultou as avaliações da conta de ' || l_name,
    'somente leitura · seção: Avaliações', p_establishment_id, true
  );
  return query
    select r.id, r.rating, r.comment, r.tags,
      split_part(btrim(coalesce(p.full_name, 'Cliente')), ' ', 1) || ' •••',
      pr.display_name, r.created_at
    from public.reviews r
    left join public.profiles p on p.id = r.customer_id
    left join public.professionals pr on pr.id = r.professional_id
    where r.establishment_id = p_establishment_id
      and r.removed_at is null
    order by r.created_at desc
    limit 20;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------

revoke execute on function public.admin_start_access_session(uuid, text, integer)
  from public, anon;
revoke execute on function public.admin_has_active_access_session(uuid, uuid)
  from public, anon;
revoke execute on function public.admin_active_access_sessions()
  from public, anon;
revoke execute on function public.admin_end_access_session(uuid)
  from public, anon;
revoke execute on function public.admin_account_agenda(uuid, uuid)
  from public, anon;
revoke execute on function public.admin_account_services(uuid, uuid)
  from public, anon;
revoke execute on function public.admin_account_professionals(uuid, uuid)
  from public, anon;
revoke execute on function public.admin_account_settings(uuid, uuid)
  from public, anon;
revoke execute on function public.admin_account_reviews(uuid, uuid)
  from public, anon;

grant execute on function public.admin_start_access_session(uuid, text, integer)
  to authenticated, service_role;
grant execute on function public.admin_has_active_access_session(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.admin_active_access_sessions()
  to authenticated, service_role;
grant execute on function public.admin_end_access_session(uuid)
  to authenticated, service_role;
grant execute on function public.admin_account_agenda(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.admin_account_services(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.admin_account_professionals(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.admin_account_settings(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.admin_account_reviews(uuid, uuid)
  to authenticated, service_role;
