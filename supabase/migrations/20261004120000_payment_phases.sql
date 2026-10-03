-- ---------------------------------------------------------------------------
-- Pagamentos, fases seguintes
-- ---------------------------------------------------------------------------
-- Em cima de `20261003120000_payment_provider.sql`:
--
--   1. Cartão, por checkout hospedado do provedor — o número do cartão nunca
--      passa pelo Vez.
--   2. Pagar o valor inteiro pelo app, não só o sinal.
--   3. Inadimplência da mensalidade: avisos, suspensão depois da carência e
--      reativação quando a fatura é paga.
--   4. O financeiro do admin deixa de estimar e passa a ler o que foi recebido.
--
-- Decisões em docs/decisions/0009-pagamentos.md.

-- ---------------------------------------------------------------------------
-- 1 e 2. Cartão e valor inteiro
-- ---------------------------------------------------------------------------

alter table public.payments
  -- Checkout hospedado: o provedor devolve uma página, e a cobrança em si só
  -- existe quando o cliente paga nela. Até lá não há `provider_charge_id`.
  add column provider_checkout_id text,
  -- 'deposit' cobra o sinal congelado na reserva; 'full', o preço inteiro.
  add column scope text not null default 'deposit' check (scope in ('deposit', 'full'));

-- Com valor inteiro pelo app, a loja não precisa exigir sinal para receber por
-- ele. O que continua valendo: loja ativa, interruptor ligado, conta conectada.
create or replace function public.establishment_accepts_app_payment(p_establishment_id uuid)
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
      and s.accept_app_payment
  )
$$;

-- O que volta ao cliente quando a reserva é cancelada:
--
--   loja cancelou                          → tudo
--   cliente, no prazo, sinal reembolsável  → tudo
--   cliente, fora do prazo ou sinal retido → tudo MENOS o sinal da reserva
--
-- A última linha é a que mudou: quem pagou o valor inteiro e cancela tarde
-- perde o sinal, não o serviço inteiro que não vai receber.
create or replace function public.payments_mark_refund_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_full boolean := false;
begin
  if new.status = 'cancelled_by_establishment' then
    l_full := true;
  elsif new.status = 'cancelled_by_customer' then
    select coalesce(s.deposit_refundable, true)
      and now() <= new.starts_at - make_interval(mins => e.cancellation_window_minutes)
    into l_full
    from public.establishments e
    left join public.establishment_settings s on s.establishment_id = e.id
    where e.id = new.establishment_id;
  end if;

  update public.payments p
  set
    refund_requested_cents = case
      when coalesce(l_full, false) then p.amount_cents
      else greatest(p.amount_cents - new.deposit_cents, 0)
    end,
    last_synced_at = null
  where p.appointment_id = new.id
    and p.status in ('paid', 'partially_refunded')
    and (coalesce(l_full, false) or p.amount_cents > new.deposit_cents);

  -- Cobrança ainda não paga de reserva cancelada: a conciliação cancela no
  -- provedor, para ninguém pagar por uma reserva que não existe mais.
  update public.payments p set last_synced_at = null
  where p.appointment_id = new.id and p.status in ('pending', 'authorized');

  return null;
end;
$$;

-- Webhook de checkout hospedado traz o id da conta da loja, não o nosso: é por
-- ele que se descobre com qual credencial consultar a cobrança.
create index payment_accounts_external_idx
  on public.payment_accounts (provider, external_account_id);

-- ---------------------------------------------------------------------------
-- 3. Inadimplência
-- ---------------------------------------------------------------------------
-- A régua, contada do vencimento:
--
--   dia 0 da fatura  aviso de fatura disponível (push + e-mail ao dono)
--   +3 dias          primeiro aviso de atraso
--   +7 dias          segundo aviso
--   +carência        suspensão (`platform_settings.delinquency_grace_days`)
--
-- Pagou, voltou: a fatura paga reativa a loja sozinha, se foi a cobrança que a
-- suspendeu e não sobrou outra fatura além da carência.

alter table public.billing_invoices
  -- Preenchido quando ESTA fatura suspendeu a loja. É o que distingue suspensão
  -- por cobrança (que o pagamento desfaz) de suspensão por moderação (que só o
  -- admin desfaz).
  add column suspended_at timestamptz;

create function public.billing_notify_owners(
  p_invoice public.billing_invoices,
  p_kind text,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_owner uuid;
  l_data jsonb := jsonb_build_object('invoice_id', p_invoice.id, 'route', '/assinatura');
begin
  for l_owner in
    select m.user_id from public.establishment_members m
    where m.establishment_id = p_invoice.establishment_id and m.role = 'owner'
  loop
    perform public.notify_enqueue(
      l_owner, 'push', p_kind, p_title, p_body, l_data, 'staff',
      p_kind || ':' || p_invoice.id || ':' || l_owner, p_invoice.establishment_id
    );
    perform public.notify_enqueue(
      l_owner, 'email', p_kind, p_title, p_body, l_data, null,
      p_kind || ':' || p_invoice.id || ':' || l_owner, p_invoice.establishment_id
    );
  end loop;
end;
$$;

revoke execute on function public.billing_notify_owners(public.billing_invoices, text, text, text)
  from public, anon, authenticated;

-- A fatura nova avisa o dono. Gatilho, e não código em
-- `billing_generate_invoices`, para valer também para fatura criada à mão.
create function public.billing_invoice_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.billing_notify_owners(
    new, 'invoice_created', 'Mensalidade do Vez disponível',
    'A fatura de ' || public.admin_brl(new.amount_cents) || ' vence em '
      || to_char(new.due_date, 'DD/MM') || '. Pague por Pix no portal, em Plano e assinatura.'
  );
  return null;
end;
$$;

create trigger billing_invoices_notify_created
  after insert on public.billing_invoices
  for each row when (new.status = 'open')
  execute function public.billing_invoice_created();

-- Roda todo dia. Idempotente: os avisos têm chave de deduplicação por fatura e
-- etapa, e a suspensão só pega loja ainda ativa.
create function public.billing_enforce(p_today date default null)
returns table (warned integer, suspended integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_today date := coalesce(p_today, (now() at time zone 'America/Sao_Paulo')::date);
  l_grace integer;
  l_invoice public.billing_invoices;
  l_late integer;
  l_warned integer := 0;
  l_suspended integer := 0;
begin
  select s.delinquency_grace_days into l_grace from public.platform_settings s where s.id;
  l_grace := coalesce(l_grace, 15);

  for l_invoice in
    select i.* from public.billing_invoices i
    where i.status = 'open' and i.due_date < l_today
    order by i.due_date
  loop
    l_late := l_today - l_invoice.due_date;

    if l_late >= l_grace then
      update public.establishments e
      set status = 'suspended',
          status_reason = 'Mensalidade em atraso desde ' || to_char(l_invoice.due_date, 'DD/MM/YYYY')
            || '. A loja volta ao ar assim que a fatura for paga.'
      where e.id = l_invoice.establishment_id and e.status = 'active';

      if found then
        update public.billing_invoices set suspended_at = now() where id = l_invoice.id;
        perform public.admin_write_audit(
          'Suspensão automática por mensalidade em atraso',
          public.admin_brl(l_invoice.amount_cents) || ' · ' || l_late || ' dias de atraso',
          l_invoice.establishment_id
        );
        perform public.billing_notify_owners(
          l_invoice, 'invoice_suspended', 'Loja suspensa por falta de pagamento',
          'A mensalidade de ' || public.admin_brl(l_invoice.amount_cents)
            || ' está há ' || l_late || ' dias em atraso e a loja saiu do app. '
            || 'Pague por Pix no portal para voltar na hora.'
        );
        l_suspended := l_suspended + 1;
      end if;
    elsif l_late >= 3 then
      -- Duas etapas (3 e 7 dias); a chave de deduplicação garante uma vez cada.
      perform public.billing_notify_owners(
        l_invoice,
        case when l_late >= 7 then 'invoice_overdue_2' else 'invoice_overdue_1' end,
        'Mensalidade do Vez em atraso',
        'A fatura de ' || public.admin_brl(l_invoice.amount_cents) || ' venceu em '
          || to_char(l_invoice.due_date, 'DD/MM') || '. Faltam ' || (l_grace - l_late)
          || ' dias para a loja ser suspensa. Pague por Pix no portal.'
      );
      l_warned := l_warned + 1;
    end if;
  end loop;

  return query select l_warned, l_suspended;
end;
$$;

revoke execute on function public.billing_enforce(date) from public, anon, authenticated;
grant execute on function public.billing_enforce(date) to service_role;

-- Fatura paga devolve a loja ao ar — se foi a cobrança que a tirou.
create function public.billing_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_est public.establishments;
  l_city public.cities;
  l_kind public.plan_kind;
  l_grace integer;
begin
  select * into l_est from public.establishments e where e.id = new.establishment_id for update;
  if l_est.status <> 'suspended' then return null; end if;

  -- Suspensão que não veio de fatura (moderação, fraude) não se desfaz pagando.
  -- Duas marcas têm que bater: uma fatura que registra ter suspendido a loja, e
  -- o motivo que `billing_enforce` escreveu. A segunda cobre o caso de o admin
  -- reativar à mão e, depois, suspender por outro motivo.
  if l_est.status_reason is null or l_est.status_reason not like 'Mensalidade em atraso%'
    or not exists (
      select 1 from public.billing_invoices i
      where i.establishment_id = new.establishment_id and i.suspended_at is not null
    )
  then
    return null;
  end if;

  select s.delinquency_grace_days into l_grace from public.platform_settings s where s.id;
  if exists (
    select 1 from public.billing_invoices i
    where i.establishment_id = new.establishment_id and i.status = 'open' and i.id <> new.id
      and i.due_date + coalesce(l_grace, 15) <= (now() at time zone 'America/Sao_Paulo')::date
  ) then
    return null;
  end if;

  -- Enquanto esteve suspensa, a loja de mensalidade liberou a vaga da cidade.
  -- Se outra ocupou, a volta não é automática: quem resolve é o time.
  select p.kind into l_kind from public.plans p where p.id = l_est.plan_id;
  select * into l_city from public.cities c where c.id = l_est.city_id for update;
  if l_kind = 'monthly' and public.admin_quota_used(l_city.id) >= l_city.monthly_quota then
    update public.establishments
    set status_reason = 'Mensalidade paga. A vaga de mensalidade da cidade foi ocupada; fale com o suporte do Vez para reativar.'
    where id = l_est.id;
    return null;
  end if;

  update public.establishments set status = 'active', status_reason = null where id = l_est.id;
  update public.billing_invoices set suspended_at = null
  where establishment_id = l_est.id and suspended_at is not null;
  perform public.admin_write_audit(
    'Reativação automática: mensalidade paga',
    public.admin_brl(new.amount_cents), l_est.id
  );
  perform public.billing_notify_owners(
    new, 'invoice_reactivated', 'Loja de volta ao ar',
    'Recebemos a mensalidade. A loja voltou a aparecer no app.'
  );
  return null;
end;
$$;

create trigger billing_invoices_reactivate
  after update of status on public.billing_invoices
  for each row when (old.status = 'open' and new.status = 'paid')
  execute function public.billing_invoice_paid();

select cron.schedule('billing-enforce', '40 9 * * *', 'select public.billing_enforce()');

-- ---------------------------------------------------------------------------
-- 4. Financeiro do admin: o que foi recebido, não o que se estimava
-- ---------------------------------------------------------------------------

-- Faturas e recebimentos pelo app, para a tela Financeiro.
create function public.admin_billing()
returns table (invoices jsonb, transfers jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require(array['finance', 'operations']::public.platform_role[]);
  return query
    select
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'establishment_id', i.establishment_id,
            'establishment', e.name,
            'city', c.name,
            'competence', i.period_start,
            'amount_cents', i.amount_cents,
            'due_date', i.due_date,
            'paid_at', i.paid_at,
            'status', case
              when i.status = 'paid' then 'paid'
              when i.due_date < (now() at time zone 'America/Sao_Paulo')::date then 'overdue'
              else 'pending'
            end
          )
          order by i.period_start desc, e.name
        )
        from public.billing_invoices i
        join public.establishments e on e.id = i.establishment_id
        join public.cities c on c.id = e.city_id
        where i.status <> 'void' and i.period_start >= date_trunc('month', now()) - interval '11 months'
      ), '[]'::jsonb),
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', t.establishment_id || ':' || t.month,
            'establishment', t.name,
            'city', t.city,
            'gross_cents', t.gross_cents,
            'fee_cents', t.fee_cents,
            'at', t.last_paid_at
          )
          order by t.month desc, t.gross_cents desc
        )
        from (
          select
            p.establishment_id, e.name, c.name as city,
            date_trunc('month', p.paid_at)::date as month,
            sum(p.amount_cents - p.refunded_cents) as gross_cents,
            -- A taxa acompanha o estorno: devolveu metade, retém metade.
            sum(round(p.platform_fee_cents::numeric * (p.amount_cents - p.refunded_cents) / p.amount_cents)) as fee_cents,
            max(p.paid_at) as last_paid_at
          from public.payments p
          join public.establishments e on e.id = p.establishment_id
          join public.cities c on c.id = e.city_id
          where p.status in ('paid', 'partially_refunded')
            and p.paid_at >= date_trunc('month', now()) - interval '5 months'
          group by p.establishment_id, e.name, c.name, date_trunc('month', p.paid_at)
        ) t
      ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_billing() from public, anon;
grant execute on function public.admin_billing() to authenticated, service_role;

-- Reenvia o aviso de uma fatura em aberto ao dono da loja.
create function public.admin_resend_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_invoice public.billing_invoices;
begin
  perform public.admin_require(array['finance']::public.platform_role[]);
  select * into l_invoice from public.billing_invoices where id = p_invoice_id;
  if not found or l_invoice.status <> 'open' then
    raise exception 'Só dá para reenviar fatura em aberto.' using errcode = 'P0001';
  end if;

  -- O instante entra no tipo do aviso para a deduplicação não engolir o reenvio.
  perform public.billing_notify_owners(
    l_invoice, 'invoice_resent_' || to_char(now(), 'YYYYMMDDHH24MI'),
    'Mensalidade do Vez em aberto',
    'A fatura de ' || public.admin_brl(l_invoice.amount_cents) || ' venceu em '
      || to_char(l_invoice.due_date, 'DD/MM') || '. Pague por Pix no portal, em Plano e assinatura.'
  );
  perform public.admin_write_audit(
    'Reenviou cobrança', public.admin_brl(l_invoice.amount_cents), l_invoice.establishment_id
  );
end;
$$;

revoke execute on function public.admin_resend_invoice(uuid) from public, anon;
grant execute on function public.admin_resend_invoice(uuid) to authenticated, service_role;

-- A série de receita era estimativa (mensalidade vigente + comissão sobre
-- atendimento concluído). Com cobrança de verdade, passa a ser o recebido:
-- fatura paga no mês e taxa retida nos pagamentos pelo app do mês.
create or replace function public.admin_overview()
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
        where pay.status in ('paid', 'partially_refunded') and pay.paid_at >= date_trunc('month', now())
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
              select coalesce(sum(round(
                pay.platform_fee_cents::numeric * (pay.amount_cents - pay.refunded_cents) / pay.amount_cents
              )), 0)
              from public.payments pay
              where pay.status in ('paid', 'partially_refunded')
                and pay.paid_at >= m.start and pay.paid_at < m.start + interval '1 month'
            ),
            'monthly_cents', (
              select coalesce(sum(i.amount_cents), 0)
              from public.billing_invoices i
              where i.status = 'paid'
                and i.paid_at >= m.start and i.paid_at < m.start + interval '1 month'
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
