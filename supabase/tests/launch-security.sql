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

-- Cancelamento pela RPC altera apenas status/cancelamento. A reserva nasce
-- aqui: o cenário não depende do que a demo tem no dia em que o teste roda.
reset role;
insert into public.appointments (
  id, establishment_id, professional_id, service_id, customer_id,
  starts_at, ends_at, price_cents, deposit_cents, status
) values (
  '0e000000-0000-4000-8000-0000000000a1', '0a000000-0000-4000-8000-000000000001',
  '0c000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000001',
  '0d000000-0000-4000-8000-000000000003',
  now() + interval '30 days', now() + interval '30 days 30 minutes', 5500, 0, 'confirmed'
);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","email":"cliente@vez.local"}', true);
do $$
declare l_before public.appointments; l_after public.appointments;
begin
  select * into l_before from public.appointments a where a.id = '0e000000-0000-4000-8000-0000000000a1';
  if l_before.id is null then raise exception 'gate: cliente nao le a propria reserva'; end if;
  perform public.customer_cancel_appointment(l_before.id, 'teste do gate');
  select * into l_after from public.appointments a where a.id = l_before.id;
  if l_after.status <> 'cancelled_by_customer' or l_after.price_cents <> l_before.price_cents
    or l_after.starts_at <> l_before.starts_at or l_after.cancellation_reason <> 'teste do gate' then
    raise exception 'gate: cancelamento via RPC alterou campos indevidos';
  end if;
  begin
    perform public.customer_cancel_appointment(l_before.id, 'de novo');
    raise exception 'gate: reserva ja cancelada foi cancelada de novo';
  exception when raise_exception then
    if sqlerrm like 'gate:%' then raise; end if;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Autorizacao de 30/09: equipe, reservas, nota da loja e codigo do balcao
-- ---------------------------------------------------------------------------
--   dono    0d000000-0000-4000-8000-000000000001 (rafael)
--   equipe  0d000000-0000-4000-8000-000000000002 (diego)
--   admin   0d000000-0000-4000-8000-000000000004 (sem vinculo com a loja)

-- Reserva concluida com avaliacao negativa, para a equipe tentar apagar.
insert into public.appointments (
  id, establishment_id, professional_id, service_id, customer_id,
  starts_at, ends_at, price_cents, deposit_cents, status
) values (
  '0e000000-0000-4000-8000-0000000000a2', '0a000000-0000-4000-8000-000000000001',
  '0c000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000001',
  '0d000000-0000-4000-8000-000000000003',
  now() - interval '40 days', now() - interval '40 days' + interval '30 minutes', 5500, 0, 'completed'
);
insert into public.reviews (id, establishment_id, appointment_id, customer_id, professional_id, rating, comment)
values ('0e000000-0000-4000-8000-0000000000b1', '0a000000-0000-4000-8000-000000000001',
  '0e000000-0000-4000-8000-0000000000a2', '0d000000-0000-4000-8000-000000000003',
  '0c000000-0000-4000-8000-000000000001', 1, 'Atrasou uma hora.');

-- Dono: nao cria vinculo sem aceite, nao troca a pessoa do vinculo.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated","email":"rafael@vez.local"}', true);
do $$
declare l_changed integer;
begin
  begin
    insert into public.establishment_members (user_id, establishment_id, role)
    values ('0d000000-0000-4000-8000-000000000004', '0a000000-0000-4000-8000-000000000001', 'staff');
    raise exception 'gate: dono vinculou conta a equipe sem convite aceito';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.profiles p where p.id = '0d000000-0000-4000-8000-000000000004') then
    raise exception 'gate: dono le o perfil de conta que nao e da equipe';
  end if;
  begin
    update public.establishment_members set user_id = '0d000000-0000-4000-8000-000000000004'
    where user_id = '0d000000-0000-4000-8000-000000000002'
      and establishment_id = '0a000000-0000-4000-8000-000000000001';
    raise exception 'gate: dono trocou a pessoa de um vinculo';
  exception when insufficient_privilege then null;
  end;

  -- O que o portal faz continua valendo: mudar papel e remover.
  update public.establishment_members set role = 'manager'
  where user_id = '0d000000-0000-4000-8000-000000000002'
    and establishment_id = '0a000000-0000-4000-8000-000000000001';
  get diagnostics l_changed = row_count;
  if l_changed <> 1 then raise exception 'gate: dono nao conseguiu mudar o papel da equipe'; end if;
  update public.establishment_members set role = 'staff'
  where user_id = '0d000000-0000-4000-8000-000000000002'
    and establishment_id = '0a000000-0000-4000-8000-000000000001';

  -- Nota e cidade nao sao do dono; o perfil publico e.
  begin
    update public.establishments set rating_avg = 5, rating_count = 9999
    where id = '0a000000-0000-4000-8000-000000000001';
    raise exception 'gate: dono escreveu a propria nota';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.establishments
    set city_id = (select c.id from public.cities c
      where c.id <> (select e.city_id from public.establishments e
        where e.id = '0a000000-0000-4000-8000-000000000001') limit 1)
    where id = '0a000000-0000-4000-8000-000000000001';
    raise exception 'gate: dono mudou a loja de cidade';
  exception when insufficient_privilege then null;
  end;
  update public.establishments set description = 'Perfil editado no gate.'
  where id = '0a000000-0000-4000-8000-000000000001';
  get diagnostics l_changed = row_count;
  if l_changed <> 1 then raise exception 'gate: dono nao conseguiu editar o perfil publico'; end if;
end $$;

-- A nota continua vindo das avaliacoes (gatilho security definer).
reset role;
do $$
begin
  if (select rating_count from public.establishments
      where id = '0a000000-0000-4000-8000-000000000001') = 9999 then
    raise exception 'gate: nota forjada foi gravada';
  end if;
end $$;

-- Equipe: nao apaga reserva (nem a avaliacao junto), nao reserva em nome de
-- conta alheia, nao troca o cliente.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000002","role":"authenticated","email":"diego@vez.local"}', true);
do $$
declare l_changed integer;
begin
  begin
    delete from public.appointments where id = '0e000000-0000-4000-8000-0000000000a2';
    raise exception 'gate: equipe apagou reserva concluida';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.appointments (
      establishment_id, professional_id, service_id, customer_id,
      starts_at, ends_at, price_cents, deposit_cents, status
    ) values (
      '0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000002',
      '0b000000-0000-4000-8000-000000000001', '0d000000-0000-4000-8000-000000000004',
      now() - interval '50 days', now() - interval '50 days' + interval '30 minutes', 5500, 0, 'completed'
    );
    raise exception 'gate: equipe criou reserva em nome de conta alheia';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.appointments set customer_id = '0d000000-0000-4000-8000-000000000004'
    where id = '0e000000-0000-4000-8000-0000000000a2';
    raise exception 'gate: equipe trocou o cliente da reserva';
  exception when insufficient_privilege then null;
  end;

  -- O que o app da loja faz continua valendo: balcao e mudanca de situacao.
  insert into public.appointments (
    establishment_id, professional_id, service_id, customer_id, guest_name,
    starts_at, ends_at, price_cents, deposit_cents, status
  ) values (
    '0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000002',
    '0b000000-0000-4000-8000-000000000001', null, 'Cliente de balcao',
    now() + interval '31 days', now() + interval '31 days 30 minutes', 5500, 0, 'confirmed'
  );
  update public.appointments set status = 'no_show'
  where guest_name = 'Cliente de balcao' and establishment_id = '0a000000-0000-4000-8000-000000000001'
    and starts_at > now() + interval '30 days';
  get diagnostics l_changed = row_count;
  if l_changed <> 1 then raise exception 'gate: equipe nao conseguiu atualizar reserva de balcao'; end if;

  begin
    perform public.queue_code_matches('0a000000-0000-4000-8000-000000000001', 'AAAAAAAA');
    raise exception 'gate: queue_code_matches segue chamavel por authenticated';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$
begin
  if not exists (select 1 from public.reviews r where r.id = '0e000000-0000-4000-8000-0000000000b1') then
    raise exception 'gate: avaliacao sumiu junto com a reserva';
  end if;
end $$;

-- A conferencia do codigo continua funcionando por dentro de queue_join.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000004","role":"authenticated","email":"admin@vez.local"}', true);
do $$
declare l_hint text;
begin
  begin
    perform public.queue_join('0a000000-0000-4000-8000-000000000001', null, null, 'ERRADO00');
    raise exception 'gate: fila aceitou codigo de balcao errado';
  exception when raise_exception then
    get stacked diagnostics l_hint = pg_exception_hint;
    if l_hint is distinct from 'queue_code_invalid' then raise; end if;
  end;
end $$;
reset role;

rollback;
\echo 'launch-security: OK'
