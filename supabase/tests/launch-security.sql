\set ON_ERROR_STOP on

-- Matriz comportamental do gate de lancamento. Requer `db:reset` + `db:demo`.
-- Tudo roda em transacao e termina em rollback.
begin;

-- Deixa o cliente fora da fila para exercitar a RPC estreita.
delete from public.queue_entries where customer_id = '0d000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","email":"cliente@vez.local"}', true);

do $$
begin
  begin
    insert into public.queue_entries (establishment_id, customer_id, status, joined_at)
    values ('0a000000-0000-4000-8000-000000000001', auth.uid(), 'waiting', now() - interval '1 day');
    raise exception 'gate: insert direto na fila foi aceito';
  exception when insufficient_privilege then
    null;
  end;
end $$;

select public.queue_join(
  '0a000000-0000-4000-8000-000000000001',
  '0b000000-0000-4000-8000-000000000001', null, null
);

do $$
declare l_changed integer;
begin
  update public.queue_entries set joined_at = now() - interval '1 day'
  where customer_id = auth.uid();
  get diagnostics l_changed = row_count;
  if l_changed <> 0 then raise exception 'gate: cliente alterou joined_at'; end if;
end $$;

do $$
declare l_changed integer;
begin
  update public.appointments set price_cents = 1, status = 'cancelled_by_customer'
  where customer_id = auth.uid();
  get diagnostics l_changed = row_count;
  if l_changed <> 0 then raise exception 'gate: cliente alterou colunas da reserva'; end if;
end $$;

do $$
declare l_walk_in uuid;
begin
  select a.id into l_walk_in from public.appointments a where a.customer_id is null limit 1;
  begin
    perform public.customer_reschedule_appointment(l_walk_in, now() + interval '2 days', null);
    raise exception 'gate: cliente remarcou reserva de balcao';
  exception when no_data_found then
    null;
  end;
end $$;

do $$
declare l_entry uuid;
begin
  select q.id into l_entry from public.queue_entries q where q.customer_id = auth.uid();
  perform public.queue_leave(l_entry);
  if not exists (select 1 from public.queue_entries q where q.id = l_entry and q.status = 'left') then
    raise exception 'gate: queue_leave nao encerrou a entrada';
  end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  if exists (select 1 from public.queue_state('0a000000-0000-4000-8000-000000000001') where customer_id is not null) then
    raise exception 'gate: queue_state anon expos customer_id';
  end if;
end $$;

reset role;
do $$
begin
  if has_function_privilege('authenticated',
    'public.establishment_add_member(uuid,text,text,public.establishment_role,uuid,boolean)', 'EXECUTE') then
    raise exception 'gate: establishment_add_member segue executavel por authenticated';
  end if;
end $$;

set local role service_role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}', true);
select public.establishment_record_invite(
  '0a000000-0000-4000-8000-000000000001', 'cliente@vez.local', 'Cliente Teste',
  'staff', null, false, '0d000000-0000-4000-8000-000000000001'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","email":"cliente@vez.local"}', true);
select * from public.establishment_accept_invites();
do $$
begin
  if not exists (select 1 from public.establishment_members m
    where m.user_id = auth.uid() and m.establishment_id = '0a000000-0000-4000-8000-000000000001') then
    raise exception 'gate: aceite nao criou vinculo';
  end if;
end $$;

reset role;
insert into public.notification_outbox (
  user_id, channel, app, kind, title, body, status, expires_at
) values (
  '0d000000-0000-4000-8000-000000000003', 'push', 'cliente', 'gate_expired',
  'Teste', 'Nao deve ser entregue', 'unconfigured', now() - interval '1 minute'
);
set local role service_role;
select public.notification_expire();
reset role;
do $$
begin
  if exists (select 1 from public.notification_outbox o
    where o.kind = 'gate_expired' and o.status <> 'skipped') then
    raise exception 'gate: aviso expirado permaneceu entregavel';
  end if;
end $$;

-- Token de push de outra conta nao e sequestrado por ON CONFLICT.
insert into public.push_devices (user_id, expo_token, app, platform)
values ('0d000000-0000-4000-8000-000000000001', 'ExponentPushToken[gate-owner]', 'staff', 'ios');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","email":"cliente@vez.local"}', true);
do $$
begin
  begin
    perform public.register_push_device('ExponentPushToken[gate-owner]', 'cliente', 'ios', null);
    raise exception 'gate: token de push de outra conta foi assumido';
  exception when raise_exception then
    if sqlerrm like 'gate:%' then raise; end if;
  end;
end $$;

-- Cancelamento pela RPC altera apenas status/cancelamento.
do $$
declare l_id uuid; l_before public.appointments; l_after public.appointments;
begin
  select * into l_before from public.appointments a
  where a.customer_id = auth.uid() and a.status in ('scheduled', 'confirmed') and a.starts_at > now()
  limit 1;
  if l_before.id is null then
    raise notice 'gate: sem reserva futura na demo para cancelar; caso pulado';
    return;
  end if;
  perform public.customer_cancel_appointment(l_before.id, 'teste do gate');
  select * into l_after from public.appointments a where a.id = l_before.id;
  if l_after.status <> 'cancelled_by_customer' or l_after.price_cents <> l_before.price_cents
    or l_after.starts_at <> l_before.starts_at then
    raise exception 'gate: cancelamento via RPC alterou campos indevidos';
  end if;
end $$;
reset role;

rollback;
\echo 'launch-security: OK'
