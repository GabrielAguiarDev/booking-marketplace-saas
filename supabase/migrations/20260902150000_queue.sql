-- ---------------------------------------------------------------------------
-- Fila por ordem de chegada
-- ---------------------------------------------------------------------------

create type public.queue_status as enum (
  'waiting',
  'called',      -- chamado, ainda não sentou
  'in_service',
  'done',
  'left',        -- desistiu
  'no_show'      -- foi chamado e não apareceu
);

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  -- Opcional: dá para entrar na fila sem escolher o serviço ("o que der").
  -- Quando existe, a estimativa de espera usa a duração real em vez da média.
  service_id uuid references public.services (id) on delete set null,
  professional_id uuid references public.professionals (id) on delete set null,
  status public.queue_status not null default 'waiting',
  joined_at timestamptz not null default now(),
  called_at timestamptz,
  served_at timestamptz,
  finished_at timestamptz,
  -- Confirmação de chegada do cliente ("Confirmar chegada" na Home).
  arrived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.queue_entries is
  'Fila viva. A posição NÃO é coluna: é derivada da ordem de joined_at entre os que esperam — coluna de posição corrompe sob concorrência.';

-- Uma pessoa não pode estar duas vezes na mesma fila. Índice parcial porque
-- ela pode voltar amanhã: o que é único é estar ativo agora.
create unique index queue_entries_one_active_per_customer
  on public.queue_entries (establishment_id, customer_id)
  where status in ('waiting', 'called', 'in_service');

create index queue_entries_active_idx
  on public.queue_entries (establishment_id, joined_at)
  where status in ('waiting', 'called', 'in_service');

create index queue_entries_customer_idx
  on public.queue_entries (customer_id, joined_at desc);

create trigger queue_entries_set_updated_at
  before update on public.queue_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Estado da fila
-- ---------------------------------------------------------------------------
-- Posição e espera são função, não coluna, pelo mesmo motivo da decisão 0001:
-- o portal e o app precisam dizer o mesmo número. Se cada um contasse por
-- conta própria, o balcão diria "faltam dois" e o telefone diria "faltam três".

create function public.queue_state(p_establishment_id uuid)
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
  with active as (
    select
      q.id,
      q.customer_id,
      q.status,
      q.joined_at,
      -- Sem serviço escolhido, usa 30 min como duração típica de atendimento.
      coalesce(s.duration_minutes, 30) as duration
    from public.queue_entries q
    left join public.services s on s.id = q.service_id
    where q.establishment_id = p_establishment_id
      and q.status in ('waiting', 'called', 'in_service')
  ),
  ranked as (
    select
      a.*,
      -- Quem já foi chamado ou está sentado não tem posição na fila, mas
      -- continua ocupando o profissional — por isso segue em `active`.
      case
        when a.status = 'waiting'
          then row_number() over (
            partition by (a.status = 'waiting') order by a.joined_at
          )
        else 0
      end as pos,
      (
        select count(*) from public.professionals p
        where p.establishment_id = p_establishment_id and p.is_active
      ) as pros
    from active a
  )
  select
    r.id,
    r.customer_id,
    r.pos::integer,
    r.status,
    r.joined_at,
    -- Espera estimada: a soma da duração de quem chegou antes, dividida pelo
    -- número de profissionais atendendo. Duas cadeiras cortam a fila pela
    -- metade, e é isso que o cliente sente.
    (
      coalesce((
        select sum(r2.duration) from ranked r2 where r2.joined_at < r.joined_at
      ), 0) / greatest(r.pros, 1)
    )::integer
  from ranked r
  order by r.joined_at
$$;

revoke execute on function public.queue_state(uuid) from public;
grant execute on function public.queue_state(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.queue_entries enable row level security;

create policy queue_entries_select_own
  on public.queue_entries for select
  to authenticated
  using (customer_id = (select auth.uid()));

create policy queue_entries_select_establishment
  on public.queue_entries for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

-- Entrar na fila é a única escrita que o cliente faz direto: não há preço a
-- congelar nem horário a validar, e o índice parcial já impede entrada dupla.
create policy queue_entries_insert_own
  on public.queue_entries for insert
  to authenticated
  with check (
    customer_id = (select auth.uid())
    and status = 'waiting'
    and exists (
      select 1 from public.establishments e
      where e.id = establishment_id
        and e.status = 'active'
        and e.booking_mode in ('queue', 'both')
    )
  );

-- O cliente pode desistir e confirmar chegada. Chamar, sentar e concluir é da
-- equipe — senão qualquer um se promoveria para 'in_service'.
create policy queue_entries_update_own
  on public.queue_entries for update
  to authenticated
  using (
    customer_id = (select auth.uid())
    and status in ('waiting', 'called')
  )
  with check (
    customer_id = (select auth.uid())
    and status in ('waiting', 'called', 'left')
  );

create policy queue_entries_manage_establishment
  on public.queue_entries for all
  to authenticated
  using (public.is_establishment_member(establishment_id))
  with check (public.is_establishment_member(establishment_id));
