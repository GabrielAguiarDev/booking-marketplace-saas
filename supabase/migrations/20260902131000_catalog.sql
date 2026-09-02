-- ---------------------------------------------------------------------------
-- Catálogo: o que a loja vende, quem executa e como ela aparece
-- ---------------------------------------------------------------------------

-- Como o estabelecimento atende. O brief prevê os dois modelos, e há casa que
-- roda os dois no mesmo dia (corte por ordem de chegada, barba com hora).
-- Guardar isso como enum na loja evita a pergunta "essa loja tem fila?" virar
-- heurística espalhada pelas telas.
create type public.booking_mode as enum (
  'scheduled',  -- só hora marcada
  'queue',      -- só ordem de chegada
  'both'
);

alter table public.establishments
  add column description text,
  add column booking_mode public.booking_mode not null default 'scheduled',
  add column address_line text,
  add column neighborhood text,
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  -- Override do acento visual. Nulo significa "usa a cor da categoria", que é
  -- o caso da esmagadora maioria — a coluna existe para a rede que tem marca
  -- própria, não para obrigar todo mundo a escolher uma cor no cadastro.
  add column accent_color text,
  -- Janela de cancelamento sem custo, em minutos antes do horário.
  add column cancellation_window_minutes integer not null default 120,
  -- Percentual de sinal cobrado no app. 0 = cobra tudo no balcão.
  add column deposit_percent integer not null default 0,
  add constraint establishments_accent_color_format
    check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint establishments_deposit_percent_range
    check (deposit_percent between 0 and 100),
  add constraint establishments_cancellation_window_positive
    check (cancellation_window_minutes >= 0),
  -- Latitude e longitude andam juntas ou não andam: meia coordenada põe um
  -- pino no meio do Atlântico.
  add constraint establishments_coords_together
    check ((latitude is null) = (longitude is null));

create index establishments_booking_mode_idx on public.establishments (booking_mode);

-- ---------------------------------------------------------------------------
-- Serviços
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null,
  description text,
  -- Duração é o que a função de disponibilidade usa para fatiar a agenda.
  -- Sem ela não existe horário livre calculável.
  duration_minutes integer not null,
  price_cents integer not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_duration_positive check (duration_minutes between 5 and 480),
  constraint services_price_not_negative check (price_cents >= 0)
);

comment on table public.services is
  'Serviços oferecidos. `duration_minutes` alimenta available_slots(); mudar a duração muda a grade de horários.';

create index services_establishment_id_idx on public.services (establishment_id);
create index services_active_idx on public.services (establishment_id, is_active);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profissionais
-- ---------------------------------------------------------------------------
-- Separado de `establishment_members` de propósito: nem todo membro atende
-- (recepção, gerente), e existe profissional exibido na vitrine que ainda não
-- tem login. `user_id` é opcional por isso.

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  display_name text not null,
  title text,
  bio text,
  avatar_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.professionals is
  'Quem atende. `user_id` nulo é profissional sem login — aparece na vitrine e recebe reserva.';

create index professionals_establishment_id_idx on public.professionals (establishment_id);
create index professionals_user_id_idx on public.professionals (user_id);

create trigger professionals_set_updated_at
  before update on public.professionals
  for each row execute function public.set_updated_at();

-- Quem faz o quê. Sem esta tabela, marcar barba com a manicure é possível.
create table public.professional_services (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (professional_id, service_id)
);

create index professional_services_service_id_idx
  on public.professional_services (service_id);

-- ---------------------------------------------------------------------------
-- Fotos
-- ---------------------------------------------------------------------------

create table public.establishment_photos (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index establishment_photos_establishment_id_idx
  on public.establishment_photos (establishment_id, sort_order);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.services enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_services enable row level security;
alter table public.establishment_photos enable row level security;

-- Leitura pública: o app precisa mostrar catálogo antes de pedir cadastro, e
-- isso vale para visitante anônimo. Só de estabelecimento ativo — loja
-- pendente ou suspensa não aparece para ninguém de fora.

create policy services_select_public
  on public.services for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.establishments e
      where e.id = establishment_id and e.status = 'active'
    )
  );

create policy services_select_member
  on public.services for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

create policy services_write_manager
  on public.services for all
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]))
  with check (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]));

create policy professionals_select_public
  on public.professionals for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.establishments e
      where e.id = establishment_id and e.status = 'active'
    )
  );

create policy professionals_select_member
  on public.professionals for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

create policy professionals_write_manager
  on public.professionals for all
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]))
  with check (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]));

-- O vínculo herda a visibilidade do profissional: se dá para ver quem atende,
-- dá para ver o que essa pessoa faz.
create policy professional_services_select_public
  on public.professional_services for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.professionals p
      join public.establishments e on e.id = p.establishment_id
      where p.id = professional_id and p.is_active and e.status = 'active'
    )
  );

create policy professional_services_write_manager
  on public.professional_services for all
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

create policy establishment_photos_select_public
  on public.establishment_photos for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.establishments e
      where e.id = establishment_id and e.status = 'active'
    )
  );

create policy establishment_photos_write_manager
  on public.establishment_photos for all
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]))
  with check (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]));
