-- ---------------------------------------------------------------------------
-- Quem ainda não chegou não segura a fila
-- ---------------------------------------------------------------------------
-- `establishment_settings.queue_require_arrival` nasceu na migration anterior
-- e não mudava nada: `queue_state()` ordenava por `joined_at` sem olhar
-- `arrived_at`. O resultado era o pior dos dois mundos — a loja ligava a
-- confirmação de chegada, e quem pegou senha do sofá de casa continuava
-- ocupando a primeira posição enquanto quem estava em pé no balcão esperava.
--
-- A correção fica aqui, e não na tela, pela decisão 0001: posição e espera são
-- do Postgres. Se o app do estabelecimento reordenasse por conta própria, o
-- balcão diria "você é o segundo" e o celular do cliente diria "você é o
-- primeiro" — os dois lendo o mesmo banco.
--
-- Com a confirmação desligada (o padrão) o resultado é idêntico ao de antes.

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
    select coalesce(
      (select s.queue_require_arrival
       from public.establishment_settings s
       where s.establishment_id = p_establishment_id),
      false
    ) as require_arrival
  ),
  active as (
    select
      q.id,
      q.customer_id,
      q.status,
      q.joined_at,
      -- Quem espera de verdade: ou a loja não exige confirmação, ou a pessoa
      -- já confirmou que chegou.
      (
        q.status = 'waiting'
        and (not (select require_arrival from settings) or q.arrived_at is not null)
      ) as in_line,
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
      -- Quem já foi chamado, está sentado, ou ainda não confirmou chegada não
      -- tem posição — mas segue em `active`, porque continua ocupando o
      -- profissional (os dois primeiros) ou continua na tela (o terceiro).
      case
        when a.in_line
          then row_number() over (partition by a.in_line order by a.joined_at)
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
    -- Espera estimada: a soma da duração de quem está na frente, dividida pelo
    -- número de profissionais atendendo. Quem não confirmou chegada não entra
    -- nessa soma — senão inflaria a espera de quem está no balcão com gente
    -- que talvez nem venha.
    (
      coalesce((
        select sum(r2.duration) from ranked r2
        where r2.in_line and r2.joined_at < r.joined_at
      ), 0) / greatest(r.pros, 1)
    )::integer
  from ranked r
  order by r.joined_at
$$;

revoke execute on function public.queue_state(uuid) from public;
grant execute on function public.queue_state(uuid) to anon, authenticated, service_role;
