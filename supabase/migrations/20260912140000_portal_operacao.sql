-- ---------------------------------------------------------------------------
-- Portal do estabelecimento: operação real (P5)
-- ---------------------------------------------------------------------------
-- As tabelas de agenda e fila já existem. Esta migration acrescenta apenas as
-- fronteiras que não devem ser reimplementadas no navegador: resumo exato,
-- consolidação honesta dos clientes, criação/remarcação contra
-- available_slots() e reordenação atômica da fila.

create or replace function public.portal_operation_summary(p_establishment_id uuid)
returns table (
  local_day date,
  timezone text,
  booking_mode public.booking_mode,
  scheduled_today integer,
  confirmed_today integer,
  completed_today integer,
  revenue_today_cents bigint,
  pending_approval integer,
  queue_active integer,
  no_show_30 integer,
  finalized_30 integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_timezone text;
  l_day date;
  l_start timestamptz;
  l_end timestamptz;
begin
  if not public.is_establishment_member(p_establishment_id) then
    raise exception 'Você não tem acesso a esta loja.' using errcode = '42501';
  end if;

  select e.timezone, timezone(e.timezone, now())::date
    into l_timezone, l_day
  from public.establishments e
  where e.id = p_establishment_id and e.status = 'active';

  if l_timezone is null then
    raise exception 'Loja ativa não encontrada.' using errcode = 'P0002';
  end if;

  l_start := l_day::timestamp at time zone l_timezone;
  l_end := (l_day + 1)::timestamp at time zone l_timezone;

  return query
  select
    l_day,
    l_timezone,
    e.booking_mode,
    (select count(*)::integer from public.appointments a
      where a.establishment_id = e.id and a.starts_at >= l_start and a.starts_at < l_end
        and a.status = 'scheduled'),
    (select count(*)::integer from public.appointments a
      where a.establishment_id = e.id and a.starts_at >= l_start and a.starts_at < l_end
        and a.status = 'confirmed'),
    (select count(*)::integer from public.appointments a
      where a.establishment_id = e.id and a.starts_at >= l_start and a.starts_at < l_end
        and a.status = 'completed'),
    (select coalesce(sum(a.price_cents), 0)::bigint from public.appointments a
      where a.establishment_id = e.id and a.starts_at >= l_start and a.starts_at < l_end
        and a.status = 'completed'),
    (select count(*)::integer from public.appointments a
      where a.establishment_id = e.id and a.starts_at >= now() and a.status = 'scheduled'),
    (select count(*)::integer from public.queue_entries q
      where q.establishment_id = e.id and q.status in ('waiting', 'called', 'in_service')),
    (select count(*)::integer from public.appointments a
      where a.establishment_id = e.id and a.starts_at >= l_start - interval '30 days'
        and a.starts_at < l_end and a.status = 'no_show'),
    (select count(*)::integer from public.appointments a
      where a.establishment_id = e.id and a.starts_at >= l_start - interval '30 days'
        and a.starts_at < l_end and a.status in ('completed', 'no_show'))
  from public.establishments e
  where e.id = p_establishment_id;
end;
$$;

revoke execute on function public.portal_operation_summary(uuid) from public, anon;
grant execute on function public.portal_operation_summary(uuid) to authenticated, service_role;

-- Conta do app é uma identidade estável. Cliente sem conta só é consolidado
-- quando deixou telefone; sem telefone, cada visita continua sendo uma linha,
-- porque juntar duas pessoas apenas pelo nome inventaria uma identidade.
create or replace function public.portal_operation_customers(p_establishment_id uuid)
returns table (
  identity_key text,
  customer_id uuid,
  name text,
  phone text,
  has_account boolean,
  appointments integer,
  completed integer,
  no_shows integer,
  queue_visits integer,
  spent_cents bigint,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_establishment_member(p_establishment_id) then
    raise exception 'Você não tem acesso a esta loja.' using errcode = '42501';
  end if;

  return query
  with contacts as (
    select
      case
        when a.customer_id is not null then 'user:' || a.customer_id::text
        when regexp_replace(coalesce(a.guest_phone, ''), '\D', '', 'g') <> ''
          then 'phone:' || regexp_replace(a.guest_phone, '\D', '', 'g')
        else 'appointment:' || a.id::text
      end as contact_key,
      a.customer_id,
      coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(a.guest_name), ''), 'Sem nome') as contact_name,
      coalesce(nullif(btrim(p.phone), ''), nullif(btrim(a.guest_phone), '')) as contact_phone,
      1::integer as appointment_count,
      (a.status = 'completed')::integer as completed_count,
      (a.status = 'no_show')::integer as no_show_count,
      0::integer as queue_count,
      case when a.status = 'completed' then a.price_cents else 0 end::bigint as spent,
      a.starts_at as seen_at
    from public.appointments a
    left join public.profiles p on p.id = a.customer_id
    where a.establishment_id = p_establishment_id

    union all

    select
      case
        when q.customer_id is not null then 'user:' || q.customer_id::text
        when regexp_replace(coalesce(q.guest_phone, ''), '\D', '', 'g') <> ''
          then 'phone:' || regexp_replace(q.guest_phone, '\D', '', 'g')
        else 'queue:' || q.id::text
      end,
      q.customer_id,
      coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(q.guest_name), ''), 'Sem nome'),
      coalesce(nullif(btrim(p.phone), ''), nullif(btrim(q.guest_phone), '')),
      0,
      0,
      0,
      1,
      0::bigint,
      q.joined_at
    from public.queue_entries q
    left join public.profiles p on p.id = q.customer_id
    where q.establishment_id = p_establishment_id
  )
  select
    c.contact_key,
    min(c.customer_id::text)::uuid,
    max(c.contact_name),
    max(c.contact_phone),
    bool_or(c.customer_id is not null),
    sum(c.appointment_count)::integer,
    sum(c.completed_count)::integer,
    sum(c.no_show_count)::integer,
    sum(c.queue_count)::integer,
    sum(c.spent)::bigint,
    max(c.seen_at)
  from contacts c
  group by c.contact_key
  order by max(c.seen_at) desc;
end;
$$;

revoke execute on function public.portal_operation_customers(uuid) from public, anon;
grant execute on function public.portal_operation_customers(uuid) to authenticated, service_role;

-- Agendamento feito pela loja para alguém sem conta (decisão 0006). Preço,
-- duração, vínculo profissional-serviço e disponibilidade são lidos no banco;
-- o cliente web não escolhe nenhum deles.
create or replace function public.portal_create_guest_appointment(
  p_establishment_id uuid,
  p_professional_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_guest_name text,
  p_guest_phone text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text := btrim(coalesce(p_guest_name, ''));
  l_phone text := nullif(btrim(coalesce(p_guest_phone, '')), '');
  l_timezone text;
  l_duration integer;
  l_price integer;
  l_id uuid;
begin
  if not public.is_establishment_member(p_establishment_id) then
    raise exception 'Você não tem acesso a esta loja.' using errcode = '42501';
  end if;
  if char_length(l_name) not between 2 and 120 then
    raise exception 'Informe o nome do cliente.' using errcode = 'P0001';
  end if;
  if l_phone is not null and regexp_replace(l_phone, '\D', '', 'g') !~ '^[0-9]{10,13}$' then
    raise exception 'Informe um telefone válido ou deixe o campo vazio.' using errcode = 'P0001';
  end if;

  select e.timezone, s.duration_minutes, s.price_cents
    into l_timezone, l_duration, l_price
  from public.establishments e
  join public.services s on s.id = p_service_id and s.establishment_id = e.id and s.is_active
  join public.professionals p on p.id = p_professional_id and p.establishment_id = e.id and p.is_active
  join public.professional_services ps on ps.professional_id = p.id and ps.service_id = s.id
  where e.id = p_establishment_id and e.status = 'active';

  if l_timezone is null then
    raise exception 'Serviço ou profissional indisponível.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.available_slots(
      p_establishment_id,
      p_service_id,
      timezone(l_timezone, p_starts_at)::date,
      p_professional_id
    ) slot
    where slot.slot_start = p_starts_at
  ) then
    raise exception 'Esse horário não está mais livre. Escolha outro.' using errcode = 'P0001';
  end if;

  insert into public.appointments (
    establishment_id, professional_id, service_id, customer_id, guest_name,
    guest_phone, starts_at, ends_at, status, price_cents, deposit_cents, notes
  ) values (
    p_establishment_id, p_professional_id, p_service_id, null, l_name,
    l_phone, p_starts_at, p_starts_at + make_interval(mins => l_duration),
    'confirmed', l_price, 0, nullif(btrim(coalesce(p_notes, '')), '')
  ) returning id into l_id;

  return l_id;
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.' using errcode = 'P0001';
end;
$$;

revoke execute on function public.portal_create_guest_appointment(uuid, uuid, uuid, timestamptz, text, text, text) from public, anon;
grant execute on function public.portal_create_guest_appointment(uuid, uuid, uuid, timestamptz, text, text, text) to authenticated, service_role;

-- Remarcação também confere available_slots(); a grade nunca é calculada no
-- portal. Reservas encerradas não voltam para a agenda ativa.
create or replace function public.portal_reschedule_appointment(
  p_establishment_id uuid,
  p_appointment_id uuid,
  p_starts_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_appointment public.appointments;
  l_timezone text;
  l_duration integer;
begin
  if not public.is_establishment_member(p_establishment_id) then
    raise exception 'Você não tem acesso a esta loja.' using errcode = '42501';
  end if;

  select * into l_appointment
  from public.appointments a
  where a.id = p_appointment_id and a.establishment_id = p_establishment_id
  for update;
  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;
  if l_appointment.status not in ('scheduled', 'confirmed') then
    raise exception 'Este agendamento não pode mais ser remarcado.' using errcode = 'P0001';
  end if;

  select e.timezone, s.duration_minutes into l_timezone, l_duration
  from public.establishments e
  join public.services s on s.id = l_appointment.service_id
  where e.id = p_establishment_id;

  if p_starts_at is distinct from l_appointment.starts_at and not exists (
    select 1
    from public.available_slots(
      p_establishment_id,
      l_appointment.service_id,
      timezone(l_timezone, p_starts_at)::date,
      l_appointment.professional_id
    ) slot
    where slot.slot_start = p_starts_at
  ) then
    raise exception 'Esse horário não está mais livre. Escolha outro.' using errcode = 'P0001';
  end if;

  update public.appointments set
    starts_at = p_starts_at,
    ends_at = p_starts_at + make_interval(mins => l_duration),
    status = 'confirmed'
  where id = l_appointment.id;
  return p_starts_at;
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.' using errcode = 'P0001';
end;
$$;

revoke execute on function public.portal_reschedule_appointment(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.portal_reschedule_appointment(uuid, uuid, timestamptz) to authenticated, service_role;

-- A posição continua sendo joined_at, mas a troca é uma transação só. Só é
-- possível trocar duas posições vizinhas da fila efetiva devolvida por
-- queue_state(), inclusive quando a loja exige confirmação de chegada.
create or replace function public.portal_reorder_queue_entry(
  p_establishment_id uuid,
  p_entry_id uuid,
  p_before_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_entry public.queue_entries;
  l_before public.queue_entries;
  l_entry_position integer;
  l_before_position integer;
begin
  if not public.is_establishment_member(p_establishment_id) then
    raise exception 'Você não tem acesso a esta loja.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('queue:' || p_establishment_id::text, 0)
  );
  select * into l_entry from public.queue_entries q
    where q.id = p_entry_id and q.establishment_id = p_establishment_id for update;
  select * into l_before from public.queue_entries q
    where q.id = p_before_id and q.establishment_id = p_establishment_id for update;
  if not found or l_entry.id is null or l_before.id is null then
    raise exception 'Pessoa não encontrada na fila.' using errcode = 'P0002';
  end if;

  select s.queue_position into l_entry_position
  from public.queue_state(p_establishment_id) s where s.entry_id = l_entry.id;
  select s.queue_position into l_before_position
  from public.queue_state(p_establishment_id) s where s.entry_id = l_before.id;
  if l_entry_position <= 1 or l_before_position <> l_entry_position - 1 then
    raise exception 'A fila mudou. Atualize e tente novamente.' using errcode = 'P0001';
  end if;

  update public.queue_entries set joined_at = l_before.joined_at where id = l_entry.id;
  update public.queue_entries set joined_at = l_entry.joined_at where id = l_before.id;
end;
$$;

revoke execute on function public.portal_reorder_queue_entry(uuid, uuid, uuid) from public, anon;
grant execute on function public.portal_reorder_queue_entry(uuid, uuid, uuid) to authenticated, service_role;

-- O mobile-staff e o portal usam a mesma fila; uma entrada feita numa tela
-- precisa aparecer na outra sem recarregar a página.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'queue_entries'
     ) then
    alter publication supabase_realtime add table public.queue_entries;
  end if;
end;
$$;
