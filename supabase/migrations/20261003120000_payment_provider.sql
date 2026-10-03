-- ---------------------------------------------------------------------------
-- Pagamentos de verdade — provedor trocável
-- ---------------------------------------------------------------------------
-- A decisão que `20260902170000_payments.sql` deixou em aberto está em
-- docs/decisions/0009-pagamentos.md:
--
--   * Quem recebe: o ESTABELECIMENTO, direto na conta dele no provedor. A Vez
--     fica só com a própria taxa, separada na origem (split). O dinheiro do
--     cliente nunca passa pela conta da Vez — é isso que mantém a Vez fora do
--     papel de intermediadora financeira e tributa só a comissão.
--   * Provedor de lançamento: Mercado Pago. Mas nada neste esquema conhece o
--     Mercado Pago: `provider` é texto, e cada linha lembra por qual provedor
--     nasceu. Trocar de provedor é escrever um adaptador novo na Edge Function
--     e mudar um secret; as cobranças antigas continuam sendo conciliadas pelo
--     adaptador antigo.
--   * O ciclo é nosso, não do provedor. Fatura de mensalidade, vencimento e
--     estorno devido vivem aqui. Do provedor só se usa o que todos têm: criar
--     cobrança, consultar, estornar e avisar por webhook.
--
-- Continua valendo a regra da migration original: NENHUMA política de escrita.
-- Dinheiro só se move por Edge Function com a chave secreta.

-- ---------------------------------------------------------------------------
-- payments: o que faltava para virar transação
-- ---------------------------------------------------------------------------

alter table public.payments
  -- A parte da Vez, separada na origem. Zero no plano de mensalidade.
  add column platform_fee_cents integer not null default 0,
  -- O que o provedor cobrou. Só se sabe depois de pago.
  add column provider_fee_cents integer,
  add column pix_copy_paste text,
  -- Para os métodos que pagam fora do app (cartão em página do provedor).
  add column checkout_url text,
  add column expires_at timestamptz,
  -- Quanto DEVE voltar ao cliente. Quem decide é o banco, no cancelamento;
  -- quem executa é a Edge Function `payment-reconcile`. Enquanto
  -- `refund_requested_cents > refunded_cents`, há estorno pendente.
  add column refund_requested_cents integer not null default 0,
  add column last_synced_at timestamptz,
  add constraint payments_platform_fee_within_amount
    check (platform_fee_cents between 0 and amount_cents),
  add constraint payments_refund_requested_within_amount
    check (refund_requested_cents between 0 and amount_cents);

comment on table public.payments is
  'Sinal de reserva pago pelo app. Escrita só por Edge Function; o estabelecimento recebe direto no provedor (docs/decisions/0009-pagamentos.md).';

-- Uma cobrança viva por reserva. Dois toques em "pagar" não podem gerar dois
-- Pix: o segundo insert leva 23505 e a função devolve a cobrança que já existe.
create unique index payments_one_live_per_appointment
  on public.payments (appointment_id)
  where status in ('pending', 'authorized', 'paid', 'partially_refunded');

-- O que a conciliação procura a cada minuto.
create index payments_reconcile_idx
  on public.payments (last_synced_at nulls first)
  where status in ('pending', 'authorized', 'paid', 'partially_refunded');

create policy payments_select_admin
  on public.payments for select
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Conta do estabelecimento no provedor
-- ---------------------------------------------------------------------------
-- O dono conecta a conta dele (OAuth). O que identifica a conta fica aqui; o
-- que dá acesso a ela (tokens) fica no Vault, cifrado, e só sai por função
-- `security definer` que apenas `service_role` executa.

create table public.payment_accounts (
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  provider text not null,
  external_account_id text not null,
  status text not null default 'connected' check (status in ('connected', 'revoked')),
  token_expires_at timestamptz,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (establishment_id, provider)
);

comment on table public.payment_accounts is
  'Conta do estabelecimento no provedor de pagamento. Os tokens ficam no Vault, nunca aqui.';

create trigger payment_accounts_set_updated_at
  before update on public.payment_accounts
  for each row execute function public.set_updated_at();

alter table public.payment_accounts enable row level security;

create policy payment_accounts_select_establishment
  on public.payment_accounts for select
  to authenticated
  using (
    public.has_establishment_role(
      establishment_id, array['owner', 'manager']::public.establishment_role[])
    or public.is_platform_admin()
  );

create function public.payment_secret_name(p_establishment_id uuid, p_provider text, p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'payment:' || p_provider || ':' || p_establishment_id::text || ':' || p_kind
$$;

create function public.payment_secret_put(p_name text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_id uuid;
begin
  select s.id into l_id from vault.secrets s where s.name = p_name;
  if p_secret is null then
    if l_id is not null then
      delete from vault.secrets s where s.id = l_id;
    end if;
  elsif l_id is null then
    perform vault.create_secret(p_secret, p_name);
  else
    perform vault.update_secret(l_id, p_secret);
  end if;
end;
$$;

create function public.payment_account_store(
  p_establishment_id uuid,
  p_provider text,
  p_external_account_id text,
  p_access_token text,
  p_refresh_token text,
  p_token_expires_at timestamptz,
  p_connected_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.payment_secret_put(
    public.payment_secret_name(p_establishment_id, p_provider, 'access'), p_access_token);
  perform public.payment_secret_put(
    public.payment_secret_name(p_establishment_id, p_provider, 'refresh'), p_refresh_token);

  insert into public.payment_accounts as a (
    establishment_id, provider, external_account_id, status, token_expires_at, connected_by
  ) values (
    p_establishment_id, p_provider, p_external_account_id, 'connected', p_token_expires_at, p_connected_by
  )
  on conflict (establishment_id, provider) do update set
    external_account_id = excluded.external_account_id,
    status = 'connected',
    token_expires_at = excluded.token_expires_at,
    -- Renovação de token não troca quem conectou.
    connected_by = coalesce(excluded.connected_by, a.connected_by),
    connected_at = case when excluded.connected_by is null then a.connected_at else now() end;
end;
$$;

create function public.payment_account_credentials(p_establishment_id uuid, p_provider text)
returns table (
  external_account_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    a.external_account_id,
    (select s.decrypted_secret from vault.decrypted_secrets s
      where s.name = public.payment_secret_name(a.establishment_id, a.provider, 'access')),
    (select s.decrypted_secret from vault.decrypted_secrets s
      where s.name = public.payment_secret_name(a.establishment_id, a.provider, 'refresh')),
    a.token_expires_at
  from public.payment_accounts a
  where a.establishment_id = p_establishment_id
    and a.provider = p_provider
    and a.status = 'connected'
$$;

create function public.payment_account_revoke(p_establishment_id uuid, p_provider text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.payment_secret_put(
    public.payment_secret_name(p_establishment_id, p_provider, 'access'), null);
  perform public.payment_secret_put(
    public.payment_secret_name(p_establishment_id, p_provider, 'refresh'), null);
  update public.payment_accounts set status = 'revoked', token_expires_at = null
  where establishment_id = p_establishment_id and provider = p_provider;
end;
$$;

revoke execute on function public.payment_secret_name(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.payment_secret_put(text, text) from public, anon, authenticated;
revoke execute on function public.payment_account_store(uuid, text, text, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.payment_account_credentials(uuid, text) from public, anon, authenticated;
revoke execute on function public.payment_account_revoke(uuid, text) from public, anon, authenticated;
grant execute on function public.payment_account_store(uuid, text, text, text, text, timestamptz, uuid) to service_role;
grant execute on function public.payment_account_credentials(uuid, text) to service_role;
grant execute on function public.payment_account_revoke(uuid, text) to service_role;

-- O app do cliente precisa saber, antes de confirmar, se o sinal será cobrado
-- pelo app. `establishment_settings` não é legível por cliente, e não deve
-- ser: aqui sai só a resposta, não a configuração.
create function public.establishment_accepts_app_payment(p_establishment_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.establishments e
    join public.establishment_settings s on s.establishment_id = e.id
    join public.payment_accounts a on a.establishment_id = e.id and a.status = 'connected'
    where e.id = p_establishment_id
      and e.status = 'active'
      and e.deposit_percent > 0
      and s.accept_app_payment
  )
$$;

revoke execute on function public.establishment_accepts_app_payment(uuid) from public;
grant execute on function public.establishment_accepts_app_payment(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Webhooks recebidos
-- ---------------------------------------------------------------------------
-- Registro, não fila: o webhook nunca é a fonte da verdade. A função lê o
-- identificador, consulta a cobrança no provedor e aplica o que o provedor
-- respondeu. Reentrega do mesmo evento cai no `unique` e só soma tentativa.

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  charge_id text,
  payload jsonb,
  deliveries integer not null default 1,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now(),
  constraint payment_webhook_events_unique unique (provider, event_id)
);

alter table public.payment_webhook_events enable row level security;

create policy payment_webhook_events_select_admin
  on public.payment_webhook_events for select
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Faturas da assinatura (loja → Vez)
-- ---------------------------------------------------------------------------
-- A fatura nasce aqui, todo mês, sem falar com provedor nenhum. A cobrança
-- (Pix) só é criada quando o dono abre a fatura para pagar — Pix expira, e
-- gerar um por loja todo dia 1º seria pagar para criar código que ninguém leu.

create type public.billing_invoice_status as enum ('open', 'paid', 'void');

create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete restrict,
  plan_id uuid references public.plans (id) on delete set null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  -- Preço cheio da cidade no dia em que a fatura nasceu, e o desconto aplicado.
  list_price_cents integer not null,
  discount_cents integer not null default 0,
  amount_cents integer not null,
  status public.billing_invoice_status not null default 'open',
  provider text,
  provider_charge_id text,
  pix_copy_paste text,
  charge_expires_at timestamptz,
  provider_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_invoices_period_order check (period_end > period_start),
  constraint billing_invoices_amount check (
    amount_cents > 0 and discount_cents >= 0 and amount_cents = list_price_cents - discount_cents
  ),
  constraint billing_invoices_one_per_period unique (establishment_id, period_start),
  constraint billing_invoices_provider_charge_unique unique (provider, provider_charge_id)
);

comment on table public.billing_invoices is
  'Mensalidade da loja. O ciclo é do banco; o provedor só cobra a fatura que o dono abre.';

create index billing_invoices_open_idx on public.billing_invoices (due_date) where status = 'open';

create trigger billing_invoices_set_updated_at
  before update on public.billing_invoices
  for each row execute function public.set_updated_at();

alter table public.billing_invoices enable row level security;

create policy billing_invoices_select_owner
  on public.billing_invoices for select
  to authenticated
  using (
    public.has_establishment_role(establishment_id, array['owner']::public.establishment_role[])
    or public.is_platform_admin()
  );

-- Gera as faturas do mês. Idempotente: rodar duas vezes não duplica.
--
-- Só entra loja ativa, em plano de mensalidade, que já estava ativa ANTES do
-- mês começar — o mês em que a loja entra não é cobrado. Loja em plano de
-- comissão não tem fatura: a parte da Vez sai no split de cada pagamento.
create function public.billing_generate_invoices(p_month date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_start date := date_trunc('month', coalesce(p_month, (now() at time zone 'America/Sao_Paulo')::date))::date;
  l_count integer;
begin
  insert into public.billing_invoices (
    establishment_id, plan_id, period_start, period_end, due_date,
    list_price_cents, discount_cents, amount_cents
  )
  select
    e.id, p.id, l_start, (l_start + interval '1 month')::date, l_start + 9,
    c.monthly_price_cents, d.cents, c.monthly_price_cents - d.cents
  from public.establishments e
  join public.plans p on p.id = e.plan_id and p.kind = 'monthly'
  join public.cities c on c.id = e.city_id
  cross join lateral (
    select case
      when e.discount_percent is not null and (e.discount_until is null or e.discount_until >= l_start)
        then (c.monthly_price_cents * e.discount_percent / 100)
      else 0
    end as cents
  ) d
  where e.status = 'active'
    and e.status_changed_at < l_start
    and c.monthly_price_cents is not null
    -- Desconto de 100% não vira fatura de zero.
    and c.monthly_price_cents - d.cents > 0
  on conflict (establishment_id, period_start) do nothing;

  get diagnostics l_count = row_count;
  return l_count;
end;
$$;

revoke execute on function public.billing_generate_invoices(date) from public, anon, authenticated;
grant execute on function public.billing_generate_invoices(date) to service_role;

-- ---------------------------------------------------------------------------
-- Estorno devido: o cancelamento decide, a conciliação executa
-- ---------------------------------------------------------------------------
-- O cancelamento acontece por vários caminhos (RPC do cliente, portal, app da
-- equipe). Em vez de cada um lembrar de estornar, o gatilho marca o quanto
-- deve voltar e `payment-reconcile` fala com o provedor.
--
--   loja cancelou            → o sinal volta inteiro, sempre
--   cliente cancelou a tempo → volta, se a loja marcou o sinal como reembolsável
--   cliente cancelou tarde   → fica com a loja

create function public.payments_mark_refund_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_refund boolean := false;
begin
  if new.status = 'cancelled_by_establishment' then
    l_refund := true;
  elsif new.status = 'cancelled_by_customer' then
    select coalesce(s.deposit_refundable, true)
      and now() <= new.starts_at - make_interval(mins => e.cancellation_window_minutes)
    into l_refund
    from public.establishments e
    left join public.establishment_settings s on s.establishment_id = e.id
    where e.id = new.establishment_id;
  end if;

  if coalesce(l_refund, false) then
    update public.payments p
    set refund_requested_cents = p.amount_cents, last_synced_at = null
    where p.appointment_id = new.id and p.status in ('paid', 'partially_refunded');
  end if;

  -- Cobrança ainda não paga de reserva cancelada: a conciliação cancela no
  -- provedor, para ninguém pagar por uma reserva que não existe mais.
  update public.payments p set last_synced_at = null
  where p.appointment_id = new.id and p.status in ('pending', 'authorized');

  return null;
end;
$$;

create trigger appointments_mark_refund_due
  after update of status on public.appointments
  for each row
  when (
    old.status is distinct from new.status
    and new.status in ('cancelled_by_customer', 'cancelled_by_establishment')
  )
  execute function public.payments_mark_refund_due();

-- ---------------------------------------------------------------------------
-- Conciliação
-- ---------------------------------------------------------------------------
-- Webhook se perde. A cada minuto, o que está vivo e não foi conferido há
-- pouco é reservado (`skip locked`, para duas execuções não pegarem a mesma
-- linha) e conferido no provedor.

create function public.payment_claim_work(p_limit integer default 25)
returns setof public.payments
language sql
security definer
set search_path = ''
as $$
  update public.payments p
  set last_synced_at = now()
  where p.id in (
    select w.id
    from public.payments w
    where (
        -- estorno devido
        (w.status in ('paid', 'partially_refunded') and w.refund_requested_cents > w.refunded_cents)
        -- cobrança esperando pagamento
        or w.status in ('pending', 'authorized')
      )
      and (w.last_synced_at is null or w.last_synced_at < now() - interval '2 minutes')
    order by w.last_synced_at nulls first
    limit greatest(p_limit, 1)
    for update skip locked
  )
  returning p.*
$$;

revoke execute on function public.payment_claim_work(integer) from public, anon, authenticated;
grant execute on function public.payment_claim_work(integer) to service_role;

-- Mesmo desenho de `notification_dispatch_kick`: URL e segredo no Vault, e
-- sem eles a função não faz nada — ambiente sem provedor não chama ninguém.
create function public.payment_reconcile_kick()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_url text;
  l_secret text;
begin
  select s.decrypted_secret into l_url
  from vault.decrypted_secrets s where s.name = 'payments_reconcile_url';
  select s.decrypted_secret into l_secret
  from vault.decrypted_secrets s where s.name = 'payments_reconcile_secret';

  if nullif(l_url, '') is null or nullif(l_secret, '') is null then
    return 'unconfigured';
  end if;

  if not exists (
    select 1 from public.payments w
    where (
        (w.status in ('paid', 'partially_refunded') and w.refund_requested_cents > w.refunded_cents)
        or w.status in ('pending', 'authorized')
      )
      and (w.last_synced_at is null or w.last_synced_at < now() - interval '2 minutes')
  ) then
    return 'idle';
  end if;

  perform net.http_post(
    url := l_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reconcile-secret', l_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  return 'kicked';
end;
$$;

revoke execute on function public.payment_reconcile_kick() from public, anon, authenticated;

select cron.schedule('payments-reconcile', '* * * * *', 'select public.payment_reconcile_kick()');
-- Todo dia, não só no dia 1º: se o banco estiver fora do ar na virada do mês,
-- a fatura nasce no dia seguinte. A função é idempotente.
select cron.schedule('billing-generate-invoices', '10 9 * * *', 'select public.billing_generate_invoices()');
