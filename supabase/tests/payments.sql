\set ON_ERROR_STOP on

-- Matriz comportamental de pagamento: quem escreve, onde ficam os tokens, o
-- que o cancelamento devolve, e a fatura do mês. Requer `db:demo` (contas e
-- lojas). Roda em transação e termina em rollback; nenhum provedor é chamado.
--
--   dono     0d000000-0000-4000-8000-000000000001  (Barbearia Meia-Nove)
--   equipe   0d000000-0000-4000-8000-000000000002
--   cliente  0d000000-0000-4000-8000-000000000003
begin;

create temporary table t_ids (key text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated, service_role;

-- Três reservas futuras do cliente, com sinal de R$ 15, em dias diferentes.
with ins as (
  insert into public.appointments (
    establishment_id, professional_id, service_id, customer_id,
    starts_at, ends_at, status, price_cents, deposit_cents
  )
  select
    '0a000000-0000-4000-8000-000000000001',
    (select id from public.professionals
      where establishment_id = '0a000000-0000-4000-8000-000000000001' order by id limit 1),
    '0b000000-0000-4000-8000-000000000002',
    '0d000000-0000-4000-8000-000000000003',
    date_trunc('hour', now()) + make_interval(days => 400 + n, hours => 3),
    date_trunc('hour', now()) + make_interval(days => 400 + n, hours => 3, mins => 30),
    'confirmed', 4500, 1500
  from generate_series(1, 3) n
  returning id, starts_at
)
insert into t_ids
select 'appt_' || row_number() over (order by starts_at), id from ins;

-- Uma quarta, daqui a uma hora: dentro da janela de cancelamento da loja (2 h).
with ins as (
  insert into public.appointments (
    establishment_id, professional_id, service_id, customer_id,
    starts_at, ends_at, status, price_cents, deposit_cents
  )
  select
    '0a000000-0000-4000-8000-000000000001',
    (select id from public.professionals
      where establishment_id = '0a000000-0000-4000-8000-000000000001' order by id desc limit 1),
    '0b000000-0000-4000-8000-000000000002',
    '0d000000-0000-4000-8000-000000000003',
    now() + interval '1 hour', now() + interval '90 minutes', 'confirmed', 4500, 1500
  returning id
)
insert into t_ids select 'appt_late', id from ins;

-- Uma quinta, também dentro da janela, que será paga por inteiro pelo app.
with ins as (
  insert into public.appointments (
    establishment_id, professional_id, service_id, customer_id,
    starts_at, ends_at, status, price_cents, deposit_cents
  )
  select
    '0a000000-0000-4000-8000-000000000001',
    (select id from public.professionals
      where establishment_id = '0a000000-0000-4000-8000-000000000001' order by id desc limit 1),
    '0b000000-0000-4000-8000-000000000002',
    '0d000000-0000-4000-8000-000000000003',
    now() + interval '100 minutes', now() + interval '130 minutes', 'confirmed', 4500, 1500
  returning id
)
insert into t_ids select 'appt_full', id from ins;

-- ---------------------------------------------------------------------------
-- 1. Ninguém além do service role escreve dinheiro nem lê credencial
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","email":"cliente@vez.local"}', true);

do $$
declare
  l_appt uuid := (select id from t_ids where key = 'appt_1');
  l_shop uuid := '0a000000-0000-4000-8000-000000000001';
begin
  begin
    insert into public.payments (appointment_id, establishment_id, customer_id, amount_cents, status)
    values (l_appt, l_shop, auth.uid(), 1500, 'paid');
    raise exception 'pagamento: cliente declarou-se pago';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.payment_account_store(l_shop, 'fake', 'x', 'a', 'r', now(), null);
    raise exception 'pagamento: cliente gravou conta de recebimento';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.payment_account_credentials(l_shop, 'fake');
    raise exception 'pagamento: cliente leu credenciais';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.payment_secret_put('payment:fake:x:access', 'roubado');
    raise exception 'pagamento: cliente escreveu no vault';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.payment_claim_work(5);
    raise exception 'pagamento: cliente reservou trabalho de conciliação';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.billing_generate_invoices();
    raise exception 'cobrança: cliente gerou faturas';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.billing_invoices (
      establishment_id, period_start, period_end, due_date, list_price_cents, amount_cents, status
    ) values (l_shop, '2030-01-01', '2030-02-01', '2030-01-10', 100, 100, 'paid');
    raise exception 'cobrança: cliente criou fatura';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Conta da loja: tokens no Vault, e a resposta pública só vira "sim" com
--    conta conectada, sinal configurado e pagamento pelo app ligado
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  l_shop uuid := '0a000000-0000-4000-8000-000000000001';
  l_row record;
begin
  update public.establishment_settings set accept_app_payment = true where establishment_id = l_shop;

  if public.establishment_accepts_app_payment(l_shop) then
    raise exception 'pagamento: loja sem conta conectada aparece aceitando';
  end if;

  perform public.payment_account_store(
    l_shop, 'fake', 'acct_1', 'tok_a', 'tok_r', now() + interval '10 days',
    '0d000000-0000-4000-8000-000000000001');
  -- Renovação: troca o token, mantém quem conectou.
  perform public.payment_account_store(l_shop, 'fake', 'acct_1', 'tok_b', 'tok_r2', now() + interval '180 days', null);

  select * into l_row from public.payment_account_credentials(l_shop, 'fake');
  if l_row.access_token <> 'tok_b' or l_row.refresh_token <> 'tok_r2' then
    raise exception 'pagamento: credenciais não voltaram do vault (%, %)', l_row.access_token, l_row.refresh_token;
  end if;
  if (select connected_by from public.payment_accounts where establishment_id = l_shop)
     is distinct from '0d000000-0000-4000-8000-000000000001' then
    raise exception 'pagamento: renovação apagou quem conectou';
  end if;
  if not public.establishment_accepts_app_payment(l_shop) then
    raise exception 'pagamento: loja conectada não aparece aceitando';
  end if;

  update public.establishment_settings set accept_app_payment = false where establishment_id = l_shop;
  if public.establishment_accepts_app_payment(l_shop) then
    raise exception 'pagamento: loja desligou e continua aceitando';
  end if;
  update public.establishment_settings set accept_app_payment = true where establishment_id = l_shop;
end $$;

-- A resposta pública é legível sem conta.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  if not public.establishment_accepts_app_payment('0a000000-0000-4000-8000-000000000001') then
    raise exception 'pagamento: anônimo não consegue saber se a loja aceita pagamento';
  end if;
end $$;

-- Dono vê a conta; equipe e cliente não.
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.payment_accounts) <> 1 then
    raise exception 'pagamento: dono não vê a conta da própria loja';
  end if;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.payment_accounts) <> 0 then
    raise exception 'pagamento: equipe vê a conta de recebimento';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Uma cobrança viva por reserva; o cliente lê a própria e mais nenhuma
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.payments (
  appointment_id, establishment_id, customer_id, amount_cents, platform_fee_cents,
  status, method, provider, provider_charge_id, last_synced_at
)
select id, '0a000000-0000-4000-8000-000000000001', '0d000000-0000-4000-8000-000000000003',
  1500, 180, 'paid', 'pix', 'fake', 'ch_' || key, now()
from t_ids;
update public.payments set paid_at = now() where provider = 'fake';

update public.payments set amount_cents = 4500, platform_fee_cents = 540, scope = 'full'
where provider_charge_id = 'ch_appt_full';

do $$
begin
  begin
    insert into public.payments (appointment_id, establishment_id, customer_id, amount_cents, status)
    select id, '0a000000-0000-4000-8000-000000000001', '0d000000-0000-4000-8000-000000000003', 1500, 'pending'
    from t_ids where key = 'appt_1';
    raise exception 'pagamento: segunda cobrança viva para a mesma reserva';
  exception when unique_violation then null;
  end;
  begin
    update public.payments set platform_fee_cents = 1501 where provider_charge_id = 'ch_appt_1';
    raise exception 'pagamento: taxa maior que o valor';
  exception when check_violation then null;
  end;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.payments where provider = 'fake') <> 5 then
    raise exception 'pagamento: cliente não vê os próprios pagamentos';
  end if;
  update public.payments set status = 'refunded', refunded_cents = amount_cents;
  if exists (select 1 from public.payments where provider = 'fake' and status <> 'paid') then
    raise exception 'pagamento: cliente estornou o próprio pagamento';
  end if;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.payments where provider = 'fake') then
    raise exception 'pagamento: equipe (staff) vê pagamentos';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. O cancelamento decide o estorno
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  l_due integer;
begin
  -- Loja cancela: volta tudo.
  update public.appointments set status = 'cancelled_by_establishment', cancelled_at = now()
  where id = (select id from t_ids where key = 'appt_1');
  select refund_requested_cents into l_due from public.payments where provider_charge_id = 'ch_appt_1';
  if l_due <> 1500 then raise exception 'estorno: loja cancelou e o sinal não volta (%).', l_due; end if;

  -- Cliente cancela com antecedência, sinal reembolsável: volta tudo.
  update public.appointments set status = 'cancelled_by_customer', cancelled_at = now()
  where id = (select id from t_ids where key = 'appt_2');
  select refund_requested_cents into l_due from public.payments where provider_charge_id = 'ch_appt_2';
  if l_due <> 1500 then raise exception 'estorno: cliente cancelou a tempo e o sinal não volta (%).', l_due; end if;

  -- Cliente cancela com antecedência, loja marcou sinal como não reembolsável.
  update public.establishment_settings set deposit_refundable = false
  where establishment_id = '0a000000-0000-4000-8000-000000000001';
  update public.appointments set status = 'cancelled_by_customer', cancelled_at = now()
  where id = (select id from t_ids where key = 'appt_3');
  select refund_requested_cents into l_due from public.payments where provider_charge_id = 'ch_appt_3';
  if l_due <> 0 then raise exception 'estorno: sinal não reembolsável voltou (%).', l_due; end if;
  update public.establishment_settings set deposit_refundable = true
  where establishment_id = '0a000000-0000-4000-8000-000000000001';

  -- Cliente cancela em cima da hora: fica com a loja.
  update public.appointments set status = 'cancelled_by_customer', cancelled_at = now()
  where id = (select id from t_ids where key = 'appt_late');
  select refund_requested_cents into l_due from public.payments where provider_charge_id = 'ch_appt_late';
  if l_due <> 0 then raise exception 'estorno: cancelamento fora do prazo devolveu o sinal (%).', l_due; end if;

  -- Pagou o valor inteiro e cancelou em cima da hora: perde o sinal, não o
  -- serviço que não vai receber.
  update public.appointments set status = 'cancelled_by_customer', cancelled_at = now()
  where id = (select id from t_ids where key = 'appt_full');
  select refund_requested_cents into l_due from public.payments where provider_charge_id = 'ch_appt_full';
  if l_due <> 3000 then raise exception 'estorno: valor inteiro fora do prazo devia devolver 3000, devolveu %.', l_due; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Conciliação: só o que tem trabalho, e uma vez só
-- ---------------------------------------------------------------------------
do $$
declare
  l_first integer;
  l_second integer;
begin
  select count(*) into l_first from public.payment_claim_work(50) w where w.provider = 'fake';
  if l_first <> 3 then
    raise exception 'conciliação: esperava os 3 estornos devidos, reservou %', l_first;
  end if;
  select count(*) into l_second from public.payment_claim_work(50) w where w.provider = 'fake';
  if l_second <> 0 then
    raise exception 'conciliação: a mesma linha foi reservada duas vezes (%).', l_second;
  end if;

  -- Estorno concluído sai da fila de vez.
  update public.payments set
    refunded_cents = refund_requested_cents,
    status = case when refund_requested_cents = amount_cents then 'refunded' else 'partially_refunded' end::public.payment_status,
    last_synced_at = null
  where provider = 'fake' and refund_requested_cents > 0;
  select count(*) into l_first from public.payment_claim_work(50) w where w.provider = 'fake';
  if l_first <> 0 then raise exception 'conciliação: estorno concluído voltou para a fila'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Fatura do mês
-- ---------------------------------------------------------------------------
do $$
declare
  l_shop uuid := '0a000000-0000-4000-8000-000000000001';
  -- `status_changed_at` é carimbo do gatilho, ninguém escreve à mão: o teste
  -- se orienta pelo mês em que a loja do demo ficou ativa.
  l_joined date := date_trunc('month', (select status_changed_at from public.establishments where id = l_shop))::date;
  l_next date := (l_joined + interval '1 month')::date;
  l_row public.billing_invoices;
begin
  delete from public.billing_invoices;

  -- Plano de comissão não tem fatura.
  if public.billing_generate_invoices(l_next) <> 0 then
    raise exception 'cobrança: loja em comissão recebeu fatura';
  end if;

  update public.cities set monthly_price_cents = 14900
  where id = (select city_id from public.establishments where id = l_shop);
  update public.establishments set
    plan_id = (select id from public.plans where kind = 'monthly' and is_default),
    discount_percent = 20, discount_until = null
  where id = l_shop;

  -- O mês em que a loja entrou não é cobrado.
  if public.billing_generate_invoices(l_joined) <> 0 then
    raise exception 'cobrança: mês de entrada foi cobrado';
  end if;

  -- Qualquer dia do mês seguinte gera a fatura daquele mês, uma vez só.
  if public.billing_generate_invoices(l_next + 14) <> 1 then
    raise exception 'cobrança: fatura do mês não nasceu';
  end if;
  if public.billing_generate_invoices(l_next) <> 0 then
    raise exception 'cobrança: fatura duplicada';
  end if;

  select * into l_row from public.billing_invoices where establishment_id = l_shop;
  if l_row.list_price_cents <> 14900 or l_row.discount_cents <> 2980 or l_row.amount_cents <> 11920
     or l_row.period_start <> l_next or l_row.due_date <> l_next + 9 or l_row.status <> 'open' then
    raise exception 'cobrança: fatura errada: %', row_to_json(l_row);
  end if;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.billing_invoices) <> 1 then
    raise exception 'cobrança: dono não vê a própria fatura';
  end if;
  update public.billing_invoices set status = 'paid';
  if exists (select 1 from public.billing_invoices where status = 'paid') then
    raise exception 'cobrança: dono marcou a fatura como paga';
  end if;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.billing_invoices) then
    raise exception 'cobrança: cliente vê fatura de loja';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Inadimplência: avisa, suspende depois da carência, e o pagamento reativa
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  l_shop uuid := '0a000000-0000-4000-8000-000000000001';
  l_owner uuid := '0d000000-0000-4000-8000-000000000001';
  l_invoice public.billing_invoices;
  l_grace integer;
  l_result record;
begin
  select * into l_invoice from public.billing_invoices where establishment_id = l_shop;
  select delinquency_grace_days into l_grace from public.platform_settings where id;
  update public.cities set monthly_quota = 5
  where id = (select city_id from public.establishments where id = l_shop);

  if not exists (
    select 1 from public.notification_outbox
    where user_id = l_owner and kind = 'invoice_created' and channel = 'email'
  ) then
    raise exception 'cobrança: fatura nova não avisou o dono';
  end if;

  -- No vencimento ninguém é incomodado.
  select * into l_result from public.billing_enforce(l_invoice.due_date);
  if l_result.warned <> 0 or l_result.suspended <> 0 then
    raise exception 'inadimplência: agiu no dia do vencimento';
  end if;

  perform public.billing_enforce(l_invoice.due_date + 3);
  perform public.billing_enforce(l_invoice.due_date + 4);
  if (select count(*) from public.notification_outbox
      where user_id = l_owner and kind = 'invoice_overdue_1' and channel = 'push') <> 1 then
    raise exception 'inadimplência: primeiro aviso ausente ou repetido';
  end if;

  perform public.billing_enforce(l_invoice.due_date + 7);
  if not exists (select 1 from public.notification_outbox
      where user_id = l_owner and kind = 'invoice_overdue_2') then
    raise exception 'inadimplência: segundo aviso ausente';
  end if;
  if (select status from public.establishments where id = l_shop) <> 'active' then
    raise exception 'inadimplência: suspendeu antes da carência';
  end if;

  select * into l_result from public.billing_enforce(l_invoice.due_date + l_grace);
  if l_result.suspended <> 1 or (select status from public.establishments where id = l_shop) <> 'suspended' then
    raise exception 'inadimplência: não suspendeu depois de % dias', l_grace;
  end if;
  if (select suspended_at from public.billing_invoices where id = l_invoice.id) is null then
    raise exception 'inadimplência: fatura não registra que suspendeu a loja';
  end if;
  -- Rodar de novo não suspende duas vezes.
  select * into l_result from public.billing_enforce(l_invoice.due_date + l_grace + 1);
  if l_result.suspended <> 0 then raise exception 'inadimplência: suspendeu de novo'; end if;

  -- Pagou, voltou.
  update public.billing_invoices set status = 'paid', paid_at = now() where id = l_invoice.id;
  if (select status from public.establishments where id = l_shop) <> 'active' then
    raise exception 'inadimplência: fatura paga não reativou a loja';
  end if;
  if (select status_reason from public.establishments where id = l_shop) is not null then
    raise exception 'inadimplência: motivo da suspensão ficou na loja reativada';
  end if;

  -- Suspensão por moderação não se desfaz pagando fatura.
  update public.establishments set status = 'suspended', status_reason = 'Denúncia em análise'
  where id = l_shop;
  insert into public.billing_invoices (
    establishment_id, period_start, period_end, due_date, list_price_cents, amount_cents
  ) values (l_shop, '2031-01-01', '2031-02-01', '2031-01-10', 14900, 14900);
  update public.billing_invoices set status = 'paid', paid_at = now()
  where establishment_id = l_shop and period_start = '2031-01-01';
  if (select status from public.establishments where id = l_shop) <> 'suspended' then
    raise exception 'inadimplência: pagar fatura desfez suspensão de moderação';
  end if;
  update public.establishments set status = 'active', status_reason = null where id = l_shop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Financeiro do admin lê o que foi recebido
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
do $$
declare
  l_row record;
  l_transfer jsonb;
begin
  select * into l_row from public.admin_billing();
  if jsonb_array_length(l_row.invoices) < 2 then
    raise exception 'admin: faturas não aparecem no financeiro (%).', l_row.invoices;
  end if;
  select t into l_transfer from jsonb_array_elements(l_row.transfers) t
  where t ->> 'establishment' = 'Barbearia Meia-Nove';
  -- Sobraram pagos: appt_3 e appt_late (1500 cada, taxa 180) e appt_full com
  -- 1500 retidos de 4500 (taxa proporcional: 540 × 1500/4500 = 180).
  if (l_transfer ->> 'gross_cents')::integer <> 4500 or (l_transfer ->> 'fee_cents')::integer <> 540 then
    raise exception 'admin: recebido pelo app errado: %', l_transfer;
  end if;

  begin
    perform public.admin_resend_invoice(
      (select id from public.billing_invoices where status = 'paid' limit 1));
    raise exception 'admin: reenviou fatura já paga';
  exception when sqlstate 'P0001' then null;
  end;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
do $$
begin
  begin
    perform * from public.admin_billing();
    raise exception 'admin: dono de loja leu o financeiro da plataforma';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Desconectar apaga os tokens
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  l_shop uuid := '0a000000-0000-4000-8000-000000000001';
begin
  perform public.payment_account_revoke(l_shop, 'fake');
  if exists (select 1 from public.payment_account_credentials(l_shop, 'fake')) then
    raise exception 'pagamento: conta revogada ainda devolve credenciais';
  end if;
  if public.establishment_accepts_app_payment(l_shop) then
    raise exception 'pagamento: conta revogada ainda aceita pagamento';
  end if;
end $$;

reset role;
do $$
begin
  if exists (select 1 from vault.secrets where name like 'payment:fake:%') then
    raise exception 'pagamento: tokens ficaram no vault depois de desconectar';
  end if;
end $$;

rollback;

\echo 'pagamentos: matriz comportamental aprovada'
