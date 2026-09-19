-- Gate de seguranca para o primeiro lancamento.
--
-- Esta migration e deliberadamente aditiva: fecha escritas amplas descobertas
-- pela auditoria sem reescrever as migrations que ja podem ter sido aplicadas.

-- ---------------------------------------------------------------------------
-- Fila: cliente escreve somente pelas RPCs estreitas
-- ---------------------------------------------------------------------------

drop policy if exists queue_entries_insert_own on public.queue_entries;
drop policy if exists queue_entries_update_own on public.queue_entries;

create or replace function public.queue_join(
  p_establishment_id uuid,
  p_service_id uuid default null,
  p_professional_id uuid default null,
  p_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_id uuid;
  l_source public.queue_source := 'app'::public.queue_source;
begin
  if l_uid is null then
    raise exception 'Entre para entrar na fila.' using errcode = '42501', hint = 'unauthorized';
  end if;
  if not exists (
    select 1 from public.establishments e
    where e.id = p_establishment_id and e.status = 'active' and e.booking_mode in ('queue', 'both')
  ) then
    raise exception 'Esta fila nao esta disponivel.' using errcode = 'P0002', hint = 'queue_unavailable';
  end if;
  if p_service_id is not null and not exists (
    select 1 from public.services s
    where s.id = p_service_id and s.establishment_id = p_establishment_id and s.is_active
  ) then
    raise exception 'Servico nao encontrado nesta loja.' using errcode = 'P0002', hint = 'queue_invalid_service';
  end if;
  if nullif(btrim(coalesce(p_code, '')), '') is not null then
    if not public.queue_code_matches(p_establishment_id, p_code) then
      raise exception 'Codigo do balcao invalido. Leia o QR de novo.'
        using errcode = 'P0001', hint = 'queue_code_invalid';
    end if;
    perform set_config('vez.queue_code_ok', p_establishment_id::text, true);
    l_source := 'qr'::public.queue_source;
  end if;

  insert into public.queue_entries (
    establishment_id, customer_id, service_id, professional_id, source, status, joined_at
  ) values (
    p_establishment_id, l_uid, p_service_id, p_professional_id, l_source, 'waiting', now()
  ) returning id into l_id;
  return l_id;
exception
  when unique_violation then
    raise exception 'Voce ja esta nesta fila.' using errcode = '23505', hint = 'queue_already_in';
end;
$$;

create or replace function public.queue_confirm_arrival(p_entry_id uuid, p_code text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_establishment_id uuid;
begin
  if l_uid is null then
    raise exception 'Entre para confirmar a chegada.' using errcode = '42501', hint = 'unauthorized';
  end if;
  select q.establishment_id into l_establishment_id
  from public.queue_entries q
  where q.id = p_entry_id and q.customer_id = l_uid and q.status in ('waiting', 'called')
  for update;
  if l_establishment_id is null then
    raise exception 'Entrada na fila nao encontrada.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if nullif(btrim(coalesce(p_code, '')), '') is not null then
    if not public.queue_code_matches(l_establishment_id, p_code) then
      raise exception 'Codigo do balcao invalido. Leia o QR de novo.'
        using errcode = 'P0001', hint = 'queue_code_invalid';
    end if;
    perform set_config('vez.queue_code_ok', l_establishment_id::text, true);
  end if;
  update public.queue_entries q set arrived_at = now()
  where q.id = p_entry_id and q.customer_id = l_uid and q.arrived_at is null;
end;
$$;

create function public.queue_leave(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Entre para sair da fila.' using errcode = '42501', hint = 'unauthorized';
  end if;
  update public.queue_entries q
  set status = 'left', finished_at = now()
  where q.id = p_entry_id
    and q.customer_id = (select auth.uid())
    and q.status in ('waiting', 'called');
  if not found then
    raise exception 'Entrada na fila nao encontrada.' using errcode = 'P0002', hint = 'not_found';
  end if;
end;
$$;

revoke execute on function public.queue_leave(uuid) from public, anon;
grant execute on function public.queue_leave(uuid) to authenticated, service_role;

-- O estado publico conserva posicao/espera, mas identidade so aparece para o
-- proprio cliente ou para a equipe da loja.
create or replace function public.queue_state(p_establishment_id uuid)
returns table (
  entry_id uuid,
  customer_id uuid,
  queue_position integer,
  status public.queue_status,
  joined_at timestamptz,
  estimated_wait_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select coalesce(s.queue_require_arrival, false) require_arrival,
           coalesce(s.queue_per_professional, false) per_professional
    from (select 1) one
    left join public.establishment_settings s on s.establishment_id = p_establishment_id
  ), active as (
    select q.id, q.customer_id, q.status, q.joined_at,
      (q.status = 'waiting' and (not (select require_arrival from settings) or q.arrived_at is not null)) in_line,
      case when (select per_professional from settings) then coalesce(q.professional_id::text, '*') else '*' end lane,
      coalesce(s.duration_minutes, 30) duration
    from public.queue_entries q
    left join public.services s on s.id = q.service_id
    where q.establishment_id = p_establishment_id and q.status in ('waiting', 'called', 'in_service')
  ), ranked as (
    select a.*,
      case when a.in_line then row_number() over (partition by a.in_line, a.lane order by a.joined_at) else 0 end pos,
      case when a.lane <> '*' then 1 else (
        select count(*) from public.professionals p
        where p.establishment_id = p_establishment_id and p.is_active
      ) end pros
    from active a
  )
  select r.id,
    case when r.customer_id = (select auth.uid()) or public.is_establishment_member(p_establishment_id)
      then r.customer_id else null end,
    r.pos::integer, r.status, r.joined_at,
    (coalesce((select sum(r2.duration) from ranked r2
      where r2.in_line and r2.lane = r.lane and r2.joined_at < r.joined_at), 0)
      / greatest(r.pros, 1))::integer
  from ranked r order by r.joined_at
$$;

-- ---------------------------------------------------------------------------
-- Reservas: cancelamento e remarcacao alteram somente campos permitidos
-- ---------------------------------------------------------------------------

drop policy if exists appointments_cancel_own on public.appointments;

create function public.customer_cancel_appointment(p_appointment_id uuid, p_reason text default null)
returns table (
  within_free_window boolean,
  deposit_cents integer,
  minutes_until_start integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_row public.appointments;
  l_window integer;
  l_minutes integer;
begin
  if l_uid is null then
    raise exception 'Entre para cancelar.' using errcode = '42501', hint = 'unauthorized';
  end if;
  select * into l_row from public.appointments a
  where a.id = p_appointment_id and a.customer_id = l_uid for update;
  if not found then
    raise exception 'Reserva nao encontrada.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if l_row.status not in ('scheduled', 'confirmed') or l_row.starts_at <= now() then
    raise exception 'Esta reserva nao pode mais ser cancelada.'
      using errcode = 'P0001', hint = 'not_cancellable';
  end if;
  select e.cancellation_window_minutes into l_window
  from public.establishments e where e.id = l_row.establishment_id;
  l_minutes := floor(extract(epoch from (l_row.starts_at - now())) / 60)::integer;
  update public.appointments a set
    status = 'cancelled_by_customer', cancelled_at = now(),
    cancellation_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), '')
  where a.id = l_row.id;
  return query select l_minutes >= coalesce(l_window, 0), l_row.deposit_cents, l_minutes;
end;
$$;

revoke execute on function public.customer_cancel_appointment(uuid, text) from public, anon;
grant execute on function public.customer_cancel_appointment(uuid, text) to authenticated, service_role;

-- NULL <> uuid resulta NULL; IS DISTINCT FROM tambem bloqueia reservas de
-- balcao, cujo customer_id e nulo.
create or replace function public.customer_reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_professional_id uuid default null
)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, professional_id uuid, status public.appointment_status)
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
  if l_uid is null then raise exception 'Entre para remarcar.' using errcode = '42501', hint = 'unauthorized'; end if;
  select * into l_appointment from public.appointments a where a.id = p_appointment_id for update;
  if not found or l_appointment.customer_id is distinct from l_uid then
    raise exception 'Reserva nao encontrada.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if l_appointment.status not in ('scheduled', 'confirmed') or l_appointment.starts_at <= now() then
    raise exception 'Esta reserva nao pode mais ser remarcada.' using errcode = 'P0001', hint = 'not_reschedulable';
  end if;
  if exists (select 1 from public.customer_blocks b where b.user_id = l_uid) then
    raise exception 'Sua conta esta bloqueada para novos horarios. Fale com o suporte.' using errcode = 'P0001', hint = 'customer_blocked';
  end if;
  select e.timezone, e.cancellation_window_minutes, s.duration_minutes
    into l_timezone, l_window, l_duration
  from public.establishments e join public.services s on s.id = l_appointment.service_id
  where e.id = l_appointment.establishment_id and e.status = 'active';
  if l_timezone is null then raise exception 'Esta loja nao esta disponivel.' using errcode = 'P0001', hint = 'establishment_unavailable'; end if;
  if now() > l_appointment.starts_at - make_interval(mins => l_window) then
    raise exception 'O prazo para remarcar ja passou. Fale com a loja ou cancele.' using errcode = 'P0001', hint = 'outside_window';
  end if;
  if p_starts_at is null or p_starts_at <= now() then raise exception 'Escolha um horario futuro.' using errcode = 'P0001', hint = 'invalid_date'; end if;
  l_professional := coalesce(p_professional_id, l_appointment.professional_id);
  if p_starts_at = l_appointment.starts_at and l_professional = l_appointment.professional_id then
    raise exception 'Esse ja e o horario da sua reserva.' using errcode = 'P0001', hint = 'same_slot';
  end if;
  if not exists (
    select 1 from public.available_slots(l_appointment.establishment_id, l_appointment.service_id,
      timezone(l_timezone, p_starts_at)::date, l_professional) slot
    where slot.slot_start = p_starts_at and slot.professional_id = l_professional
  ) then raise exception 'Esse horario nao esta mais livre. Escolha outro.' using errcode = 'P0001', hint = 'slot_unavailable'; end if;
  update public.appointments a set starts_at = p_starts_at,
    ends_at = p_starts_at + make_interval(mins => l_duration), professional_id = l_professional, status = 'scheduled'
  where a.id = l_appointment.id;
  return query select a.id, a.starts_at, a.ends_at, a.professional_id, a.status
    from public.appointments a where a.id = l_appointment.id;
exception when exclusion_violation then
  raise exception 'Alguem acabou de reservar esse horario. Escolha outro.' using errcode = 'P0001', hint = 'slot_taken';
end;
$$;

-- ---------------------------------------------------------------------------
-- Convites: o service role registra; a pessoa convidada aceita explicitamente
-- ---------------------------------------------------------------------------

revoke execute on function public.establishment_add_member(uuid, text, text, public.establishment_role, uuid, boolean)
  from public, anon, authenticated, service_role;

create function public.establishment_record_invite(
  p_establishment_id uuid,
  p_email text,
  p_name text,
  p_role public.establishment_role,
  p_professional_id uuid,
  p_sent_by_auth boolean,
  p_invited_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_email text := lower(btrim(coalesce(p_email, '')));
  l_name text := btrim(coalesce(p_name, ''));
  l_user uuid;
  l_invitation uuid;
  l_establishment text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Operacao interna.' using errcode = '42501', hint = 'forbidden';
  end if;
  if not exists (select 1 from public.establishment_members m
    where m.user_id = p_invited_by and m.establishment_id = p_establishment_id and m.role = 'owner') then
    raise exception 'So o dono da loja convida pessoas para a equipe.' using errcode = '42501', hint = 'forbidden';
  end if;
  if (select count(*) from public.establishment_invitations i
      where i.invited_by = p_invited_by and i.invited_at > now() - interval '15 minutes') >= 10 then
    raise exception 'Muitos convites em pouco tempo. Aguarde 15 minutos.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if l_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(l_name) not between 2 and 120 then
    raise exception 'Dados do convite invalidos.' using errcode = 'P0001', hint = 'invalid_invite';
  end if;
  if p_role is null or p_role not in ('manager', 'staff') then
    raise exception 'Escolha gerencia ou equipe.' using errcode = 'P0001', hint = 'invalid_role';
  end if;
  if p_professional_id is not null and not exists (select 1 from public.professionals p
    where p.id = p_professional_id and p.establishment_id = p_establishment_id and (p.user_id is null)) then
    raise exception 'Profissional indisponivel nesta loja.' using errcode = 'P0001', hint = 'professional_taken';
  end if;
  select u.id into l_user from auth.users u where lower(u.email) = l_email;
  if l_user is null then raise exception 'A conta convidada nao foi encontrada.' using errcode = 'P0002', hint = 'account_missing'; end if;
  if exists (select 1 from public.establishment_members m
    where m.establishment_id = p_establishment_id and m.user_id = l_user) then
    raise exception 'Esta pessoa ja faz parte da equipe.' using errcode = '23505', hint = 'already_member';
  end if;
  insert into public.profiles (id, full_name) values (l_user, l_name)
  on conflict (id) do update set full_name = coalesce(public.profiles.full_name, excluded.full_name);
  insert into public.establishment_invitations (
    establishment_id, user_id, email, name, role, professional_id, sent_by_auth, invited_by, status, invited_at
  ) values (p_establishment_id, l_user, l_email, l_name, p_role, p_professional_id,
    p_sent_by_auth, p_invited_by, 'pending', now())
  on conflict (establishment_id, lower(email)) where status = 'pending'
  do update set name = excluded.name, role = excluded.role, professional_id = excluded.professional_id,
    sent_by_auth = excluded.sent_by_auth, invited_by = excluded.invited_by, invited_at = now()
  returning id into l_invitation;

  if not p_sent_by_auth then
    select e.name into l_establishment from public.establishments e where e.id = p_establishment_id;
    perform public.notify_enqueue(l_user, 'email', 'team_invited', 'Convite para a equipe de ' || l_establishment,
      'Voce recebeu um convite para a equipe de ' || l_establishment || '. Entre no portal e abra /convite para aceitar.',
      jsonb_build_object('type', 'team_invited', 'path', '/convite'), null,
      'team_invited:' || l_invitation || ':' || extract(epoch from now())::bigint, p_establishment_id);
  end if;
  return l_invitation;
end;
$$;

revoke execute on function public.establishment_record_invite(uuid, text, text, public.establishment_role, uuid, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.establishment_record_invite(uuid, text, text, public.establishment_role, uuid, boolean, uuid)
  to service_role;

create function public.establishment_accept_invites()
returns table (accepted integer, establishment_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  l_row public.establishment_invitations;
  l_count integer := 0;
  l_last uuid;
begin
  if l_uid is null then raise exception 'Entre para aceitar o convite.' using errcode = '42501', hint = 'unauthorized'; end if;
  for l_row in select * from public.establishment_invitations i
    where i.status = 'pending' and (i.user_id = l_uid or lower(i.email) = l_email)
    order by i.invited_at for update
  loop
    if l_row.professional_id is not null and exists (select 1 from public.professionals p
      where p.id = l_row.professional_id and p.user_id is not null and p.user_id <> l_uid) then
      raise exception 'A cadeira deste convite ja foi ocupada.' using errcode = 'P0001', hint = 'professional_taken';
    end if;
    insert into public.establishment_members (user_id, establishment_id, role)
    values (l_uid, l_row.establishment_id, l_row.role)
    on conflict on constraint establishment_members_pkey do nothing;
    if l_row.professional_id is not null then
      update public.professionals p set user_id = l_uid
      where p.id = l_row.professional_id and p.establishment_id = l_row.establishment_id and p.user_id is null;
    end if;
    update public.establishment_invitations set user_id = l_uid, status = 'accepted', accepted_at = now()
    where id = l_row.id;
    l_count := l_count + 1;
    l_last := l_row.establishment_id;
  end loop;
  if l_count = 0 then raise exception 'Nenhum convite pendente foi encontrado.' using errcode = 'P0002', hint = 'not_found'; end if;
  return query select l_count, l_last;
end;
$$;

revoke execute on function public.establishment_accept_invites() from public, anon;
grant execute on function public.establishment_accept_invites() to authenticated, service_role;

-- Nao aceitar convite implicitamente apenas porque houve login.
create or replace function public.establishment_invites(p_establishment_id uuid)
returns table (id uuid, email text, name text, role public.establishment_role,
  professional_id uuid, status public.establishment_invite_status, sent_by_auth boolean,
  invited_at timestamptz, accepted_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_establishment_manager(p_establishment_id);
  return query select i.id, i.email, i.name, i.role, i.professional_id, i.status,
    i.sent_by_auth, i.invited_at, i.accepted_at
  from public.establishment_invitations i
  where i.establishment_id = p_establishment_id
    and (i.status = 'pending' or i.updated_at >= now() - interval '30 days')
  order by i.status, i.invited_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notificacoes: validade, descarte e token sem takeover entre contas
-- ---------------------------------------------------------------------------

alter table public.notification_outbox
  add column expires_at timestamptz not null default (now() + interval '7 days');
create index notification_outbox_expiry_idx on public.notification_outbox (expires_at)
  where status in ('pending', 'unconfigured', 'sending');

create or replace function public.register_push_device(
  p_expo_token text, p_app public.notification_app, p_platform text, p_device_name text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  l_uid uuid := (select auth.uid());
  l_token text := btrim(coalesce(p_expo_token, ''));
  l_id uuid;
  l_owner uuid;
begin
  if l_uid is null then raise exception 'Entre na sua conta para receber avisos.' using errcode = '42501'; end if;
  if l_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'Token de aviso invalido.' using errcode = 'P0001'; end if;
  if p_app is null or p_platform is null or p_platform not in ('ios', 'android', 'web') then raise exception 'Aplicativo ou plataforma invalida.' using errcode = 'P0001'; end if;
  select d.user_id into l_owner from public.push_devices d where d.expo_token = l_token for update;
  if l_owner is not null and l_owner <> l_uid then
    raise exception 'Este aparelho ainda esta ligado a outra conta. Saia dela antes de ativar avisos.'
      using errcode = 'P0001', hint = 'push_token_in_use';
  end if;
  insert into public.push_devices (user_id, expo_token, app, platform, device_name)
  values (l_uid, l_token, p_app, p_platform, nullif(left(btrim(coalesce(p_device_name, '')), 80), ''))
  on conflict (expo_token) do update set app = excluded.app, platform = excluded.platform,
    device_name = coalesce(excluded.device_name, public.push_devices.device_name),
    last_seen_at = now(), disabled_at = null, disabled_reason = null
  returning id into l_id;
  return l_id;
end;
$$;

create function public.notification_expire()
returns integer language plpgsql security definer set search_path = '' as $$
declare l_count integer;
begin
  update public.notification_outbox set status = 'skipped', locked_at = null,
    last_error = 'Aviso expirou antes da entrega.'
  where status in ('pending', 'unconfigured', 'sending') and expires_at <= now();
  get diagnostics l_count = row_count;
  return l_count;
end;
$$;
revoke execute on function public.notification_expire() from public, anon, authenticated;
grant execute on function public.notification_expire() to service_role;
select cron.schedule('notifications-outbox-expire', '11 * * * *', 'select public.notification_expire()');

-- ---------------------------------------------------------------------------
-- Anexos: limite de uploads orfaos, extensao coerente e retencao
-- ---------------------------------------------------------------------------

alter table public.support_ticket_attachments
  add column expires_at timestamptz not null default (now() + interval '365 days');

create function public.support_attachment_upload_allowed(p_object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and p_object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|pdf)$'
    and public.support_ticket_can_access(public.support_attachment_ticket_id(p_object_name))
    and exists (select 1 from public.support_tickets t
      where t.id = public.support_attachment_ticket_id(p_object_name) and t.status <> 'resolved')
    and (select count(*) from storage.objects o
      where o.bucket_id = 'support-attachments' and o.owner_id = (select auth.uid())::text
        and not exists (select 1 from public.support_ticket_attachments a where a.storage_path = o.name)) < 5;
$$;
revoke execute on function public.support_attachment_upload_allowed(text) from public, anon;
grant execute on function public.support_attachment_upload_allowed(text) to authenticated, service_role;

drop policy if exists support_attachments_objects_insert on storage.objects;
create policy support_attachments_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'support-attachments' and public.support_attachment_upload_allowed(name));

create function public.support_attachments_prunable()
returns table (name text, attached boolean)
language sql stable security definer set search_path = '' as $$
  select o.name, (a.id is not null)
  from storage.objects o
  left join public.support_ticket_attachments a on a.storage_path = o.name
  where o.bucket_id = 'support-attachments'
    and ((a.id is null and o.created_at < now() - interval '1 hour')
      or (a.id is not null and a.expires_at <= now()))
  order by o.created_at limit 100;
$$;
revoke execute on function public.support_attachments_prunable() from public, anon, authenticated;
grant execute on function public.support_attachments_prunable() to service_role;

create function public.support_attachments_prune_metadata(p_names text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare l_count integer;
begin
  delete from public.support_ticket_attachments a where a.storage_path = any(coalesce(p_names, '{}'));
  get diagnostics l_count = row_count;
  return l_count;
end;
$$;
revoke execute on function public.support_attachments_prune_metadata(text[]) from public, anon, authenticated;
grant execute on function public.support_attachments_prune_metadata(text[]) to service_role;

-- Metadado declarado precisa ao menos concordar com a extensao permitida. A
-- verificacao de assinatura/antivirus continua no gate operacional do deploy.
alter table public.support_ticket_attachments add constraint support_attachment_mime_extension
check (
  (mime_type = 'image/jpeg' and lower(storage_path) ~ '\.(jpg|jpeg)$') or
  (mime_type = 'image/png' and lower(storage_path) ~ '\.png$') or
  (mime_type = 'image/webp' and lower(storage_path) ~ '\.webp$') or
  (mime_type = 'image/heic' and lower(storage_path) ~ '\.heic$') or
  (mime_type = 'application/pdf' and lower(storage_path) ~ '\.pdf$')
);

-- O pedido LGPD tambem limpa metadados livres do Auth, fonte comum de PII.
create or replace function public.customer_delete_account(p_user_id uuid)
returns table (cancelled_appointments integer, anonymized_reviews integer)
language plpgsql security definer set search_path = '' as $$
declare l_cancelled integer := 0; l_reviews integer := 0;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operacao interna.' using errcode = '42501'; end if;
  if p_user_id is null or not exists (select 1 from public.profiles p where p.id = p_user_id) then raise exception 'Conta nao encontrada.' using errcode = 'P0002', hint = 'not_found'; end if;
  if exists (select 1 from public.establishment_members m where m.user_id = p_user_id) then raise exception 'Sua conta administra uma loja. Transfira a loja antes, pelo suporte.' using errcode = 'P0001', hint = 'has_establishment'; end if;
  if exists (select 1 from public.platform_admins a where a.user_id = p_user_id) then raise exception 'Conta da equipe da plataforma nao e excluida pelo app.' using errcode = 'P0001', hint = 'platform_staff'; end if;
  update public.appointments set status = 'cancelled_by_customer', cancelled_at = now(), cancellation_reason = 'Conta excluida pelo cliente'
    where customer_id = p_user_id and status in ('scheduled', 'confirmed') and starts_at > now();
  get diagnostics l_cancelled = row_count;
  update public.queue_entries set status = 'left', finished_at = now()
    where customer_id = p_user_id and status in ('waiting', 'called');
  update public.reviews set comment = null where customer_id = p_user_id and comment is not null;
  get diagnostics l_reviews = row_count;
  delete from public.customer_addresses where customer_id = p_user_id;
  delete from public.customer_favorites where customer_id = p_user_id;
  delete from public.customer_notification_prefs where customer_id = p_user_id;
  delete from public.assistant_messages where user_id = p_user_id;
  delete from public.assistant_conversations where user_id = p_user_id;
  delete from public.notification_outbox where user_id = p_user_id;
  delete from public.push_devices where user_id = p_user_id;
  update public.profiles set full_name = null, phone = null, avatar_url = null where id = p_user_id;
  update auth.users set raw_user_meta_data = '{}'::jsonb where id = p_user_id;
  insert into public.account_deletions (user_id, cancelled_appointments, anonymized_reviews)
  values (p_user_id, l_cancelled, l_reviews)
  on conflict (user_id) do update set requested_at = now(),
    cancelled_appointments = public.account_deletions.cancelled_appointments + excluded.cancelled_appointments,
    anonymized_reviews = public.account_deletions.anonymized_reviews + excluded.anonymized_reviews;
  return query select l_cancelled, l_reviews;
end;
$$;
