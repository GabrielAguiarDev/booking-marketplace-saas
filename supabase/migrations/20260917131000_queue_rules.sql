-- ---------------------------------------------------------------------------
-- Os ajustes da fila passam a atuar
-- ---------------------------------------------------------------------------
-- `establishment_settings` gravava cinco ajustes de fila que nenhuma peça lia
-- (decisão 0007, "o que fica gravado e ainda não atua"). A partir daqui o
-- banco os aplica — a todas as superfícies de uma vez, porque a regra mora
-- num gatilho e em `queue_state()`, não numa tela:
--
--   queue_remote_join        sem ele, o cliente não entra pelo app de longe;
--                            só pelo QR do balcão ou pela equipe.
--   queue_qr_enabled         a loja tem um código de balcão; entrar com ele
--                            (`queue_join`) é entrar já presente.
--   queue_per_professional   posição e espera contadas por profissional.
--   queue_auto_close         para de aceitar entrada pelo app quando a espera
--                            de quem chega passaria de `queue_close_after_minutes`.
--   queue_auto_skip          quem foi chamado e não apareceu em 2 minutos vira
--                            `no_show` (cron a cada minuto).
--
-- O aviso na vez (`queue_notify_enabled`/`queue_notify_channel`) passou a
-- atuar em `20260917100000_notifications.sql`.
--
-- A equipe (`source = 'counter'`) não é barrada por nenhum destes: o balcão
-- decide na hora. Erros levam código estável em `hint`.

-- ---------------------------------------------------------------------------
-- Código do balcão
-- ---------------------------------------------------------------------------
-- Tabela própria, e não coluna em `establishment_settings`, porque settings é
-- de leitura pública e o código só vale enquanto não for público: quem o tem
-- está (ou esteve) na frente do cartaz. Rotacionar invalida o cartaz antigo.

create table public.establishment_queue_codes (
  establishment_id uuid primary key references public.establishments (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{8}$'),
  rotated_at timestamptz not null default now(),
  rotated_by uuid references public.profiles (id) on delete set null
);

comment on table public.establishment_queue_codes is
  'Código do QR do balcão. Só dono e gerência leem; escrita só por queue_qr_code/rotate_queue_qr_code.';

alter table public.establishment_queue_codes enable row level security;

create policy establishment_queue_codes_select_manager
  on public.establishment_queue_codes for select
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]));

create function public.queue_new_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- Sem 0/O/1/I: o código também é digitável.
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(b, i) % 32) + 1, 1), '')
  from extensions.gen_random_bytes(8) as b, generate_series(0, 7) as i;
$$;

revoke execute on function public.queue_new_code() from public, anon, authenticated;

-- Devolve o código (criando na primeira vez). O conteúdo do QR é montado pelo
-- app: `vezcliente://fila/<establishment_id>?codigo=<code>`.
create function public.queue_qr_code(p_establishment_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_code text;
begin
  perform public.assert_establishment_manager(p_establishment_id);
  insert into public.establishment_queue_codes (establishment_id, code, rotated_by)
  values (p_establishment_id, public.queue_new_code(), (select auth.uid()))
  on conflict (establishment_id) do nothing;
  select c.code into l_code from public.establishment_queue_codes c
  where c.establishment_id = p_establishment_id;
  return l_code;
end;
$$;

create function public.rotate_queue_qr_code(p_establishment_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_code text := public.queue_new_code();
begin
  perform public.assert_establishment_manager(p_establishment_id);
  insert into public.establishment_queue_codes (establishment_id, code, rotated_by)
  values (p_establishment_id, l_code, (select auth.uid()))
  on conflict (establishment_id) do update
  set code = excluded.code, rotated_at = now(), rotated_by = excluded.rotated_by;
  return l_code;
end;
$$;

-- Interna: confere o código sem revelar qual é o certo.
create function public.queue_code_matches(p_establishment_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.establishment_queue_codes c
    where c.establishment_id = p_establishment_id
      and c.code = upper(btrim(coalesce(p_code, '')))
  );
$$;

revoke execute on function public.queue_qr_code(uuid) from public, anon;
grant execute on function public.queue_qr_code(uuid) to authenticated, service_role;
revoke execute on function public.rotate_queue_qr_code(uuid) from public, anon;
grant execute on function public.rotate_queue_qr_code(uuid) to authenticated, service_role;
revoke execute on function public.queue_code_matches(uuid, text) from public, anon;
grant execute on function public.queue_code_matches(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A espera de quem chegaria agora
-- ---------------------------------------------------------------------------
-- A mesma conta de `queue_state()` para uma posição que ainda não existe. É o
-- que `queue_auto_close` compara com `queue_close_after_minutes`.

create function public.queue_wait_for_newcomer(
  p_establishment_id uuid,
  p_professional_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select
      coalesce(s.queue_require_arrival, false) as require_arrival,
      coalesce(s.queue_per_professional, false) as per_professional
    from (select 1) one
    left join public.establishment_settings s on s.establishment_id = p_establishment_id
  ),
  lane as (
    select case
      when (select per_professional from settings) and p_professional_id is not null
        then p_professional_id::text
      else '*'
    end as key
  )
  select (
    coalesce(sum(coalesce(sv.duration_minutes, 30)), 0)
    / greatest(
        case when (select key from lane) <> '*' then 1
        else (select count(*) from public.professionals p
              where p.establishment_id = p_establishment_id and p.is_active)
        end,
        1
      )
  )::integer
  from public.queue_entries q
  left join public.services sv on sv.id = q.service_id
  where q.establishment_id = p_establishment_id
    and q.status = 'waiting'
    and (not (select require_arrival from settings) or q.arrived_at is not null)
    and case
      when (select per_professional from settings) then coalesce(q.professional_id::text, '*')
      else '*'
    end = (select key from lane);
$$;

revoke execute on function public.queue_wait_for_newcomer(uuid, uuid) from public;
grant execute on function public.queue_wait_for_newcomer(uuid, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- O gatilho que aplica as regras
-- ---------------------------------------------------------------------------
-- `vez.queue_code_ok` é marcada por `queue_join`/`queue_confirm_arrival` depois
-- de conferirem o código, e vale só na transação (`set_config(..., true)`).
-- Pelo PostgREST ninguém chama `set_config` direto: `pg_catalog` não é exposto.

create function public.guard_queue_entry_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_settings public.establishment_settings;
  l_code_ok boolean :=
    coalesce(current_setting('vez.queue_code_ok', true) = new.establishment_id::text, false);
  l_self boolean := new.customer_id is not null and new.customer_id = (select auth.uid());
  l_wait integer;
begin
  select * into l_settings from public.establishment_settings s
  where s.establishment_id = new.establishment_id;

  if tg_op = 'INSERT' then
    if new.professional_id is not null and not exists (
      select 1 from public.professionals p
      where p.id = new.professional_id
        and p.establishment_id = new.establishment_id
        and p.is_active
    ) then
      raise exception 'Profissional não atende nesta loja.' using errcode = 'P0001', hint = 'queue_invalid_professional';
    end if;

    if new.source = 'counter' then
      return new;
    end if;

    if new.source = 'qr' then
      if not coalesce(l_settings.queue_qr_enabled, false) then
        raise exception 'Esta loja não usa QR no balcão.' using errcode = 'P0001', hint = 'queue_qr_disabled';
      end if;
      if not l_code_ok then
        raise exception 'Leia o QR do balcão para entrar.' using errcode = 'P0001', hint = 'queue_code_required';
      end if;
      -- Quem leu o cartaz está no balcão.
      new.arrived_at := coalesce(new.arrived_at, now());
    else
      if not coalesce(l_settings.queue_remote_join, true) then
        raise exception '%',
          case when coalesce(l_settings.queue_qr_enabled, false)
            then 'Esta loja só aceita entrada na fila pelo QR do balcão.'
            else 'Esta loja só aceita entrada na fila pelo balcão.'
          end
          using errcode = 'P0001', hint = 'queue_remote_join_disabled';
      end if;
      -- Pelo app de longe ninguém se declara presente; a chegada é confirmada
      -- depois, pelo método da loja.
      new.arrived_at := null;
    end if;

    if coalesce(l_settings.queue_auto_close, false) then
      l_wait := public.queue_wait_for_newcomer(new.establishment_id, new.professional_id);
      if l_wait > l_settings.queue_close_after_minutes then
        raise exception 'A fila está cheia agora (espera acima de % min). Tente mais tarde.',
          l_settings.queue_close_after_minutes
          using errcode = 'P0001', hint = 'queue_closed_full';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE: o próprio cliente confirmando chegada.
  if l_self
    and old.arrived_at is null
    and new.arrived_at is not null
    and not public.is_establishment_member(new.establishment_id)
  then
    if l_settings.queue_arrival_method = 'staff' then
      raise exception 'Nesta loja a chegada é confirmada pela equipe no balcão.'
        using errcode = 'P0001', hint = 'queue_arrival_by_staff';
    end if;
    -- Método QR só é exigível se a loja tem o cartaz ligado; sem cartaz não
    -- haveria como confirmar.
    if l_settings.queue_arrival_method = 'qr'
      and coalesce(l_settings.queue_qr_enabled, false)
      and not l_code_ok
    then
      raise exception 'Leia o QR do balcão para confirmar a chegada.'
        using errcode = 'P0001', hint = 'queue_code_required';
    end if;
    new.arrived_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_queue_entry_rules() from public, anon, authenticated, service_role;

create trigger queue_entries_guard_rules
  before insert or update of arrived_at on public.queue_entries
  for each row execute function public.guard_queue_entry_rules();

-- ---------------------------------------------------------------------------
-- Entrar e confirmar chegada com o código
-- ---------------------------------------------------------------------------
-- `security invoker`: a escrita continua passando pela RLS do cliente
-- (`queue_entries_insert_own`, `queue_entries_update_own`). A função só
-- confere o código e marca a transação.

create function public.queue_join(
  p_establishment_id uuid,
  p_service_id uuid default null,
  p_professional_id uuid default null,
  p_code text default null
)
returns uuid
language plpgsql
security invoker
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
  if nullif(btrim(coalesce(p_code, '')), '') is not null then
    if not public.queue_code_matches(p_establishment_id, p_code) then
      raise exception 'Código do balcão inválido. Leia o QR de novo.'
        using errcode = 'P0001', hint = 'queue_code_invalid';
    end if;
    perform set_config('vez.queue_code_ok', p_establishment_id::text, true);
    l_source := 'qr'::public.queue_source;
  end if;

  insert into public.queue_entries (establishment_id, customer_id, service_id, professional_id, source)
  values (p_establishment_id, l_uid, p_service_id, p_professional_id, l_source)
  returning id into l_id;
  return l_id;
exception
  when unique_violation then
    raise exception 'Você já está nesta fila.' using errcode = '23505', hint = 'queue_already_in';
end;
$$;

create function public.queue_confirm_arrival(p_entry_id uuid, p_code text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  l_establishment_id uuid;
begin
  select q.establishment_id into l_establishment_id
  from public.queue_entries q
  where q.id = p_entry_id and q.customer_id = (select auth.uid());
  if l_establishment_id is null then
    raise exception 'Entrada na fila não encontrada.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if nullif(btrim(coalesce(p_code, '')), '') is not null then
    if not public.queue_code_matches(l_establishment_id, p_code) then
      raise exception 'Código do balcão inválido. Leia o QR de novo.'
        using errcode = 'P0001', hint = 'queue_code_invalid';
    end if;
    perform set_config('vez.queue_code_ok', l_establishment_id::text, true);
  end if;
  update public.queue_entries q
  set arrived_at = now()
  where q.id = p_entry_id and q.arrived_at is null;
end;
$$;

revoke execute on function public.queue_join(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.queue_join(uuid, uuid, uuid, text) to authenticated, service_role;
revoke execute on function public.queue_confirm_arrival(uuid, text) from public, anon;
grant execute on function public.queue_confirm_arrival(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- `queue_state()` por profissional
-- ---------------------------------------------------------------------------
-- Com `queue_per_professional` desligado (o padrão) o resultado é o mesmo de
-- `20260903140000_queue_arrival_position.sql`. Ligado, cada profissional tem a
-- própria fila: posição conta só quem espera por ele, e a espera divide por 1.
-- Quem entrou sem escolher ("o que der") fica numa fila comum da loja, dividida
-- por todos os profissionais ativos.

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
    select
      coalesce(s.queue_require_arrival, false) as require_arrival,
      coalesce(s.queue_per_professional, false) as per_professional
    from (select 1) one
    left join public.establishment_settings s on s.establishment_id = p_establishment_id
  ),
  active as (
    select
      q.id,
      q.customer_id,
      q.status,
      q.joined_at,
      (
        q.status = 'waiting'
        and (not (select require_arrival from settings) or q.arrived_at is not null)
      ) as in_line,
      case
        when (select per_professional from settings) then coalesce(q.professional_id::text, '*')
        else '*'
      end as lane,
      coalesce(s.duration_minutes, 30) as duration
    from public.queue_entries q
    left join public.services s on s.id = q.service_id
    where q.establishment_id = p_establishment_id
      and q.status in ('waiting', 'called', 'in_service')
  ),
  ranked as (
    select
      a.*,
      case
        when a.in_line
          then row_number() over (partition by a.in_line, a.lane order by a.joined_at)
        else 0
      end as pos,
      case
        when a.lane <> '*' then 1
        else (
          select count(*) from public.professionals p
          where p.establishment_id = p_establishment_id and p.is_active
        )
      end as pros
    from active a
  )
  select
    r.id,
    r.customer_id,
    r.pos::integer,
    r.status,
    r.joined_at,
    (
      coalesce((
        select sum(r2.duration) from ranked r2
        where r2.in_line and r2.lane = r.lane and r2.joined_at < r.joined_at
      ), 0) / greatest(r.pros, 1)
    )::integer
  from ranked r
  order by r.joined_at
$$;

revoke execute on function public.queue_state(uuid) from public;
grant execute on function public.queue_state(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Pular quem não responde (`queue_auto_skip`)
-- ---------------------------------------------------------------------------

create function public.queue_maintenance()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_count integer;
begin
  update public.queue_entries q
  set status = 'no_show', finished_at = now()
  from public.establishment_settings s
  where s.establishment_id = q.establishment_id
    and s.queue_auto_skip
    and q.status = 'called'
    and q.called_at < now() - interval '2 minutes';
  get diagnostics l_count = row_count;
  return l_count;
end;
$$;

revoke execute on function public.queue_maintenance() from public, anon, authenticated;
grant execute on function public.queue_maintenance() to service_role;

select cron.schedule('queue-maintenance', '* * * * *', 'select public.queue_maintenance()');
