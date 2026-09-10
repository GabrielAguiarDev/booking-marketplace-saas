-- ---------------------------------------------------------------------------
-- Como cada loja trabalha: fila, regras de agendamento e avisos
-- ---------------------------------------------------------------------------
-- O app do estabelecimento tem três telas de ajuste (fila, regras, avisos) e
-- nenhuma delas tinha onde gravar. Sem estas tabelas os interruptores seriam
-- estado de tela: ligados no aparelho de quem tocou, invisíveis para o resto da
-- equipe e perdidos no próximo lançamento.
--
-- A divisão entre as duas tabelas segue quem é o dono da preferência:
--
--   `establishment_settings`     — regra da casa. Vale para todo mundo.
--   `member_notification_prefs`  — o que TOCA O CELULAR de uma pessoa. É dela.
--
-- O que já tinha coluna não ganhou coluna nova. `booking_mode` continua sendo
-- quem diz se a loja usa fila; `deposit_percent`, `min_lead_minutes` e
-- `cancellation_window_minutes` continuam em `establishments`, porque
-- `available_slots()` e a Edge Function de reserva já os leem de lá. Duplicar
-- qualquer um deles aqui criaria duas verdades sobre a mesma pergunta.

create type public.queue_arrival_method as enum (
  'qr',        -- o cliente lê um QR no balcão
  'staff',     -- alguém da equipe confirma
  'location'   -- o app confirma pela localização
);

create type public.queue_notify_channel as enum (
  'push',
  'sms',
  'whatsapp'
);

create table public.establishment_settings (
  establishment_id uuid primary key
    references public.establishments (id) on delete cascade,

  -- ── fila ─────────────────────────────────────────────────────────────────
  -- Se a loja usa fila é `establishments.booking_mode`; o que está aqui é como
  -- ela usa.
  queue_remote_join boolean not null default true,
  queue_require_arrival boolean not null default false,
  queue_arrival_method public.queue_arrival_method not null default 'qr',
  queue_qr_enabled boolean not null default false,
  -- Desligado, todo mundo espera na mesma fila da loja.
  queue_per_professional boolean not null default false,
  queue_auto_close boolean not null default false,
  queue_close_after_minutes integer not null default 60,
  queue_auto_skip boolean not null default true,
  queue_notify_enabled boolean not null default true,
  queue_notify_channel public.queue_notify_channel not null default 'push',

  -- ── regras de agendamento ────────────────────────────────────────────────
  -- Ligado, a reserva nasce 'confirmed' em vez de 'scheduled'. Quem lê isso é
  -- a Edge Function `book-appointment`, não o app.
  auto_approve boolean not null default false,
  -- O sinal volta se o cancelamento couber em `cancellation_window_minutes`.
  deposit_refundable boolean not null default true,
  accept_app_payment boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint establishment_settings_close_after_positive
    check (queue_close_after_minutes between 5 and 480)
);

comment on table public.establishment_settings is
  'Regras da casa: como a fila funciona e como o agendamento se comporta. Uma linha por loja, criada junto com a loja.';

create trigger establishment_settings_set_updated_at
  before update on public.establishment_settings
  for each row execute function public.set_updated_at();

-- A linha nasce com a loja. Sem isto toda tela de ajuste precisaria tratar
-- "ainda não existe linha" — e a primeira que esquecesse gravaria nada em
-- silêncio.
create function public.create_establishment_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.establishment_settings (establishment_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger establishments_create_settings
  after insert on public.establishments
  for each row execute function public.create_establishment_settings();

insert into public.establishment_settings (establishment_id)
select e.id from public.establishments e
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Avisos que cada pessoa recebe
-- ---------------------------------------------------------------------------
-- Por membro e por loja, não por loja: quem atende em duas unidades quer o
-- barulho de uma e não da outra, e o dono não decide o que toca no celular do
-- barbeiro.

create table public.member_notification_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  notify_new_appointment boolean not null default true,
  notify_cancellation boolean not null default true,
  notify_queue_join boolean not null default true,
  notify_daily_summary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, establishment_id)
);

comment on table public.member_notification_prefs is
  'Preferência de aviso por pessoa e por loja. Só o dono da linha lê e escreve — nem o dono da loja mexe.';

create trigger member_notification_prefs_set_updated_at
  before update on public.member_notification_prefs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.establishment_settings enable row level security;
alter table public.member_notification_prefs enable row level security;

-- Leitura pública, e de propósito: o app do cliente precisa saber se dá para
-- entrar na fila de longe antes de mostrar o botão. Nada aqui é segredo — é
-- regra de atendimento, que a loja quer que o cliente conheça. Predicado
-- literal, sem helper, porque a política vale para `anon` (ver conventions.md).
create policy establishment_settings_select_public
  on public.establishment_settings for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.establishments e
      where e.id = establishment_id and e.status = 'active'
    )
  );

-- A equipe vê a própria loja mesmo com ela pendente ou suspensa — é justamente
-- quando ela precisa configurar.
create policy establishment_settings_select_member
  on public.establishment_settings for select
  to authenticated
  using (public.is_establishment_member(establishment_id));

-- Quem muda a regra da casa é dono ou gerente. Barbeiro não desliga a fila.
create policy establishment_settings_write_manager
  on public.establishment_settings for all
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]))
  with check (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]));

-- A preferência de aviso é da pessoa. `is_establishment_member` no `with check`
-- impede criar preferência para uma loja onde não se trabalha.
create policy member_notification_prefs_own
  on public.member_notification_prefs for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_establishment_member(establishment_id)
  );
