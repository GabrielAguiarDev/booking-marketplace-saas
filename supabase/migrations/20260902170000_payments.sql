-- ---------------------------------------------------------------------------
-- Pagamentos — SOMENTE O ESQUEMA
-- ---------------------------------------------------------------------------
-- Nenhuma cobrança acontece aqui, e nenhuma Edge Function de pagamento existe.
-- Falta uma decisão que não é técnica: qual provedor, e quem recebe o dinheiro
-- — a plataforma, repassando ao estabelecimento, ou o estabelecimento direto.
-- Essa escolha muda o modelo tributário inteiro e, com ele, estas tabelas.
--
-- O esquema entra agora porque `appointments.deposit_cents` já existe e precisa
-- de um lugar para virar transação quando a decisão for tomada. O que NÃO se
-- deve fazer é ligar uma tela de pagamento a isto antes de haver provedor: uma
-- tela que finge cobrar é pior do que nenhuma tela.

create type public.payment_status as enum (
  'pending',
  'authorized',
  'paid',
  'refunded',
  'partially_refunded',
  'failed',
  'cancelled'
);

create type public.payment_method as enum (
  'pix',
  'credit_card',
  'debit_card',
  'cash',        -- pago no balcão; existe para o histórico fechar
  'other'
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  establishment_id uuid not null references public.establishments (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  amount_cents integer not null,
  refunded_cents integer not null default 0,
  status public.payment_status not null default 'pending',
  method public.payment_method,
  -- Identificador no provedor. Sem `unique`, um webhook reentregue cria uma
  -- segunda linha para a mesma cobrança — e webhooks são reentregues.
  provider text,
  provider_charge_id text,
  -- Corpo cru do provedor, para auditoria quando o número não bater.
  provider_payload jsonb,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount_cents > 0),
  constraint payments_refund_within_amount
    check (refunded_cents between 0 and amount_cents),
  constraint payments_provider_charge_unique unique (provider, provider_charge_id)
);

comment on table public.payments is
  'Esquema apenas. Nenhuma cobrança é feita até haver provedor definido — ver docs/roadmap-mobile-cliente.md, fase 6.';

create index payments_appointment_idx on public.payments (appointment_id);
create index payments_establishment_idx on public.payments (establishment_id, created_at desc);
create index payments_customer_idx on public.payments (customer_id, created_at desc);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.payments enable row level security;

create policy payments_select_own
  on public.payments for select
  to authenticated
  using (customer_id = (select auth.uid()));

create policy payments_select_establishment
  on public.payments for select
  to authenticated
  using (public.has_establishment_role(
    establishment_id, array['owner', 'manager']::public.establishment_role[]));

-- Nenhuma política de escrita, e isso é a decisão principal desta migration:
-- dinheiro só se move por Edge Function com a chave secreta, validando contra o
-- provedor. Cliente que pode inserir em `payments` pode declarar-se pago.
