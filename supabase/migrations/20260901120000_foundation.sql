-- Fundação do schema do Vez.
--
-- Escopo desta migration: cidades, estabelecimentos, perfis de usuário, vínculo
-- de equipe e administradores da plataforma. Nada de agendamento, fila ou
-- disponibilidade ainda.
--
-- Regra do projeto: nenhuma tabela existe sem RLS habilitada e sem política
-- explícita. Isso vale para toda migration futura.

-- ---------------------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------------------

-- Busca de estabelecimento por nome com tolerância a erro de digitação.
create extension if not exists pg_trgm with schema extensions;

-- Nota: btree_gist (constraint de exclusão contra sobreposição de horário)
-- entra junto com a tabela de agendamentos, não aqui. Extensão sem uso não
-- é habilitada.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.establishment_category as enum (
  'barbershop',
  'salon',
  'aesthetic_clinic',
  'dermatology',
  'petshop'
);

create type public.establishment_status as enum (
  'pending',
  'active',
  'suspended'
);

create type public.establishment_role as enum (
  'owner',
  'manager',
  'staff'
);

-- ---------------------------------------------------------------------------
-- Utilitário de updated_at
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_code char(2) not null,
  slug text not null,
  ibge_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cities_slug_key unique (slug),
  constraint cities_ibge_code_key unique (ibge_code),
  constraint cities_name_state_key unique (name, state_code),
  constraint cities_state_code_upper check (state_code = upper(state_code)),
  constraint cities_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table public.cities is
  'Cidades atendidas. A cota de assinatura por cidade será modelada junto com o billing.';

create table public.establishments (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete restrict,
  name text not null,
  slug text not null,
  category public.establishment_category not null,
  status public.establishment_status not null default 'pending',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint establishments_slug_key unique (slug),
  constraint establishments_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table public.establishments is
  'Estabelecimentos da plataforma. Criação passa por Edge Function (valida cota da cidade).';

create index establishments_city_id_idx on public.establishments (city_id);
create index establishments_status_idx on public.establishments (status);
create index establishments_name_trgm_idx
  on public.establishments using gin (name extensions.gin_trgm_ops);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Identidade base, 1:1 com auth.users. Neutra quanto a papel: a mesma pessoa pode ser cliente em um estabelecimento e equipe em outro.';

create table public.establishment_members (
  user_id uuid not null references public.profiles (id) on delete cascade,
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  role public.establishment_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, establishment_id)
);

comment on table public.establishment_members is
  'Vínculo N:N entre usuário e estabelecimento. Um profissional pode atender em mais de uma unidade.';

create index establishment_members_establishment_id_idx
  on public.establishment_members (establishment_id);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Administradores da plataforma. Sem política de escrita por design: concessão só via service role.';

-- ---------------------------------------------------------------------------
-- Triggers de updated_at
-- ---------------------------------------------------------------------------

create trigger cities_set_updated_at
  before update on public.cities
  for each row execute function public.set_updated_at();

create trigger establishments_set_updated_at
  before update on public.establishments
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger establishment_members_set_updated_at
  before update on public.establishment_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers de RLS
--
-- Todos são SECURITY DEFINER com search_path travado. Isso é o que permite
-- consultar establishment_members e platform_admins de dentro de uma política
-- sem disparar recursão de política.
--
-- auth.uid() vem embrulhado em subquery de propósito: o Postgres avalia uma
-- única vez por statement (InitPlan) em vez de uma vez por linha.
-- ---------------------------------------------------------------------------

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$$;

create function public.current_establishment_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select em.establishment_id
  from public.establishment_members em
  where em.user_id = (select auth.uid());
$$;

create function public.is_establishment_member(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.establishment_members em
    where em.user_id = (select auth.uid())
      and em.establishment_id = p_establishment_id
  );
$$;

create function public.has_establishment_role(
  p_establishment_id uuid,
  p_roles public.establishment_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.establishment_members em
    where em.user_id = (select auth.uid())
      and em.establishment_id = p_establishment_id
      and em.role = any (p_roles)
  );
$$;

create function public.shares_establishment_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.establishment_members mine
    join public.establishment_members theirs
      on theirs.establishment_id = mine.establishment_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

-- anon nunca chama helper: as políticas de leitura pública são predicados
-- literais. Por isso o execute é revogado de public e devolvido só a quem usa.
revoke execute on function public.is_platform_admin() from public;
revoke execute on function public.current_establishment_ids() from public;
revoke execute on function public.is_establishment_member(uuid) from public;
revoke execute on function public.has_establishment_role(uuid, public.establishment_role[]) from public;
revoke execute on function public.shares_establishment_with(uuid) from public;

grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.current_establishment_ids() to authenticated, service_role;
grant execute on function public.is_establishment_member(uuid) to authenticated, service_role;
grant execute on function public.has_establishment_role(uuid, public.establishment_role[]) to authenticated, service_role;
grant execute on function public.shares_establishment_with(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Provisionamento de perfil no signup
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.phone, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.cities enable row level security;
alter table public.establishments enable row level security;
alter table public.profiles enable row level security;
alter table public.establishment_members enable row level security;
alter table public.platform_admins enable row level security;

-- cities -------------------------------------------------------------------
-- Dado de referência: qualquer visitante do app precisa listar cidades ativas.

create policy cities_select_active
  on public.cities for select
  to anon, authenticated
  using (is_active);

create policy cities_select_admin
  on public.cities for select
  to authenticated
  using (public.is_platform_admin());

create policy cities_write_admin
  on public.cities for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- establishments -----------------------------------------------------------
-- Sem política de INSERT por design: o cadastro nasce numa Edge Function que
-- valida a cota da cidade antes de gravar, usando service role.

create policy establishments_select_public
  on public.establishments for select
  to anon, authenticated
  using (status = 'active');

create policy establishments_select_member
  on public.establishments for select
  to authenticated
  using (public.is_establishment_member(id));

create policy establishments_select_admin
  on public.establishments for select
  to authenticated
  using (public.is_platform_admin());

create policy establishments_update_manager
  on public.establishments for update
  to authenticated
  using (public.has_establishment_role(id, array['owner', 'manager']::public.establishment_role[]))
  with check (public.has_establishment_role(id, array['owner', 'manager']::public.establishment_role[]));

create policy establishments_write_admin
  on public.establishments for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- profiles -----------------------------------------------------------------
-- Sem política de INSERT: quem cria a linha é o trigger on_auth_user_created,
-- que roda como dono da tabela e portanto não passa por RLS.

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_colleagues
  on public.profiles for select
  to authenticated
  using (public.shares_establishment_with(id));

create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using (public.is_platform_admin());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- establishment_members ----------------------------------------------------

create policy establishment_members_select_member
  on public.establishment_members for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

create policy establishment_members_select_admin
  on public.establishment_members for select
  to authenticated
  using (public.is_platform_admin());

create policy establishment_members_write_owner
  on public.establishment_members for all
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner']::public.establishment_role[]))
  with check (public.has_establishment_role(establishment_id, array['owner']::public.establishment_role[]));

create policy establishment_members_write_admin
  on public.establishment_members for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- platform_admins ----------------------------------------------------------
-- Leitura só para quem já é admin. Nenhuma política de escrita: promover ou
-- revogar um admin exige service role, deliberadamente fora do alcance do app.

create policy platform_admins_select_admin
  on public.platform_admins for select
  to authenticated
  using (public.is_platform_admin());
