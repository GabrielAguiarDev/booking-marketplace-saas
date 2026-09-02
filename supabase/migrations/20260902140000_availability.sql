-- ---------------------------------------------------------------------------
-- Disponibilidade e reservas
-- ---------------------------------------------------------------------------
-- Esta migration entrega a decisão 0001: horário livre é calculado por uma
-- função Postgres, e nenhuma superfície reimplementa esse cálculo. Portal, app
-- do cliente e app da equipe chamam `available_slots()` por RPC e desenham o
-- que voltar.

create extension if not exists btree_gist with schema extensions;

-- A agenda vive em hora local: "abre às 9" é 9 no relógio da parede, não em
-- UTC. Sem fuso explícito, uma loja em Rio Branco ganharia horário de São Paulo.
alter table public.establishments
  add column timezone text not null default 'America/Sao_Paulo',
  -- Passo da grade. 15 min é o padrão do setor; barbearia costuma usar 30.
  add column slot_interval_minutes integer not null default 15,
  -- Antecedência mínima. Sem isso o app oferece um horário que começa em 2
  -- minutos e a pessoa não chega.
  add column min_lead_minutes integer not null default 30,
  add constraint establishments_slot_interval_valid
    check (slot_interval_minutes between 5 and 120),
  add constraint establishments_min_lead_valid
    check (min_lead_minutes between 0 and 10080);

-- ---------------------------------------------------------------------------
-- Jornadas
-- ---------------------------------------------------------------------------
-- `weekday` usa 0 = domingo … 6 = sábado, igual a `extract(dow)` no Postgres e
-- a `Date.getDay()` no JavaScript. Manter os três iguais evita a conversão
-- silenciosa que erra por um dia.

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  weekday smallint not null,
  opens_at time not null,
  closes_at time not null,
  constraint business_hours_weekday_range check (weekday between 0 and 6),
  constraint business_hours_order check (closes_at > opens_at)
);

comment on table public.business_hours is
  'Funcionamento da loja. Várias linhas no mesmo dia representam turnos (fecha para almoço).';

create index business_hours_establishment_idx
  on public.business_hours (establishment_id, weekday);

create table public.professional_schedules (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  weekday smallint not null,
  starts_at time not null,
  ends_at time not null,
  constraint professional_schedules_weekday_range check (weekday between 0 and 6),
  constraint professional_schedules_order check (ends_at > starts_at)
);

comment on table public.professional_schedules is
  'Jornada de cada profissional. É ela que gera os horários — o funcionamento da loja só recorta.';

create index professional_schedules_professional_idx
  on public.professional_schedules (professional_id, weekday);

-- Folga, feriado, bloqueio pontual — e também o contrário: o sábado extra que
-- o profissional resolveu abrir. Por isso `is_available`, e não uma tabela
-- chamada "bloqueios".
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  -- Nulo vale para a loja inteira (feriado). Preenchido é só daquela pessoa.
  professional_id uuid references public.professionals (id) on delete cascade,
  exception_date date not null,
  -- Ambos nulos = o dia inteiro.
  starts_at time,
  ends_at time,
  is_available boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  constraint schedule_exceptions_times_together
    check ((starts_at is null) = (ends_at is null)),
  constraint schedule_exceptions_order
    check (starts_at is null or ends_at > starts_at)
);

create index schedule_exceptions_lookup_idx
  on public.schedule_exceptions (establishment_id, exception_date);

-- ---------------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------------

create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_establishment',
  'no_show'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  -- Preço congelado no ato. O serviço pode subir de preço amanhã; o que foi
  -- combinado hoje é o que vale.
  price_cents integer not null,
  deposit_cents integer not null default 0,
  notes text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_order check (ends_at > starts_at),
  constraint appointments_price_not_negative check (price_cents >= 0),
  constraint appointments_deposit_within_price check (deposit_cents between 0 and price_cents),

  -- A trava de verdade contra venda dupla.
  --
  -- `available_slots()` diz o que estava livre no instante da pergunta. Entre a
  -- pergunta e a escrita, outro cliente pode ter comprado o mesmo horário. Só
  -- o banco resolve essa corrida, e resolve aqui: dois agendamentos ativos do
  -- mesmo profissional não podem se sobrepor no tempo. O segundo recebe erro
  -- 23P01 em vez de uma segunda reserva.
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('scheduled', 'confirmed'))
);

comment on constraint appointments_no_overlap on public.appointments is
  'Impede venda dupla do mesmo horário. Sem isto, dois clientes clicando ao mesmo tempo geram duas reservas.';

create index appointments_customer_idx on public.appointments (customer_id, starts_at desc);
create index appointments_establishment_idx
  on public.appointments (establishment_id, starts_at);
create index appointments_professional_day_idx
  on public.appointments (professional_id, starts_at)
  where status in ('scheduled', 'confirmed');

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- available_slots — a função que todas as superfícies chamam
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER porque precisa enxergar as reservas de todo mundo para saber
-- o que está ocupado, e a RLS de `appointments` (corretamente) só deixa cada
-- cliente ver as próprias. A função não devolve nenhum dado de reserva: só os
-- intervalos livres. Ocupado sai como ausência, nunca como "fulano às 14h".

create function public.available_slots(
  p_establishment_id uuid,
  p_service_id uuid,
  p_date date,
  p_professional_id uuid default null
)
returns table (
  professional_id uuid,
  slot_start timestamptz,
  slot_end timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_tz text;
  l_interval integer;
  l_lead integer;
  l_duration interval;
  l_weekday smallint;
begin
  select e.timezone, e.slot_interval_minutes, e.min_lead_minutes
    into l_tz, l_interval, l_lead
  from public.establishments e
  where e.id = p_establishment_id and e.status = 'active';

  if l_tz is null then
    return; -- loja inexistente ou não ativa: nenhum horário, sem erro
  end if;

  select make_interval(mins => s.duration_minutes) into l_duration
  from public.services s
  where s.id = p_service_id
    and s.establishment_id = p_establishment_id
    and s.is_active;

  if l_duration is null then
    return;
  end if;

  l_weekday := extract(dow from p_date)::smallint;

  return query
  with
  -- Quem pode executar este serviço, respeitando o filtro opcional.
  eligible as (
    select p.id
    from public.professionals p
    join public.professional_services ps on ps.professional_id = p.id
    where p.establishment_id = p_establishment_id
      and p.is_active
      and ps.service_id = p_service_id
      and (p_professional_id is null or p.id = p_professional_id)
  ),
  -- Janelas de trabalho do dia, já em timestamptz.
  windows as (
    select
      e.id as pro_id,
      ((p_date + sch.starts_at) at time zone l_tz) as win_start,
      ((p_date + sch.ends_at) at time zone l_tz) as win_end
    from eligible e
    join public.professional_schedules sch on sch.professional_id = e.id
    where sch.weekday = l_weekday
  ),
  -- Funcionamento da loja: recorta as janelas, nunca as amplia.
  open_hours as (
    select
      ((p_date + bh.opens_at) at time zone l_tz) as open_start,
      ((p_date + bh.closes_at) at time zone l_tz) as open_end
    from public.business_hours bh
    where bh.establishment_id = p_establishment_id
      and bh.weekday = l_weekday
  ),
  -- Bloqueios: exceção da loja inteira ou do profissional.
  blocks as (
    select
      ex.professional_id as pro_id,
      case
        when ex.starts_at is null then ((p_date::timestamp) at time zone l_tz)
        else ((p_date + ex.starts_at) at time zone l_tz)
      end as block_start,
      case
        when ex.ends_at is null then ((p_date::timestamp + interval '1 day') at time zone l_tz)
        else ((p_date + ex.ends_at) at time zone l_tz)
      end as block_end
    from public.schedule_exceptions ex
    where ex.establishment_id = p_establishment_id
      and ex.exception_date = p_date
      and not ex.is_available
  ),
  candidates as (
    select w.pro_id, gs as c_start, gs + l_duration as c_end
    from windows w
    cross join lateral generate_series(
      w.win_start,
      w.win_end - l_duration,
      make_interval(mins => l_interval)
    ) as gs
  )
  select c.pro_id, c.c_start, c.c_end
  from candidates c
  where
    -- Nada no passado, nem dentro da antecedência mínima.
    c.c_start >= now() + make_interval(mins => l_lead)
    -- Cabe inteiro dentro de algum turno de funcionamento.
    and exists (
      select 1 from open_hours o
      where c.c_start >= o.open_start and c.c_end <= o.open_end
    )
    -- Não colide com bloqueio da loja nem do profissional.
    and not exists (
      select 1 from blocks b
      where (b.pro_id is null or b.pro_id = c.pro_id)
        and tstzrange(b.block_start, b.block_end) && tstzrange(c.c_start, c.c_end)
    )
    -- Não colide com reserva ativa.
    and not exists (
      select 1 from public.appointments a
      where a.professional_id = c.pro_id
        and a.status in ('scheduled', 'confirmed')
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(c.c_start, c.c_end)
    )
  order by c.c_start, c.pro_id;
end;
$$;

revoke execute on function public.available_slots(uuid, uuid, date, uuid) from public;
grant execute on function public.available_slots(uuid, uuid, date, uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Resumo por dia — alimenta "6 de 14 horários livres" e o anel de vez
-- ---------------------------------------------------------------------------
-- Existe para a tela não precisar puxar todos os horários de sete dias só para
-- contar. Chama a mesma função acima: uma fonte de verdade, não duas.

create function public.availability_summary(
  p_establishment_id uuid,
  p_service_id uuid,
  p_from date,
  p_days integer default 7,
  p_professional_id uuid default null
)
returns table (
  day date,
  free_count integer,
  -- "Zero horários" tem duas causas que o usuário lê de formas opostas: a loja
  -- está lotada, ou a loja não abre nesse dia. Uma fita de dias que escreve
  -- "CHEIO" no domingo de uma barbearia que fecha aos domingos está mentindo.
  is_open boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d::date as day,
    (select count(*) from public.available_slots(
       p_establishment_id, p_service_id, d::date, p_professional_id))::integer,
    exists (
      select 1 from public.business_hours bh
      where bh.establishment_id = p_establishment_id
        and bh.weekday = extract(dow from d)::smallint
    )
    and not exists (
      -- Bloqueio de dia inteiro da loja: feriado fecha a casa.
      select 1 from public.schedule_exceptions ex
      where ex.establishment_id = p_establishment_id
        and ex.exception_date = d::date
        and ex.professional_id is null
        and ex.starts_at is null
        and not ex.is_available
    )
  from generate_series(p_from, p_from + (greatest(p_days, 1) - 1), interval '1 day') d
$$;

revoke execute on function public.availability_summary(uuid, uuid, date, integer, uuid) from public;
grant execute on function public.availability_summary(uuid, uuid, date, integer, uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.business_hours enable row level security;
alter table public.professional_schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.appointments enable row level security;

-- Horário de funcionamento é vitrine: quem olha a loja precisa ver se ela abre
-- no domingo antes de decidir criar conta.
create policy business_hours_select_public
  on public.business_hours for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.establishments e
      where e.id = establishment_id and e.status = 'active'
    )
  );

create policy business_hours_write_manager
  on public.business_hours for all
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]))
  with check (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]));

-- Jornada individual não é pública: ela diz quando cada pessoa está no
-- trabalho. O cliente não precisa disso — precisa dos horários livres, que
-- vêm pela função.
create policy professional_schedules_select_member
  on public.professional_schedules for select
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id and public.is_establishment_member(p.establishment_id)
    )
  );

create policy professional_schedules_write_manager
  on public.professional_schedules for all
  to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id
        and public.has_establishment_role(p.establishment_id, array['owner', 'manager']::public.establishment_role[])
    )
  )
  with check (
    exists (
      select 1 from public.professionals p
      where p.id = professional_id
        and public.has_establishment_role(p.establishment_id, array['owner', 'manager']::public.establishment_role[])
    )
  );

create policy schedule_exceptions_select_member
  on public.schedule_exceptions for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

create policy schedule_exceptions_write_member
  on public.schedule_exceptions for all
  to authenticated
  using (public.is_establishment_member(establishment_id))
  with check (public.is_establishment_member(establishment_id));

-- Reservas: o cliente vê as dele, a equipe vê as da loja.
create policy appointments_select_own
  on public.appointments for select
  to authenticated
  using (customer_id = (select auth.uid()));

create policy appointments_select_establishment
  on public.appointments for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

-- Sem política de INSERT de propósito: criar reserva passa por Edge Function,
-- que valida disponibilidade, congela preço e calcula sinal. Deixar o cliente
-- inserir direto permitiria reserva com preço escolhido por ele.

-- O cliente só pode cancelar, e só o que ainda não aconteceu. Qualquer outra
-- transição de status é da equipe (ou da Edge Function).
create policy appointments_cancel_own
  on public.appointments for update
  to authenticated
  using (
    customer_id = (select auth.uid())
    and status in ('scheduled', 'confirmed')
  )
  with check (
    customer_id = (select auth.uid())
    and status = 'cancelled_by_customer'
  );

create policy appointments_update_establishment
  on public.appointments for all
  to authenticated
  using (public.is_establishment_member(establishment_id))
  with check (public.is_establishment_member(establishment_id));
