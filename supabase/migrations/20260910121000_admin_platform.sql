-- ---------------------------------------------------------------------------
-- Painel administrativo da plataforma
-- ---------------------------------------------------------------------------
-- O que o canvas `Vez Portal Admin.dc.html` pede e o banco não tinha: planos e
-- cota por cidade, decisão sobre cadastro, moderação de avaliação, bloqueio de
-- cliente, catálogo global, parâmetros da plataforma e registro de auditoria.
--
-- Nenhuma tabela nova tem política de escrita. Toda mudança passa por uma
-- função `admin_*` que confere o papel em `platform_admins`, valida a regra de
-- negócio e grava a linha de auditoria na mesma transação — a auditoria não
-- depende de a tela lembrar de escrevê-la.
--
-- Fica de fora, de propósito: cobrança e repasse. Emitir fatura depende do
-- provedor de pagamento, que é decisão em aberto (proximos-passos.md, item 5).

-- ---------------------------------------------------------------------------
-- Equipe da plataforma
-- ---------------------------------------------------------------------------

alter table public.platform_admins
  add column role public.platform_role not null default 'admin',
  add column last_seen_at timestamptz;

-- O schema inicial permitia escrita direta a qualquer platform_admin. O painel
-- agora usa somente RPCs transacionais para não contornar validação e auditoria.
drop policy if exists cities_write_admin on public.cities;
drop policy if exists establishments_write_admin on public.establishments;
drop policy if exists establishment_members_write_admin on public.establishment_members;
drop policy if exists reviews_delete_admin on public.reviews;

-- ---------------------------------------------------------------------------
-- Cidades: lançamento, cota e preço da mensalidade
-- ---------------------------------------------------------------------------
-- `is_active` continua sendo o que o app do cliente lê para mostrar a cidade.
-- `launch_status` é o ciclo que o admin gerencia; só `active` aparece na busca.

alter table public.cities
  add column launch_status public.city_launch_status not null default 'active',
  add column monthly_quota integer not null default 0 check (monthly_quota >= 0),
  add column monthly_price_cents integer check (monthly_price_cents > 0);

-- ---------------------------------------------------------------------------
-- Planos
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  kind public.plan_kind not null,
  name text not null check (char_length(name) between 3 and 80),
  is_active boolean not null default false,
  -- O plano que a aprovação usa para cada tipo. Um por tipo.
  is_default boolean not null default false,
  commission_percent numeric(5, 2) check (commission_percent between 0 and 100),
  max_professionals integer check (max_professionals > 0),
  max_branches integer check (max_branches > 0),
  queue_included boolean not null default true,
  integrated_payment text not null default 'optional'
    check (integrated_payment in ('optional', 'required')),
  search_highlight boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_commission_has_percent
    check (kind <> 'commission' or commission_percent is not null)
);

create unique index plans_one_default_per_kind on public.plans (kind) where is_default;

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- Os dois planos do brief. É dado do modelo, não demonstração: sem eles a
-- aprovação não tem em que plano colocar a loja.
insert into public.plans (
  kind, name, is_active, is_default, commission_percent, max_professionals,
  max_branches, queue_included, integrated_payment, search_highlight
) values
  ('monthly', 'Mensalidade fixa', true, true, null, 12, 3, true, 'optional', true),
  ('commission', 'Comissão por agendamento', true, true, 12, null, 1, true, 'required', false);

alter table public.plans enable row level security;

-- O catálogo de planos não é segredo: a landing e o portal da loja mostram.
create policy plans_select_active
  on public.plans for select
  to anon, authenticated
  using (is_active or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Estabelecimentos: dados do cadastro, plano e desconto
-- ---------------------------------------------------------------------------

alter table public.establishments
  add column plan_id uuid references public.plans (id) on delete restrict,
  add column cnpj text,
  add column legal_name text,
  add column responsible_name text,
  add column contact_email text,
  add column submitted_at timestamptz not null default now(),
  add column status_changed_at timestamptz not null default now(),
  add column plan_changed_at timestamptz,
  add column status_reason text,
  add column discount_percent integer check (discount_percent between 1 and 100),
  add column discount_until date;

create index establishments_plan_id_idx on public.establishments (plan_id);

-- O gatilho da decisão 0008 protegia só `status`. Plano, desconto e o motivo
-- da suspensão estão na mesma tabela e sofrem do mesmo problema: a política
-- `establishments_update_manager` não distingue coluna, então um dono podia
-- se colocar na mensalidade sem vaga ou se dar 100% de desconto.
--
-- Os gatilhos que decidem "quem está escrevendo" são `security invoker` de
-- propósito: num `security definer`, `current_user` é sempre o dono da função
-- (postgres) e a checagem passaria para qualquer um. Como invoker, uma escrita
-- direta pelo app chega como `authenticated`, e a feita por dentro de uma RPC
-- `admin_*` (definer, dona postgres) chega como `postgres`.
create or replace function public.guard_establishment_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  l_privileged boolean :=
    current_user = 'postgres'
    or current_setting('role', true) = 'service_role'
    ;
begin
  if not l_privileged and (
    new.status is distinct from old.status
    or new.plan_id is distinct from old.plan_id
    or new.plan_changed_at is distinct from old.plan_changed_at
    or new.discount_percent is distinct from old.discount_percent
    or new.discount_until is distinct from old.discount_until
    or new.status_reason is distinct from old.status_reason
  ) then
    raise exception 'situação, plano e desconto do estabelecimento só mudam por admin da plataforma'
      using errcode = '42501';
  end if;

  -- carimbo de quando a situação mudou: ninguém escreve à mão
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    new.status_changed_at := old.status_changed_at;
  end if;

  if new.plan_id is distinct from old.plan_id then
    new.plan_changed_at := now();
  else
    new.plan_changed_at := old.plan_changed_at;
  end if;

  return new;
end;
$$;

-- Lojas que já existiam antes dos planos entram no modelo de comissão. As
-- pendentes continuam sem plano até a decisão do admin. Este backfill vem
-- depois da troca do guard para também funcionar em bancos já populados.
update public.establishments
set plan_id = (select id from public.plans where kind = 'commission' and is_default)
where plan_id is null and status in ('active', 'suspended');

-- ---------------------------------------------------------------------------
-- Decisões sobre cadastro
-- ---------------------------------------------------------------------------

create table public.establishment_decisions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  decision public.application_decision not null,
  plan_id uuid references public.plans (id) on delete set null,
  message text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz not null default now()
);

create index establishment_decisions_establishment_idx
  on public.establishment_decisions (establishment_id, decided_at desc);
create index establishment_decisions_decided_at_idx
  on public.establishment_decisions (decided_at desc);

alter table public.establishment_decisions enable row level security;

create policy establishment_decisions_select_admin
  on public.establishment_decisions for select
  to authenticated
  using (public.is_platform_admin());

-- A loja lê a decisão sobre ela — é por aí que recebe a mensagem de correção.
create policy establishment_decisions_select_member
  on public.establishment_decisions for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

-- ---------------------------------------------------------------------------
-- Parâmetros da plataforma
-- ---------------------------------------------------------------------------
-- Uma linha só. A comissão padrão não mora aqui: ela é o percentual do plano de
-- comissão padrão, para não existirem dois lugares que podem divergir.

create table public.platform_settings (
  id boolean primary key default true check (id),
  cancellation_window_hours integer not null default 4 check (cancellation_window_hours >= 0),
  no_show_block_threshold integer not null default 3 check (no_show_block_threshold >= 1),
  delinquency_grace_days integer not null default 15 check (delinquency_grace_days >= 0),
  queue_max_per_professional integer not null default 8 check (queue_max_per_professional >= 1),
  plan_change_interval_days integer not null default 90 check (plan_change_interval_days >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.platform_settings default values;

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

create policy platform_settings_select_all
  on public.platform_settings for select
  to anon, authenticated
  using (true);

-- A janela de cancelamento continua sendo da loja (`cancellation_window_minutes`,
-- que a equipe ajusta no app). O parâmetro da plataforma é só o valor com que
-- uma loja nova nasce; mudar o parâmetro não mexe nas lojas existentes.
create function public.default_cancellation_window_minutes()
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select s.cancellation_window_hours * 60 from public.platform_settings s where s.id = true),
    120
  );
$$;

revoke execute on function public.default_cancellation_window_minutes() from public, anon;
grant execute on function public.default_cancellation_window_minutes() to authenticated, service_role;

alter table public.establishments
  alter column cancellation_window_minutes set default public.default_cancellation_window_minutes();

-- O limite editável no admin é aplicado no banco, inclusive para entradas pelo
-- app do cliente e pelo balcão. O advisory lock fecha a corrida entre inserts.
create function public.guard_queue_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_max integer;
  l_professionals integer;
  l_total integer;
  l_for_professional integer;
begin
  if new.status <> 'waiting' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('queue:' || new.establishment_id::text, 0)
  );
  select queue_max_per_professional into l_max
  from public.platform_settings where id = true;
  select greatest(count(*), 1)::integer into l_professionals
  from public.professionals
  where establishment_id = new.establishment_id and is_active;
  select count(*)::integer into l_total
  from public.queue_entries
  where establishment_id = new.establishment_id
    and status in ('waiting', 'called', 'in_service');

  if l_total >= l_max * l_professionals then
    raise exception 'A fila atingiu o limite de % pessoa(s) por profissional.', l_max
      using errcode = 'P0001';
  end if;

  if new.professional_id is not null then
    select count(*)::integer into l_for_professional
    from public.queue_entries
    where establishment_id = new.establishment_id
      and professional_id = new.professional_id
      and status in ('waiting', 'called', 'in_service');
    if l_for_professional >= l_max then
      raise exception 'A fila deste profissional atingiu o limite de % pessoa(s).', l_max
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger queue_entries_guard_capacity
  before insert on public.queue_entries
  for each row execute function public.guard_queue_capacity();

revoke execute on function public.guard_queue_capacity() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Registro de auditoria e sessões de acesso a conta
-- ---------------------------------------------------------------------------

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null,
  actor_role public.platform_role,
  action text not null,
  meta text not null default '',
  account_access boolean not null default false,
  establishment_id uuid references public.establishments (id) on delete set null,
  establishment_name text,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_establishment_idx
  on public.admin_audit_log (establishment_id) where account_access;

alter table public.admin_audit_log enable row level security;

create policy admin_audit_log_select_admin
  on public.admin_audit_log for select
  to authenticated
  using (public.is_platform_admin());

-- "Visível ao estabelecimento no registro dele": a loja vê quem da plataforma
-- entrou na conta dela, quando e por quê.
create policy admin_audit_log_select_member_access
  on public.admin_audit_log for select
  to authenticated
  using (
    account_access
    and public.has_establishment_role(
      establishment_id,
      array['owner', 'manager']::public.establishment_role[]
    )
  );

create table public.admin_access_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  admin_name text not null,
  admin_role public.platform_role not null,
  establishment_id uuid references public.establishments (id) on delete set null,
  establishment_name text not null,
  reason text not null check (char_length(reason) >= 10),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint admin_access_sessions_expires_after_start check (expires_at > started_at)
);

create index admin_access_sessions_establishment_idx
  on public.admin_access_sessions (establishment_id, started_at desc);

alter table public.admin_access_sessions enable row level security;

create policy admin_access_sessions_select_admin
  on public.admin_access_sessions for select
  to authenticated
  using (public.is_platform_admin());

create policy admin_access_sessions_select_member
  on public.admin_access_sessions for select
  to authenticated
  using (
    public.has_establishment_role(
      establishment_id,
      array['owner', 'manager']::public.establishment_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- Moderação de avaliações
-- ---------------------------------------------------------------------------
-- Remover não apaga: a avaliação fica, marcada, fora da nota e da busca. Apagar
-- destruiria a prova do que foi decidido.

alter table public.reviews
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id) on delete set null,
  add column removal_reason text;

-- A nota média passa a ignorar avaliação removida.
create or replace function public.refresh_establishment_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_establishment_id uuid := coalesce(new.establishment_id, old.establishment_id);
begin
  update public.establishments e
  set
    rating_avg = sub.avg_rating,
    rating_count = sub.total
  from (
    select
      round(avg(r.rating)::numeric, 2) as avg_rating,
      count(*)::integer as total
    from public.reviews r
    where r.establishment_id = l_establishment_id
      and r.removed_at is null
  ) sub
  where e.id = l_establishment_id;

  return null;
end;
$$;

-- O autor não enxerga as denúncias pela RLS; o gatilho, que roda como quem
-- escreve, pergunta por aqui.
create function public.review_in_moderation(p_review_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- plpgsql: review_reports só é criada mais abaixo nesta migration
  return exists (
    select 1
    from public.review_reports rr
    where rr.review_id = p_review_id
      and rr.status in ('open', 'awaiting_establishment')
  );
end;
$$;

revoke execute on function public.review_in_moderation(uuid) from public, anon;
grant execute on function public.review_in_moderation(uuid) to authenticated, service_role;

-- `reviews_update_own` deixa o autor editar a própria avaliação — e, sem isto,
-- desfazer a remoção dela. Invoker pelo mesmo motivo de guard_establishment_status.
create function public.guard_review_moderation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.appointment_id is distinct from old.appointment_id
    or new.customer_id is distinct from old.customer_id
    or new.establishment_id is distinct from old.establishment_id
    or new.professional_id is distinct from old.professional_id
  ) then
    raise exception 'os vínculos da avaliação são imutáveis' using errcode = '42501';
  end if;

  if current_user <> 'postgres'
    and current_setting('role', true) is distinct from 'service_role'
    and (
      old.removed_at is not null
      or public.review_in_moderation(old.id)
    )
  then
    raise exception 'avaliação em moderação não pode ser editada' using errcode = '42501';
  end if;

  if (
    new.removed_at is distinct from old.removed_at
    or new.removed_by is distinct from old.removed_by
    or new.removal_reason is distinct from old.removal_reason
  )
  and current_user <> 'postgres'
  and current_setting('role', true) is distinct from 'service_role'
  then
    raise exception 'remoção de avaliação é decisão da plataforma' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger reviews_guard_moderation
  before update on public.reviews
  for each row execute function public.guard_review_moderation();

-- Removida some da vitrine…
drop policy reviews_select_public on public.reviews;

create policy reviews_select_public
  on public.reviews for select
  to anon, authenticated
  using (
    removed_at is null
    and exists (
      select 1 from public.establishments e
      where e.id = establishment_id and e.status = 'active'
    )
  );

-- …mas o autor continua vendo a dele. Sem isto o app mostraria "Avaliar" num
-- atendimento já avaliado, e a segunda tentativa bateria no `unique`.
create policy reviews_select_own
  on public.reviews for select
  to authenticated
  using (customer_id = (select auth.uid()));

create policy reviews_select_admin
  on public.reviews for select
  to authenticated
  using (public.is_platform_admin());

create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 80),
  justification text not null default '',
  status public.review_report_status not null default 'open',
  opened_by uuid references public.profiles (id) on delete set null,
  opened_at timestamptz not null default now(),
  clarification_request text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_motive text,
  decision_note text,
  notify_author boolean
);

-- Uma denúncia aberta por avaliação: a segunda seria a mesma pergunta.
create unique index review_reports_one_open
  on public.review_reports (review_id)
  where status in ('open', 'awaiting_establishment');

create index review_reports_establishment_idx on public.review_reports (establishment_id);

alter table public.review_reports enable row level security;

create policy review_reports_select_admin
  on public.review_reports for select
  to authenticated
  using (public.is_platform_admin());

create policy review_reports_select_member
  on public.review_reports for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

-- Dono e gerente denunciam avaliação da própria loja, e só dela.
create policy review_reports_insert_manager
  on public.review_reports for insert
  to authenticated
  with check (
    status = 'open'
    and opened_by = (select auth.uid())
    and public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[])
    and exists (
      select 1 from public.reviews r
      where r.id = review_id and r.establishment_id = review_reports.establishment_id
    )
  );

-- ---------------------------------------------------------------------------
-- Bloqueio de cliente
-- ---------------------------------------------------------------------------
-- Quem lê é a Edge Function `book-appointment`: bloqueado não reserva. O que já
-- estava marcado continua valendo.

create table public.customer_blocks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) >= 3),
  blocked_by uuid references public.profiles (id) on delete set null,
  blocked_at timestamptz not null default now()
);

alter table public.customer_blocks enable row level security;

create policy customer_blocks_select_admin
  on public.customer_blocks for select
  to authenticated
  using (public.is_platform_admin());

create policy customer_blocks_select_own
  on public.customer_blocks for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Catálogo global de serviços
-- ---------------------------------------------------------------------------
-- O catálogo organiza a busca; não substitui o serviço da loja. Cada loja
-- continua com nome, preço e duração próprios em `services`, e aponta para o
-- item do catálogo que o descreve. Serviço sem item e não dispensado é
-- sugestão para o admin — não existe tabela de sugestão.

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  category public.establishment_category not null,
  name text not null check (char_length(name) between 2 and 80),
  duration_minutes integer not null default 30 check (duration_minutes >= 5),
  synonyms text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index catalog_items_category_name_key
  on public.catalog_items (category, lower(name));

create trigger catalog_items_set_updated_at
  before update on public.catalog_items
  for each row execute function public.set_updated_at();

alter table public.catalog_items enable row level security;

create policy catalog_items_select_all
  on public.catalog_items for select
  to anon, authenticated
  using (true);

alter table public.services
  add column catalog_item_id uuid references public.catalog_items (id) on delete set null,
  add column catalog_dismissed_at timestamptz;

create index services_catalog_item_idx on public.services (catalog_item_id);

-- Invoker pelo mesmo motivo de guard_establishment_status.
create function public.guard_service_catalog_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'postgres'
    and current_setting('role', true) is distinct from 'service_role'
    and (
      (tg_op = 'INSERT' and (new.catalog_item_id is not null or new.catalog_dismissed_at is not null))
      or (
        tg_op = 'UPDATE'
        and (
          new.catalog_item_id is distinct from old.catalog_item_id
          or new.catalog_dismissed_at is distinct from old.catalog_dismissed_at
        )
      )
    )
  then
    raise exception 'vínculo ao catálogo só muda pela curadoria da plataforma' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger services_guard_catalog_assignment
  before insert or update on public.services
  for each row execute function public.guard_service_catalog_assignment();

revoke execute on function public.guard_service_catalog_assignment()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Buscas
-- ---------------------------------------------------------------------------
-- Só o termo, a cidade e quantos resultados vieram. Nada de quem buscou: para
-- saber o que falta no catálogo, a identidade não acrescenta nada.

create table public.search_events (
  id bigint generated always as identity primary key,
  term text not null check (char_length(term) between 1 and 80),
  city_id uuid references public.cities (id) on delete set null,
  results integer not null check (results >= 0),
  created_at timestamptz not null default now()
);

create index search_events_no_result_idx on public.search_events (created_at) where results = 0;
create index search_events_term_idx on public.search_events (term, created_at);

alter table public.search_events enable row level security;

create policy search_events_select_admin
  on public.search_events for select
  to authenticated
  using (public.is_platform_admin());

-- A busca resolve loja, serviço, item curado e sinônimo no mesmo lugar. O total
-- gravado é calculado pelo servidor, então o cliente não consegue falsificar a
-- métrica de buscas sem resultado.
create function public.search_establishments(
  p_city_id uuid,
  p_category public.establishment_category,
  p_term text
)
returns table (
  id uuid,
  name text,
  slug text,
  category public.establishment_category,
  accent_color text,
  booking_mode public.booking_mode,
  neighborhood text,
  latitude numeric,
  longitude numeric,
  rating_avg numeric,
  rating_count integer,
  deposit_percent integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_term text := lower(btrim(regexp_replace(coalesce(p_term, ''), '\s+', ' ', 'g')));
  l_results integer;
begin
  if char_length(l_term) > 80 then
    raise exception 'A busca pode ter até 80 caracteres.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.cities c
    where c.id = p_city_id and c.is_active and c.launch_status = 'active'
  ) then
    return;
  end if;

  return query
    select
      e.id, e.name, e.slug, e.category, e.accent_color, e.booking_mode,
      e.neighborhood, e.latitude, e.longitude, e.rating_avg, e.rating_count,
      e.deposit_percent
    from public.establishments e
    where e.status = 'active'
      and e.city_id = p_city_id
      and (p_category is null or e.category = p_category)
      and (
        char_length(l_term) < 2
        or lower(e.name) like '%' || l_term || '%'
        or exists (
          select 1
          from public.services s
          left join public.catalog_items ci on ci.id = s.catalog_item_id
          where s.establishment_id = e.id
            and s.is_active
            and (
              lower(s.name) like '%' || l_term || '%'
              or lower(ci.name) like '%' || l_term || '%'
              or exists (
                select 1 from unnest(coalesce(ci.synonyms, array[]::text[])) synonym
                where synonym like '%' || l_term || '%'
              )
            )
        )
      )
    order by e.rating_avg desc nulls last, e.name
    limit 50;

  get diagnostics l_results = row_count;
  if char_length(l_term) >= 2 then
    insert into public.search_events (term, city_id, results)
    values (l_term, p_city_id, l_results);
  end if;
end;
$$;

revoke execute on function public.search_establishments(uuid, public.establishment_category, text) from public;
grant execute on function public.search_establishments(uuid, public.establishment_category, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Base das funções do admin
-- ---------------------------------------------------------------------------

-- Porta de entrada de toda função `admin_*`.
create function public.admin_require(p_roles public.platform_role[] default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_role public.platform_role;
begin
  select role into l_role
  from public.platform_admins
  where user_id = (select auth.uid());

  if not found then
    raise exception 'Acesso restrito à equipe da plataforma.' using errcode = '42501';
  end if;
  if l_role <> 'admin' and p_roles is not null and not (l_role = any (p_roles)) then
    raise exception 'Seu papel não permite esta ação administrativa.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.admin_require(public.platform_role[]) from public, anon, authenticated, service_role;

-- Grava uma linha de auditoria em nome de quem está chamando. Não é exposta:
-- só as funções `admin_*` a chamam, e ninguém escreve auditoria sozinho.
create function public.admin_write_audit(
  p_action text,
  p_meta text,
  p_establishment_id uuid default null,
  p_account_access boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_actor_name text;
  l_actor_role public.platform_role;
  l_establishment_name text;
begin
  select coalesce(nullif(p.full_name, ''), u.email::text), pa.role
  into l_actor_name, l_actor_role
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.platform_admins pa on pa.user_id = p.id
  where p.id = (select auth.uid());

  if p_establishment_id is not null then
    select name into l_establishment_name
    from public.establishments
    where id = p_establishment_id;
  end if;

  insert into public.admin_audit_log (
    actor_id, actor_name, actor_role, action, meta,
    establishment_id, establishment_name, account_access
  ) values (
    (select auth.uid()), coalesce(l_actor_name, 'Sistema'), l_actor_role,
    p_action, coalesce(p_meta, ''), p_establishment_id, l_establishment_name,
    p_account_access
  );
end;
$$;

revoke execute on function public.admin_write_audit(text, text, uuid, boolean) from public, anon, authenticated, service_role;

-- R$ 1.234,56 — para as linhas de auditoria, que são lidas por gente.
create function public.admin_brl(p_cents integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || replace(replace(replace(
    to_char(coalesce(p_cents, 0) / 100.0, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.');
$$;

revoke execute on function public.admin_brl(integer) from public, anon, authenticated, service_role;

-- Quantas vagas de mensalidade uma cidade tem ocupadas agora.
create function public.admin_quota_used(p_city_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.establishments e
  join public.plans p on p.id = e.plan_id
  where e.city_id = p_city_id and e.status = 'active' and p.kind = 'monthly';
$$;

revoke execute on function public.admin_quota_used(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Leitura
-- ---------------------------------------------------------------------------

create function public.admin_me()
returns table (id uuid, name text, role public.platform_role)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  update public.platform_admins set last_seen_at = now() where user_id = (select auth.uid());
  return query
    select p.id, coalesce(nullif(p.full_name, ''), u.email::text), pa.role
    from public.platform_admins pa
    join public.profiles p on p.id = pa.user_id
    join auth.users u on u.id = pa.user_id
    where pa.user_id = (select auth.uid());
end;
$$;

create function public.admin_cities()
returns table (
  id uuid,
  name text,
  uf text,
  launch_status public.city_launch_status,
  establishments integer,
  customers integer,
  appointments_month integer,
  quota_total integer,
  quota_used integer,
  monthly_price_cents integer,
  categories text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select
      c.id,
      c.name,
      c.state_code::text,
      c.launch_status,
      (select count(*)::integer from public.establishments e where e.city_id = c.id and e.status = 'active'),
      (
        select count(distinct a.customer_id)::integer
        from public.appointments a
        join public.establishments e on e.id = a.establishment_id
        where e.city_id = c.id and a.customer_id is not null
      ),
      (
        select count(*)::integer
        from public.appointments a
        join public.establishments e on e.id = a.establishment_id
        where e.city_id = c.id
          and a.starts_at >= date_trunc('month', now())
          and a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
      ),
      c.monthly_quota,
      public.admin_quota_used(c.id),
      c.monthly_price_cents,
      array(
        select distinct e.category::text
        from public.establishments e
        where e.city_id = c.id and e.status = 'active'
        order by 1
      )
    from public.cities c
    order by c.name;
end;
$$;

-- Fila de aprovação: pendente, e sem pedido de correção depois do último envio.
create function public.admin_applications()
returns table (
  id uuid,
  name text,
  city_id uuid,
  city text,
  category public.establishment_category,
  submitted_at timestamptz,
  cnpj text,
  legal_name text,
  address text,
  phone text,
  responsible text,
  email text,
  professionals integer,
  services text[],
  photos integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select
      e.id,
      e.name,
      e.city_id,
      c.name,
      e.category,
      e.submitted_at,
      coalesce(e.cnpj, ''),
      coalesce(e.legal_name, ''),
      concat_ws(', ', nullif(concat_ws(' — ', e.address_line, e.neighborhood), ''), c.name || '/' || c.state_code),
      coalesce(e.phone, ''),
      coalesce(e.responsible_name, ''),
      coalesce(e.contact_email, ''),
      (select count(*)::integer from public.professionals p where p.establishment_id = e.id),
      array(select s.name from public.services s where s.establishment_id = e.id order by s.sort_order, s.name),
      (select count(*)::integer from public.establishment_photos ph where ph.establishment_id = e.id)
    from public.establishments e
    join public.cities c on c.id = e.city_id
    where e.status = 'pending'
      and not exists (
        select 1 from public.establishment_decisions d
        where d.establishment_id = e.id
          and d.decision = 'correction'
          and d.decided_at >= e.submitted_at
      )
    order by e.submitted_at;
end;
$$;

create function public.admin_decisions()
returns table (
  id uuid,
  name text,
  city text,
  decision public.application_decision,
  plan_kind public.plan_kind,
  who text,
  decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select d.id, e.name, c.name, d.decision, p.kind, coalesce(pr.full_name, 'Equipe Vez'), d.decided_at
    from public.establishment_decisions d
    join public.establishments e on e.id = d.establishment_id
    join public.cities c on c.id = e.city_id
    left join public.plans p on p.id = d.plan_id
    left join public.profiles pr on pr.id = d.decided_by
    order by d.decided_at desc
    limit 30;
end;
$$;

-- Tudo o que a lista e a ficha do estabelecimento precisam, com as métricas de
-- uso já contadas. Risco e receita são calculados na tela a partir destes números.
create function public.admin_establishments()
returns table (
  id uuid,
  name text,
  city_id uuid,
  city text,
  uf text,
  category public.establishment_category,
  status public.establishment_status,
  plan_id uuid,
  plan_kind public.plan_kind,
  commission_percent numeric,
  city_price_cents integer,
  discount_percent integer,
  created_at timestamptz,
  appointments_month integer,
  completed_month_cents bigint,
  recent_30 integer,
  previous_60 integer,
  last_appointment_at timestamptz,
  usage integer[],
  cnpj text,
  address text,
  responsible text,
  professionals integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select
      e.id,
      e.name,
      e.city_id,
      c.name,
      c.state_code::text,
      e.category,
      e.status,
      e.plan_id,
      p.kind,
      p.commission_percent,
      c.monthly_price_cents,
      case when e.discount_until is null or e.discount_until >= current_date then e.discount_percent end,
      e.created_at,
      (
        select count(*)::integer from public.appointments a
        where a.establishment_id = e.id
          and a.starts_at >= date_trunc('month', now())
          and a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
      ),
      (
        select coalesce(sum(a.price_cents), 0)::bigint from public.appointments a
        where a.establishment_id = e.id
          and a.starts_at >= date_trunc('month', now())
          and a.status = 'completed'
      ),
      (
        select count(*)::integer from public.appointments a
        where a.establishment_id = e.id
          and a.starts_at >= now() - interval '30 days' and a.starts_at < now()
          and a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
      ),
      (
        select count(*)::integer from public.appointments a
        where a.establishment_id = e.id
          and a.starts_at >= now() - interval '90 days' and a.starts_at < now() - interval '30 days'
          and a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
      ),
      (
        select max(a.starts_at) from public.appointments a
        where a.establishment_id = e.id
          and a.starts_at < now()
          and a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
      ),
      array(
        select count(a.id)::integer
        from generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()),
          interval '1 month'
        ) as m (start)
        left join public.appointments a
          on a.establishment_id = e.id
          and a.starts_at >= m.start
          and a.starts_at < m.start + interval '1 month'
          and a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
        group by m.start
        order by m.start
      ),
      coalesce(e.cnpj, ''),
      concat_ws(', ', nullif(concat_ws(' — ', e.address_line, e.neighborhood), ''), c.name || '/' || c.state_code),
      concat_ws(' · ', nullif(e.responsible_name, ''), nullif(e.phone, '')),
      (select count(*)::integer from public.professionals pr where pr.establishment_id = e.id and pr.is_active)
    from public.establishments e
    join public.cities c on c.id = e.city_id
    left join public.plans p on p.id = e.plan_id
    where e.status in ('active', 'suspended')
    order by e.name;
end;
$$;

create function public.admin_plans()
returns table (
  id uuid,
  kind public.plan_kind,
  name text,
  is_active boolean,
  is_default boolean,
  commission_percent numeric,
  max_professionals integer,
  max_branches integer,
  queue_included boolean,
  integrated_payment text,
  search_highlight boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select p.id, p.kind, p.name, p.is_active, p.is_default, p.commission_percent,
           p.max_professionals, p.max_branches, p.queue_included, p.integrated_payment, p.search_highlight
    from public.plans p
    order by p.is_default desc, p.kind, p.created_at;
end;
$$;

create function public.admin_catalog_items()
returns table (
  id uuid,
  category public.establishment_category,
  name text,
  duration_minutes integer,
  synonyms text[],
  establishments integer,
  searches_month integer,
  appointments_month integer,
  average_price_cents integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select
      i.id,
      i.category,
      i.name,
      i.duration_minutes,
      i.synonyms,
      (
        select count(distinct s.establishment_id)::integer
        from public.services s
        join public.establishments e on e.id = s.establishment_id
        where s.catalog_item_id = i.id and e.status = 'active'
      ),
      (
        select count(*)::integer from public.search_events se
        where se.created_at >= now() - interval '30 days'
          and (se.term = lower(i.name) or se.term = any (i.synonyms))
      ),
      (
        select count(*)::integer
        from public.appointments a
        join public.services s on s.id = a.service_id
        where s.catalog_item_id = i.id
          and a.starts_at >= date_trunc('month', now())
          and a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
      ),
      (select round(avg(s.price_cents))::integer from public.services s where s.catalog_item_id = i.id and s.is_active)
    from public.catalog_items i
    order by i.category, i.name;
end;
$$;

-- Serviço de loja ativa sem item de catálogo e não dispensado, agrupado pelo
-- nome. "Pedidos" é quantas lojas usam aquele nome.
create function public.admin_catalog_suggestions()
returns table (
  key text,
  category public.establishment_category,
  name text,
  establishment text,
  city text,
  requests integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select
      e.category::text || ':' || lower(btrim(s.name)),
      e.category,
      min(s.name),
      min(e.name),
      min(c.name),
      count(distinct s.establishment_id)::integer
    from public.services s
    join public.establishments e on e.id = s.establishment_id
    join public.cities c on c.id = e.city_id
    where s.catalog_item_id is null
      and s.catalog_dismissed_at is null
      and e.status = 'active'
    group by e.category, lower(btrim(s.name))
    order by count(distinct s.establishment_id) desc, e.category, lower(btrim(s.name))
    limit 30;
end;
$$;

create function public.admin_no_result_searches()
returns table (term text, city text, searches integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select se.term, coalesce(c.name, 'Todas as cidades'), count(*)::integer
    from public.search_events se
    left join public.cities c on c.id = se.city_id
    where se.results = 0 and se.created_at >= now() - interval '30 days'
    group by se.term, c.name
    order by count(*) desc
    limit 10;
end;
$$;

create function public.admin_review_reports()
returns table (
  id uuid,
  review_id uuid,
  establishment_id uuid,
  establishment text,
  city text,
  reason text,
  justification text,
  status public.review_report_status,
  opened_at timestamptz,
  rating integer,
  comment text,
  author text,
  reviewed_at timestamptz,
  service text,
  professional text,
  appointment_at timestamptz,
  value_cents integer,
  author_reviews integer,
  author_average numeric,
  author_removed integer,
  establishment_average numeric,
  establishment_reviews integer,
  establishment_reports integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select
      rr.id,
      r.id,
      e.id,
      e.name,
      c.name,
      rr.reason,
      rr.justification,
      rr.status,
      rr.opened_at,
      r.rating::integer,
      coalesce(r.comment, ''),
      coalesce(nullif(au.full_name, ''), 'Cliente'),
      r.created_at,
      s.name,
      coalesce(pr.display_name, '—'),
      a.starts_at,
      a.price_cents,
      (select count(*)::integer from public.reviews x where x.customer_id = r.customer_id),
      (select round(avg(x.rating)::numeric, 1) from public.reviews x where x.customer_id = r.customer_id),
      (select count(*)::integer from public.reviews x where x.customer_id = r.customer_id and x.removed_at is not null),
      coalesce(e.rating_avg, 0),
      e.rating_count,
      (select count(*)::integer from public.review_reports y where y.establishment_id = e.id and y.id <> rr.id)
    from public.review_reports rr
    join public.reviews r on r.id = rr.review_id
    join public.establishments e on e.id = rr.establishment_id
    join public.cities c on c.id = e.city_id
    join public.appointments a on a.id = r.appointment_id
    join public.services s on s.id = a.service_id
    left join public.professionals pr on pr.id = a.professional_id
    left join public.profiles au on au.id = r.customer_id
    where rr.status in ('open', 'awaiting_establishment')
    order by rr.opened_at;
end;
$$;

-- Panorama das notas: média de hoje contra a de 30 dias atrás, e as quatro
-- avaliações mais recentes de cada loja.
create function public.admin_review_panorama()
returns table (
  establishment_id uuid,
  name text,
  city text,
  average numeric,
  delta_30 numeric,
  total integer,
  month integer,
  reports integer,
  recent jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select
      e.id,
      e.name,
      c.name,
      coalesce(e.rating_avg, 0),
      coalesce(
        round(
          coalesce(e.rating_avg, 0) - (
            select avg(r.rating) from public.reviews r
            where r.establishment_id = e.id and r.removed_at is null
              and r.created_at < now() - interval '30 days'
          ),
          1
        ),
        0
      ),
      e.rating_count,
      (
        select count(*)::integer from public.reviews r
        where r.establishment_id = e.id and r.removed_at is null
          and r.created_at >= now() - interval '30 days'
      ),
      (select count(*)::integer from public.review_reports rr where rr.establishment_id = e.id),
      coalesce(
        (
          select jsonb_agg(item order by item ->> 'at' desc)
          from (
            select jsonb_build_object(
              'rating', r.rating,
              'who', coalesce(nullif(p.full_name, ''), 'Cliente'),
              'at', r.created_at,
              'text', coalesce(r.comment, '')
            ) as item
            from public.reviews r
            left join public.profiles p on p.id = r.customer_id
            where r.establishment_id = e.id and r.removed_at is null
            order by r.created_at desc
            limit 4
          ) recent
        ),
        '[]'::jsonb
      )
    from public.establishments e
    join public.cities c on c.id = e.city_id
    where e.status = 'active' and e.rating_count > 0
    order by e.name;
end;
$$;

-- Clientes finais: quem já marcou alguma coisa. A cidade é a das lojas onde a
-- pessoa mais agenda — `profiles` não guarda cidade.
create function public.admin_customers()
returns table (
  id uuid,
  name text,
  city text,
  since timestamptz,
  appointments integer,
  no_shows integer,
  blocked boolean,
  misses jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    with activity as (
      select
        a.customer_id,
        count(*) filter (
          where a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
        )::integer as total,
        count(*) filter (where a.status = 'no_show')::integer as missed
      from public.appointments a
      where a.customer_id is not null
      group by a.customer_id
    )
    select
      p.id,
      coalesce(nullif(p.full_name, ''), 'Sem nome'),
      coalesce(
        (
          select c.name
          from public.appointments a
          join public.establishments e on e.id = a.establishment_id
          join public.cities c on c.id = e.city_id
          where a.customer_id = p.id
          group by c.name
          order by count(*) desc
          limit 1
        ),
        '—'
      ),
      p.created_at,
      act.total,
      act.missed,
      exists (select 1 from public.customer_blocks b where b.user_id = p.id),
      coalesce(
        (
          select jsonb_agg(item order by item ->> 'at' desc)
          from (
            select jsonb_build_object('establishment', e.name, 'at', a.starts_at) as item
            from public.appointments a
            join public.establishments e on e.id = a.establishment_id
            where a.customer_id = p.id and a.status = 'no_show'
            order by a.starts_at desc
            limit 3
          ) m
        ),
        '[]'::jsonb
      )
    from activity act
    join public.profiles p on p.id = act.customer_id
    order by act.missed desc, act.total desc
    limit 200;
end;
$$;

create function public.admin_team()
returns table (id uuid, name text, email text, role public.platform_role, last_seen_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select pa.user_id, coalesce(nullif(p.full_name, ''), u.email::text), u.email::text, pa.role, pa.last_seen_at
    from public.platform_admins pa
    join public.profiles p on p.id = pa.user_id
    join auth.users u on u.id = pa.user_id
    order by pa.role, p.full_name;
end;
$$;

create function public.admin_settings()
returns table (
  cancellation_window_hours integer,
  no_show_block_threshold integer,
  default_commission_percent numeric,
  delinquency_grace_days integer,
  queue_max_per_professional integer,
  plan_change_interval_days integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select
      s.cancellation_window_hours,
      s.no_show_block_threshold,
      coalesce((select p.commission_percent from public.plans p where p.kind = 'commission' and p.is_default), 0),
      s.delinquency_grace_days,
      s.queue_max_per_professional,
      s.plan_change_interval_days
    from public.platform_settings s;
end;
$$;

create function public.admin_audit()
returns table (
  id uuid,
  who text,
  action text,
  meta text,
  account_access boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select l.id, l.actor_name, l.action, l.meta, l.account_access, l.created_at
    from public.admin_audit_log l
    order by l.created_at desc
    limit 200;
end;
$$;

-- Os números da visão geral e a série de seis meses do gráfico. A receita é
-- estimada: mensalidade vigente mais a comissão sobre atendimentos concluídos —
-- sem provedor de pagamento, é o que dá para saber sem inventar.
create function public.admin_overview()
returns table (
  active_establishments integer,
  approved_month integer,
  suspended_month integer,
  appointments_month integer,
  paid_in_app_month integer,
  series jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require();
  return query
    select
      (select count(*)::integer from public.establishments e where e.status = 'active'),
      (
        select count(*)::integer from public.establishment_decisions d
        where d.decision = 'approved' and d.decided_at >= date_trunc('month', now())
      ),
      (
        select count(*)::integer from public.establishments e
        where e.status = 'suspended' and e.status_changed_at >= date_trunc('month', now())
      ),
      (
        select count(*)::integer from public.appointments a
        where a.starts_at >= date_trunc('month', now())
          and a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
      ),
      (
        select count(*)::integer from public.payments pay
        join public.appointments a on a.id = pay.appointment_id
        where pay.status = 'paid' and a.starts_at >= date_trunc('month', now())
      ),
      (
        select jsonb_agg(
          jsonb_build_object(
            'month', m.start,
            'appointments', (
              select count(*) from public.appointments a
              where a.starts_at >= m.start and a.starts_at < m.start + interval '1 month'
                and a.status not in ('cancelled_by_customer', 'cancelled_by_establishment')
            ),
            'commission_cents', (
              select coalesce(round(sum(
                a.price_cents * p.commission_percent / 100
                * (100 - case
                    when e.discount_until >= current_date then coalesce(e.discount_percent, 0)
                    else 0
                  end) / 100
              )), 0)
              from public.appointments a
              join public.establishments e on e.id = a.establishment_id
              join public.plans p on p.id = e.plan_id
              where p.kind = 'commission' and a.status = 'completed'
                and a.starts_at >= m.start and a.starts_at < m.start + interval '1 month'
            ),
            'monthly_cents', (
              select coalesce(round(sum(
                c.monthly_price_cents
                * (100 - case
                    when e.discount_until >= current_date then coalesce(e.discount_percent, 0)
                    else 0
                  end) / 100.0
              )), 0)
              from public.establishments e
              join public.plans p on p.id = e.plan_id
              join public.cities c on c.id = e.city_id
              where p.kind = 'monthly' and e.status = 'active'
                and e.created_at < m.start + interval '1 month'
            )
          )
          order by m.start
        )
        from generate_series(
          date_trunc('month', now()) - interval '5 months',
          date_trunc('month', now()),
          interval '1 month'
        ) as m (start)
      );
end;
$$;

-- ---------------------------------------------------------------------------
-- Escrita
-- ---------------------------------------------------------------------------

create function public.admin_decide_application(
  p_establishment_id uuid,
  p_decision public.application_decision,
  p_plan public.plan_kind,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_est public.establishments;
  l_city public.cities;
  l_plan public.plans;
  l_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  perform public.admin_require(array['operations']::public.platform_role[]);

  select * into l_est from public.establishments where id = p_establishment_id for update;
  if not found then
    raise exception 'Solicitação não encontrada.' using errcode = 'P0002';
  end if;
  if l_est.status <> 'pending' then
    raise exception 'Esta solicitação já foi decidida.' using errcode = 'P0001';
  end if;
  if p_decision <> 'approved' and l_message is null then
    raise exception 'Escreva a mensagem ao solicitante antes de recusar ou pedir correção.' using errcode = 'P0001';
  end if;

  -- a cidade fica travada até o fim: duas aprovações simultâneas não disputam a última vaga
  select * into l_city from public.cities where id = l_est.city_id for update;

  if p_decision = 'approved' then
    select * into l_plan from public.plans where kind = coalesce(p_plan, 'commission') and is_default;
    if not found then
      raise exception 'Não há plano padrão de %.', coalesce(p_plan, 'commission') using errcode = 'P0001';
    end if;
    if l_plan.kind = 'monthly' and public.admin_quota_used(l_city.id) >= l_city.monthly_quota then
      raise exception 'Não há vaga de mensalidade em %. Aprove pelo plano de comissão.', l_city.name
        using errcode = 'P0001';
    end if;
    update public.establishments set status = 'active', plan_id = l_plan.id where id = l_est.id;
  elsif p_decision = 'rejected' then
    update public.establishments set status = 'rejected', status_reason = l_message where id = l_est.id;
  end if;

  insert into public.establishment_decisions (establishment_id, decision, plan_id, message, decided_by)
  values (l_est.id, p_decision, l_plan.id, l_message, (select auth.uid()));

  perform public.admin_write_audit(
    case p_decision
      when 'approved' then 'Aprovou ' || l_est.name
      when 'rejected' then 'Recusou ' || l_est.name
      else 'Pediu correção a ' || l_est.name
    end,
    case p_decision
      when 'approved' then 'plano ' || l_plan.name || ' · ' || l_city.name
      else l_city.name || ' · mensagem: ' || l_message
    end,
    l_est.id
  );
end;
$$;

create function public.admin_set_establishment_status(
  p_ids uuid[],
  p_status public.establishment_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_names text;
  l_count integer;
  l_city record;
  l_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  if p_status not in ('active', 'suspended') then
    raise exception 'Só dá para suspender ou reativar por aqui.' using errcode = 'P0001';
  end if;
  if p_status = 'suspended' and l_reason is null then
    raise exception 'Informe o motivo da suspensão.' using errcode = 'P0001';
  end if;

  -- Reativar uma loja de mensalidade volta a consumir a vaga. As cidades ficam
  -- travadas até o fim para duas reativações não ocuparem a última vaga juntas.
  if p_status = 'active' then
    for l_city in
      select c.id, c.name, c.monthly_quota, count(*)::integer as incoming
      from public.establishments e
      join public.cities c on c.id = e.city_id
      join public.plans p on p.id = e.plan_id and p.kind = 'monthly'
      where e.id = any (p_ids) and e.status = 'suspended'
      group by c.id, c.name, c.monthly_quota
    loop
      perform 1 from public.cities where id = l_city.id for update;
      if public.admin_quota_used(l_city.id) + l_city.incoming > l_city.monthly_quota then
        raise exception '% não tem vaga de mensalidade para reativar % loja(s).', l_city.name, l_city.incoming
          using errcode = 'P0001';
      end if;
    end loop;
  end if;

  update public.establishments
  set status = p_status, status_reason = case when p_status = 'suspended' then l_reason end
  where id = any (p_ids)
    and status = case when p_status = 'active' then 'suspended' else 'active' end::public.establishment_status;
  get diagnostics l_count = row_count;
  if l_count = 0 then
    raise exception 'Nenhum estabelecimento mudou de situação.' using errcode = 'P0001';
  end if;

  select case when count(*) = 1 then min(name) else count(*) || ' estabelecimentos' end
  into l_names from public.establishments where id = any (p_ids);

  perform public.admin_write_audit(
    case when p_status = 'suspended' then 'Suspendeu ' else 'Reativou ' end || l_names,
    case when p_status = 'suspended' then 'motivo: ' || l_reason else 'volta a aparecer no app' end,
    case when cardinality(p_ids) = 1 then p_ids[1] end
  );
end;
$$;

create function public.admin_change_plan(p_ids uuid[], p_kind public.plan_kind)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_plan public.plans;
  l_city record;
  l_names text;
  l_blocked text;
  l_interval integer;
begin
  perform public.admin_require(array['finance']::public.platform_role[]);
  select * into l_plan from public.plans where kind = p_kind and is_default;
  if not found then
    raise exception 'Não há plano padrão desse tipo.' using errcode = 'P0001';
  end if;

  perform 1 from public.establishments where id = any (p_ids) order by id for update;
  select plan_change_interval_days into l_interval from public.platform_settings where id = true;
  select string_agg(e.name, ', ' order by e.name) into l_blocked
  from public.establishments e
  where e.id = any (p_ids)
    and e.plan_id is distinct from l_plan.id
    and e.plan_changed_at > now() - make_interval(days => l_interval);
  if l_blocked is not null then
    raise exception 'Intervalo mínimo de % dias ainda não terminou para: %.', l_interval, l_blocked
      using errcode = 'P0001';
  end if;

  -- quem entra na mensalidade ocupa vaga: confere cidade por cidade, com a cidade travada
  if p_kind = 'monthly' then
    for l_city in
      select c.id, c.name, c.monthly_quota, count(*)::integer as incoming
      from public.establishments e
      join public.cities c on c.id = e.city_id
      left join public.plans p on p.id = e.plan_id
      where e.id = any (p_ids) and e.status = 'active' and coalesce(p.kind::text, '') <> 'monthly'
      group by c.id, c.name, c.monthly_quota
    loop
      perform 1 from public.cities where id = l_city.id for update;
      if public.admin_quota_used(l_city.id) + l_city.incoming > l_city.monthly_quota then
        raise exception '% tem % vaga(s) de mensalidade e a troca pede %.',
          l_city.name, greatest(l_city.monthly_quota - public.admin_quota_used(l_city.id), 0), l_city.incoming
          using errcode = 'P0001';
      end if;
    end loop;
  end if;

  update public.establishments
  set plan_id = l_plan.id
  where id = any (p_ids) and plan_id is distinct from l_plan.id;

  select case when count(*) = 1 then min(name) else count(*) || ' estabelecimentos' end
  into l_names from public.establishments where id = any (p_ids);

  perform public.admin_write_audit(
    'Trocou o plano de ' || l_names,
    'para ' || l_plan.name || ' · aplicado imediatamente',
    case when cardinality(p_ids) = 1 then p_ids[1] end
  );
end;
$$;

create function public.admin_apply_discount(p_ids uuid[], p_percent integer, p_months integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_names text;
begin
  perform public.admin_require(array['finance']::public.platform_role[]);
  if p_percent is null or p_percent < 1 or p_percent > 100 then
    raise exception 'O desconto vai de 1%% a 100%%.' using errcode = 'P0001';
  end if;
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'O desconto dura de 1 a 24 meses.' using errcode = 'P0001';
  end if;

  update public.establishments
  set discount_percent = p_percent,
      discount_until = (current_date + make_interval(months => p_months))::date
  where id = any (p_ids);

  select case when count(*) = 1 then min(name) else count(*) || ' estabelecimentos' end
  into l_names from public.establishments where id = any (p_ids);

  perform public.admin_write_audit(
    'Aplicou desconto a ' || l_names,
    p_percent || '% por ' || p_months || case when p_months = 1 then ' mês' else ' meses' end,
    case when cardinality(p_ids) = 1 then p_ids[1] end
  );
end;
$$;

create function public.admin_register_contact(p_establishment_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text;
begin
  perform public.admin_require(array['operations', 'support']::public.platform_role[]);
  if nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Escreva o que foi conversado.' using errcode = 'P0001';
  end if;
  select name into l_name from public.establishments where id = p_establishment_id;
  if l_name is null then
    raise exception 'Estabelecimento não encontrado.' using errcode = 'P0002';
  end if;
  perform public.admin_write_audit('Registrou contato com ' || l_name, btrim(p_note), p_establishment_id);
end;
$$;

create function public.admin_start_access_session(
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
  perform public.admin_require(array['operations', 'support']::public.platform_role[]);
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'O motivo precisa explicar o acesso — ao menos 10 letras.' using errcode = 'P0001';
  end if;
  if p_minutes not in (15, 30, 60) then
    raise exception 'A sessão dura 15, 30 ou 60 minutos.' using errcode = 'P0001';
  end if;
  select name into l_name from public.establishments where id = p_establishment_id;
  if l_name is null then
    raise exception 'Estabelecimento não encontrado.' using errcode = 'P0002';
  end if;

  select coalesce(nullif(p.full_name, ''), u.email::text), pa.role
  into l_admin_name, l_admin_role
  from public.profiles p
  join auth.users u on u.id = p.id
  join public.platform_admins pa on pa.user_id = p.id
  where p.id = (select auth.uid());

  insert into public.admin_access_sessions (
    admin_id, admin_name, admin_role, establishment_id, establishment_name, reason, expires_at
  ) values (
    (select auth.uid()), l_admin_name, l_admin_role, p_establishment_id, l_name,
    btrim(p_reason), now() + make_interval(mins => p_minutes)
  )
  returning id into l_id;

  perform public.admin_write_audit(
    'Autorizou acesso de suporte a ' || l_name,
    'janela de ' || p_minutes || ' min · motivo: ' || btrim(p_reason),
    p_establishment_id,
    true
  );
  return l_id;
end;
$$;

create function public.admin_open_city(p_name text, p_uf text, p_quota integer, p_price_cents integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text := btrim(coalesce(p_name, ''));
  l_uf text := upper(btrim(coalesce(p_uf, '')));
  l_slug text;
  l_id uuid;
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  if char_length(l_name) < 2 then
    raise exception 'Informe o nome da cidade.' using errcode = 'P0001';
  end if;
  if l_uf !~ '^[A-Z]{2}$' then
    raise exception 'UF inválida.' using errcode = 'P0001';
  end if;
  if p_quota is null or p_quota < 0 then
    raise exception 'A cota de mensalidade não pode ser negativa.' using errcode = 'P0001';
  end if;
  if p_price_cents is null or p_price_cents <= 0 then
    raise exception 'Informe o preço da mensalidade na cidade.' using errcode = 'P0001';
  end if;

  l_slug := trim(both '-' from regexp_replace(
    translate(lower(l_name), 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+', '-', 'g'));

  if exists (select 1 from public.cities where slug = l_slug) then
    raise exception '%/% já está cadastrada.', l_name, l_uf using errcode = '23505';
  end if;

  -- Pré-lançamento: fica fora da busca e pronta para o futuro fluxo de onboarding.
  insert into public.cities (name, state_code, slug, is_active, launch_status, monthly_quota, monthly_price_cents)
  values (l_name, l_uf, l_slug, false, 'pre_launch', p_quota, p_price_cents)
  returning id into l_id;

  perform public.admin_write_audit(
    'Abriu ' || l_name || '/' || l_uf || ' em pré-lançamento',
    p_quota || ' vagas de mensalidade · ' || public.admin_brl(p_price_cents)
  );
  return l_id;
end;
$$;

create function public.admin_set_city_status(
  p_city_id uuid,
  p_status public.city_launch_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_city public.cities;
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  select * into l_city from public.cities where id = p_city_id for update;
  if not found then
    raise exception 'Cidade não encontrada.' using errcode = 'P0002';
  end if;
  if p_status = l_city.launch_status then
    raise exception 'A cidade já está nessa situação.' using errcode = 'P0001';
  end if;
  if p_status = 'active' and l_city.monthly_price_cents is null then
    raise exception 'Defina o preço local antes de ativar a cidade.' using errcode = 'P0001';
  end if;

  update public.cities
  set launch_status = p_status, is_active = (p_status = 'active')
  where id = l_city.id;

  perform public.admin_write_audit(
    'Alterou ' || l_city.name || '/' || l_city.state_code || ' para ' || p_status::text,
    case p_status
      when 'active' then 'cidade publicada na busca'
      when 'pre_launch' then 'pré-lançamento; fora da busca'
      else 'em avaliação; fora da busca'
    end
  );
end;
$$;

-- `p_totals`: {"<city_id>": total, ...}
create function public.admin_save_quotas(p_totals jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_entry record;
  l_city public.cities;
  l_total integer;
  l_used integer;
  l_changes text[] := array[]::text[];
begin
  perform public.admin_require(array['operations', 'finance']::public.platform_role[]);
  for l_entry in select key, value from jsonb_each_text(coalesce(p_totals, '{}'::jsonb)) loop
    select * into l_city from public.cities where id = l_entry.key::uuid for update;
    if not found then
      raise exception 'Cidade não encontrada.' using errcode = 'P0002';
    end if;
    l_total := l_entry.value::integer;
    if l_total is null or l_total < 0 then
      raise exception 'Cota inválida em %.', l_city.name using errcode = 'P0001';
    end if;
    continue when l_total = l_city.monthly_quota;
    l_used := public.admin_quota_used(l_city.id);
    if l_total < l_used then
      raise exception '% tem % vagas ocupadas — a cota não pode ficar abaixo disso.', l_city.name, l_used
        using errcode = 'P0001';
    end if;
    update public.cities set monthly_quota = l_total where id = l_city.id;
    l_changes := array_append(l_changes, l_city.name || ': ' || l_city.monthly_quota || ' → ' || l_total);
  end loop;

  if cardinality(l_changes) > 0 then
    perform public.admin_write_audit('Alterou cotas de mensalidade', array_to_string(l_changes, ' · '));
  end if;
end;
$$;

-- `p_city_prices`: {"<city_id>": centavos, ...} — só para o plano de mensalidade.
create function public.admin_update_plan(
  p_plan_id uuid,
  p_commission_percent numeric,
  p_max_professionals integer,
  p_city_prices jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_plan public.plans;
  l_entry record;
  l_city public.cities;
  l_price integer;
  l_changes text[] := array[]::text[];
begin
  perform public.admin_require(array['finance']::public.platform_role[]);
  select * into l_plan from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'Plano não encontrado.' using errcode = 'P0002';
  end if;
  if p_max_professionals is not null and p_max_professionals < 1 then
    raise exception 'O limite de profissionais é ao menos 1.' using errcode = 'P0001';
  end if;

  if l_plan.kind = 'commission' and p_commission_percent is distinct from l_plan.commission_percent then
    if p_commission_percent is null or p_commission_percent < 0 or p_commission_percent > 100 then
      raise exception 'A comissão vai de 0%% a 100%%.' using errcode = 'P0001';
    end if;
    l_changes := array_append(
      l_changes,
      'comissão ' || l_plan.commission_percent || '% → ' || p_commission_percent || '%'
    );
  end if;
  if p_max_professionals is distinct from l_plan.max_professionals then
    l_changes := array_append(
      l_changes,
      'profissionais ' || coalesce(l_plan.max_professionals::text, 'sem limite')
      || ' → ' || coalesce(p_max_professionals::text, 'sem limite')
    );
  end if;

  update public.plans
  set commission_percent = case when kind = 'commission' then p_commission_percent else commission_percent end,
      max_professionals = p_max_professionals
  where id = l_plan.id;

  if l_plan.kind = 'monthly' then
    for l_entry in select key, value from jsonb_each_text(coalesce(p_city_prices, '{}'::jsonb)) loop
      select * into l_city from public.cities where id = l_entry.key::uuid;
      continue when not found;
      l_price := l_entry.value::integer;
      if l_price is null or l_price <= 0 then
        raise exception 'Preço inválido em %.', l_city.name using errcode = 'P0001';
      end if;
      continue when l_price = l_city.monthly_price_cents;
      update public.cities set monthly_price_cents = l_price where id = l_city.id;
      l_changes := array_append(
        l_changes,
        l_city.name || ' ' || public.admin_brl(l_city.monthly_price_cents) || ' → ' || public.admin_brl(l_price)
      );
    end loop;
  end if;

  if cardinality(l_changes) = 0 then
    raise exception 'Nenhum valor mudou.' using errcode = 'P0001';
  end if;

  perform public.admin_write_audit(
    'Editou o plano ' || l_plan.name,
    array_to_string(l_changes, ' · ') || ' · aplicado imediatamente'
  );
end;
$$;

create function public.admin_save_catalog_item(
  p_id uuid,
  p_name text,
  p_duration_minutes integer,
  p_synonyms text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text := btrim(coalesce(p_name, ''));
  l_synonyms text[];
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  if char_length(l_name) < 2 then
    raise exception 'O item precisa de um nome.' using errcode = 'P0001';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 5 then
    raise exception 'A duração mínima é 5 minutos.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct s order by s), '{}') into l_synonyms
  from (
    select lower(btrim(x)) as s from unnest(coalesce(p_synonyms, '{}')) as x
  ) t
  where char_length(s) >= 2 and s <> lower(l_name);

  update public.catalog_items
  set name = l_name, duration_minutes = p_duration_minutes, synonyms = l_synonyms
  where id = p_id;
  if not found then
    raise exception 'Item não encontrado.' using errcode = 'P0002';
  end if;

  perform public.admin_write_audit(
    'Editou o item de catálogo ' || l_name,
    p_duration_minutes || ' min · ' || cardinality(l_synonyms) || ' nomes alternativos'
  );
end;
$$;

create function public.admin_create_catalog_item(
  p_category public.establishment_category,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text := btrim(coalesce(p_name, ''));
  l_id uuid;
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  if char_length(l_name) < 2 then
    raise exception 'O item precisa de um nome.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.catalog_items
    where category = p_category and lower(name) = lower(l_name)
  ) then
    raise exception '% já está no catálogo.', l_name using errcode = '23505';
  end if;

  insert into public.catalog_items (category, name) values (p_category, l_name) returning id into l_id;
  -- os serviços de loja com o mesmo nome passam a apontar para o item novo
  update public.services s set catalog_item_id = l_id
  from public.establishments e
  where e.id = s.establishment_id
    and e.category = p_category
    and s.catalog_item_id is null
    and lower(btrim(s.name)) = lower(l_name);

  perform public.admin_write_audit('Criou o item de catálogo ' || l_name, p_category::text);
  return l_id;
end;
$$;

-- `p_key` combina categoria e nome normalizado, separados por dois-pontos.
create function public.admin_resolve_suggestion(p_key text, p_resolution text, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_key text := lower(btrim(coalesce(p_key, '')));
  l_display text;
  l_category public.establishment_category;
  l_target public.catalog_items;
  l_id uuid;
begin
  perform public.admin_require(array['operations']::public.platform_role[]);

  select min(s.name), mode() within group (order by e.category)
  into l_display, l_category
  from public.services s
  join public.establishments e on e.id = s.establishment_id
  where s.catalog_item_id is null
    and s.catalog_dismissed_at is null
    and e.category::text || ':' || lower(btrim(s.name)) = l_key;

  if l_display is null then
    raise exception 'Sugestão não encontrada.' using errcode = 'P0002';
  end if;

  if p_resolution = 'approve' then
    if exists (
      select 1 from public.catalog_items
      where category = l_category and lower(name) = lower(l_display)
    ) then
      raise exception '% já está no catálogo — mescle em vez de aprovar.', l_display using errcode = '23505';
    end if;
    insert into public.catalog_items (category, name) values (l_category, l_display) returning id into l_id;
    update public.services s set catalog_item_id = l_id
    from public.establishments e
    where e.id = s.establishment_id
      and e.category = l_category
      and s.catalog_item_id is null
      and lower(btrim(s.name)) = lower(l_display);
    perform public.admin_write_audit('Aprovou a sugestão ' || l_display, 'virou item de catálogo');

  elsif p_resolution = 'merge' then
    select * into l_target from public.catalog_items where id = p_target_id;
    if not found then
      raise exception 'Escolha em qual item mesclar.' using errcode = 'P0001';
    end if;
    if l_target.category <> l_category then
      raise exception 'Mescle apenas itens da mesma categoria.' using errcode = 'P0001';
    end if;
    update public.catalog_items
    set synonyms = (
      select array_agg(distinct synonym order by synonym)
      from unnest(l_target.synonyms || lower(l_display)) as synonym
    )
    where id = l_target.id and lower(l_display) <> lower(l_target.name);
    update public.services s set catalog_item_id = l_target.id
    from public.establishments e
    where e.id = s.establishment_id
      and e.category = l_category
      and s.catalog_item_id is null
      and lower(btrim(s.name)) = lower(l_display);
    perform public.admin_write_audit('Mesclou ' || l_display || ' em ' || l_target.name, 'virou nome alternativo');

  elsif p_resolution = 'reject' then
    update public.services s set catalog_dismissed_at = now()
    from public.establishments e
    where e.id = s.establishment_id
      and e.category = l_category
      and s.catalog_item_id is null
      and lower(btrim(s.name)) = lower(l_display);
    perform public.admin_write_audit('Recusou a sugestão ' || l_display, 'não entra no catálogo');

  else
    raise exception 'Resolução desconhecida.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.admin_decide_report(
  p_report_id uuid,
  p_decision text,
  p_motive text,
  p_note text,
  p_notify_author boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_report public.review_reports;
  l_name text;
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  if nullif(btrim(coalesce(p_motive, '')), '') is null then
    raise exception 'Escolha o motivo da decisão.' using errcode = 'P0001';
  end if;
  if p_decision not in ('keep', 'remove') then
    raise exception 'Decisão desconhecida.' using errcode = 'P0001';
  end if;

  select * into l_report from public.review_reports where id = p_report_id for update;
  if not found or l_report.status not in ('open', 'awaiting_establishment') then
    raise exception 'Esta denúncia já foi decidida.' using errcode = 'P0001';
  end if;

  update public.review_reports
  set status = case when p_decision = 'remove' then 'removed' else 'kept' end::public.review_report_status,
      decided_by = (select auth.uid()),
      decided_at = now(),
      decision_motive = btrim(p_motive),
      decision_note = nullif(btrim(coalesce(p_note, '')), ''),
      notify_author = case when p_decision = 'remove' then coalesce(p_notify_author, true) end
  where id = l_report.id;

  -- remover dispara o gatilho da nota: a média da loja é recalculada sem ela
  if p_decision = 'remove' then
    update public.reviews
    set removed_at = now(), removed_by = (select auth.uid()), removal_reason = btrim(p_motive)
    where id = l_report.review_id;
  end if;

  select name into l_name from public.establishments where id = l_report.establishment_id;
  perform public.admin_write_audit(
    case when p_decision = 'remove' then 'Removeu' else 'Manteve' end
      || ' avaliação denunciada por ' || l_name,
    concat_ws(' · ', btrim(p_motive), nullif(btrim(coalesce(p_note, '')), ''),
      case when p_decision = 'remove' and coalesce(p_notify_author, true) then 'autor marcado para aviso' end),
    l_report.establishment_id
  );
end;
$$;

create function public.admin_request_clarification(p_report_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_report public.review_reports;
  l_name text;
  l_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  if l_message is null then
    raise exception 'Escreva o que você precisa saber.' using errcode = 'P0001';
  end if;
  select * into l_report from public.review_reports where id = p_report_id for update;
  if not found or l_report.status not in ('open', 'awaiting_establishment') then
    raise exception 'Esta denúncia já foi decidida.' using errcode = 'P0001';
  end if;

  update public.review_reports
  set status = 'awaiting_establishment', clarification_request = l_message
  where id = l_report.id;

  select name into l_name from public.establishments where id = l_report.establishment_id;
  perform public.admin_write_audit('Pediu esclarecimento a ' || l_name, l_message, l_report.establishment_id);
end;
$$;

create function public.admin_register_customer_contact(p_user_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text;
begin
  perform public.admin_require(array['support']::public.platform_role[]);
  if nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Escreva o que foi conversado.' using errcode = 'P0001';
  end if;
  select coalesce(nullif(full_name, ''), 'cliente') into l_name from public.profiles where id = p_user_id;
  if l_name is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
  perform public.admin_write_audit('Registrou atendimento a ' || l_name, btrim(p_note));
end;
$$;

create function public.admin_set_customer_blocked(p_user_id uuid, p_blocked boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text;
  l_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.admin_require(array['support']::public.platform_role[]);
  select coalesce(nullif(full_name, ''), 'cliente') into l_name from public.profiles where id = p_user_id;
  if l_name is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  if p_blocked then
    if l_reason is null then
      raise exception 'Informe o motivo do bloqueio.' using errcode = 'P0001';
    end if;
    insert into public.customer_blocks (user_id, reason, blocked_by)
    values (p_user_id, l_reason, (select auth.uid()))
    on conflict (user_id) do update set reason = excluded.reason, blocked_by = excluded.blocked_by, blocked_at = now();
  else
    delete from public.customer_blocks where user_id = p_user_id;
  end if;

  perform public.admin_write_audit(
    case when p_blocked then 'Bloqueou' else 'Desbloqueou' end || ' novos agendamentos de ' || l_name,
    case when p_blocked then 'motivo: ' || l_reason else 'volta a poder agendar' end
  );
end;
$$;

-- Lista fechada de chaves: a tela manda o nome do parâmetro, e só estes existem.
create function public.admin_update_param(p_key text, p_value integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_label text;
  l_before numeric;
begin
  perform public.admin_require();
  if p_key in ('default_commission_percent', 'delinquency_grace_days', 'plan_change_interval_days') then
    perform public.admin_require(array['finance']::public.platform_role[]);
  elsif p_key = 'no_show_block_threshold' then
    perform public.admin_require(array['operations', 'support']::public.platform_role[]);
  else
    perform public.admin_require(array['operations']::public.platform_role[]);
  end if;
  if p_value is null or p_value < 0 then
    raise exception 'Use um número positivo.' using errcode = 'P0001';
  end if;

  case p_key
    when 'cancellation_window_hours' then
      l_label := 'padrão de cancelamento para novas lojas';
      select cancellation_window_hours into l_before from public.platform_settings;
      update public.platform_settings
      set cancellation_window_hours = p_value, updated_by = (select auth.uid())
      where id = true;
    when 'no_show_block_threshold' then
      if p_value < 1 then raise exception 'O bloqueio precisa de ao menos 1 falta.' using errcode = 'P0001'; end if;
      l_label := 'faltas até bloqueio automático do cliente';
      select no_show_block_threshold into l_before from public.platform_settings;
      update public.platform_settings
      set no_show_block_threshold = p_value, updated_by = (select auth.uid())
      where id = true;
    when 'default_commission_percent' then
      if p_value > 100 then raise exception 'Percentual vai até 100.' using errcode = 'P0001'; end if;
      l_label := 'comissão padrão sobre agendamentos pagos';
      select commission_percent into l_before from public.plans where kind = 'commission' and is_default;
      update public.plans set commission_percent = p_value where kind = 'commission' and is_default;
    when 'delinquency_grace_days' then
      l_label := 'carência antes da suspensão por inadimplência';
      select delinquency_grace_days into l_before from public.platform_settings;
      update public.platform_settings
      set delinquency_grace_days = p_value, updated_by = (select auth.uid())
      where id = true;
    when 'queue_max_per_professional' then
      if p_value < 1 then raise exception 'A fila precisa de ao menos 1 lugar.' using errcode = 'P0001'; end if;
      l_label := 'tamanho máximo da fila de espera por profissional';
      select queue_max_per_professional into l_before from public.platform_settings;
      update public.platform_settings
      set queue_max_per_professional = p_value, updated_by = (select auth.uid())
      where id = true;
    when 'plan_change_interval_days' then
      l_label := 'intervalo mínimo entre trocas de plano';
      select plan_change_interval_days into l_before from public.platform_settings;
      update public.platform_settings
      set plan_change_interval_days = p_value, updated_by = (select auth.uid())
      where id = true;
    else
      raise exception 'Parâmetro desconhecido.' using errcode = 'P0001';
  end case;

  perform public.admin_write_audit('Alterou ' || l_label, trim(to_char(l_before, 'FM999990.##')) || ' → ' || p_value);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------------
-- Toda `admin_*` roda como `security definer` e confere o admin por dentro;
-- ainda assim, anônimo nem chega a poder chamá-las.

do $$
declare
  l_fn record;
begin
  for l_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin\_%'
      and p.proname not in ('admin_require', 'admin_write_audit', 'admin_brl', 'admin_quota_used')
  loop
    execute format('revoke execute on function %s from public, anon', l_fn.signature);
    execute format('grant execute on function %s to authenticated, service_role', l_fn.signature);
  end loop;
end;
$$;
