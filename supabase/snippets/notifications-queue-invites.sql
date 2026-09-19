-- Matriz de comportamento de avisos, fila, convites, anexos e recuperação de
-- MFA. Tudo é revertido ao final. Rode com:
--   docker exec -i supabase_db_vez-saas psql -U postgres -v ON_ERROR_STOP=1 < supabase/snippets/notifications-queue-invites.sql
begin;

-- Cliente sem outra entrada ativa na Meia-Nove.
delete from public.queue_entries
where customer_id = '0d000000-0000-4000-8000-000000000003';

-- ── fila: entrada de longe desligada ────────────────────────────────────────
update public.establishment_settings
set queue_remote_join = false, queue_qr_enabled = true, queue_auto_close = false
where establishment_id = '0a000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);

do $$
begin
  insert into public.queue_entries (establishment_id, customer_id)
  values ('0a000000-0000-4000-8000-000000000001', '0d000000-0000-4000-8000-000000000003');
  raise exception 'FALHA: entrou de longe com queue_remote_join desligado';
exception when sqlstate 'P0001' then
  if sqlerrm like 'FALHA%' then raise; end if;
end $$;

-- Declarar 'qr' sem código também não passa.
do $$
begin
  insert into public.queue_entries (establishment_id, customer_id, source)
  values ('0a000000-0000-4000-8000-000000000001', '0d000000-0000-4000-8000-000000000003', 'qr');
  raise exception 'FALHA: entrou como qr sem código';
exception when sqlstate 'P0001' then
  if sqlerrm like 'FALHA%' then raise; end if;
end $$;

-- Código errado.
do $$
begin
  perform public.queue_join('0a000000-0000-4000-8000-000000000001', null, null, 'ERRADO12');
  raise exception 'FALHA: código errado aceito';
exception when sqlstate 'P0001' then
  if sqlerrm like 'FALHA%' then raise; end if;
end $$;

-- Cliente não lê o código do balcão.
do $$
begin
  perform public.queue_qr_code('0a000000-0000-4000-8000-000000000001');
  raise exception 'FALHA: cliente leu o código do balcão';
exception when insufficient_privilege then null;
end $$;

-- O dono lê o código; o cliente entra com ele e já chega presente.
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
create temp table t_code on commit drop as
  select public.queue_qr_code('0a000000-0000-4000-8000-000000000001') as code;
grant select on t_code to authenticated;

select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
create temp table t_entry on commit drop as
  select public.queue_join('0a000000-0000-4000-8000-000000000001', null, null, (select code from t_code)) as id;
do $$
begin
  if not exists (
    select 1 from public.queue_entries q
    where q.id = (select id from t_entry) and q.source = 'qr' and q.arrived_at is not null
  ) then
    raise exception 'FALHA: entrada por QR não ficou como qr + chegada';
  end if;
end $$;

reset role;

-- A equipe foi avisada (push para o dono; Diego é staff sem cadeira nesta entrada).
do $$
begin
  if not exists (
    select 1 from public.notification_outbox o
    where o.kind = 'queue_join' and o.user_id = '0d000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'FALHA: dono não recebeu aviso de entrada na fila';
  end if;
end $$;

-- ── chamar → aviso ao cliente; auto skip → no_show ──────────────────────────
update public.establishment_settings
set queue_auto_skip = true, queue_notify_enabled = true, queue_notify_channel = 'push'
where establishment_id = '0a000000-0000-4000-8000-000000000001';
update public.queue_entries set status = 'called', called_at = now() - interval '3 minutes'
where id = (select id from t_entry);
do $$
begin
  if not exists (
    select 1 from public.notification_outbox o
    where o.kind = 'queue_called' and o.user_id = '0d000000-0000-4000-8000-000000000003'
      and o.channel = 'push' and o.app = 'cliente'
  ) then
    raise exception 'FALHA: cliente chamado não recebeu aviso';
  end if;
  -- Em duas instruções: na mesma, a leitura não veria o que a função gravou.
  perform public.queue_maintenance();
  if (select status from public.queue_entries where id = (select id from t_entry)) <> 'no_show' then
    raise exception 'FALHA: auto skip não marcou no_show';
  end if;
end $$;

-- Preferência do cliente desligada: chamar de novo não gera aviso.
insert into public.customer_notification_prefs (customer_id, queue_turn)
values ('0d000000-0000-4000-8000-000000000003', false)
on conflict (customer_id) do update set queue_turn = false;
update public.queue_entries set status = 'called', called_at = now() + interval '1 second'
where id = (select id from t_entry);
do $$
begin
  if (select count(*) from public.notification_outbox o where o.kind = 'queue_called') <> 1 then
    raise exception 'FALHA: aviso saiu com queue_turn desligado';
  end if;
end $$;

-- ── fila cheia (auto close) ─────────────────────────────────────────────────
update public.queue_entries set status = 'done' where id = (select id from t_entry);
update public.establishment_settings
set queue_remote_join = true, queue_auto_close = true, queue_close_after_minutes = 5
where establishment_id = '0a000000-0000-4000-8000-000000000001';
insert into public.queue_entries (establishment_id, guest_name, source, status)
select '0a000000-0000-4000-8000-000000000001', 'Balcão ' || g, 'counter', 'waiting'
from generate_series(1, 3) g;
set local role authenticated;
do $$
begin
  perform public.queue_join('0a000000-0000-4000-8000-000000000001');
  raise exception 'FALHA: entrou com a fila cheia';
exception when sqlstate 'P0001' then
  if sqlerrm like 'FALHA%' then raise; end if;
end $$;
reset role;

-- ── dispositivos ────────────────────────────────────────────────────────────
set local role authenticated;
select public.register_push_device('ExponentPushToken[abc123]', 'cliente', 'ios', 'iPhone');
do $$
begin
  perform public.register_push_device('token-falso', 'cliente', 'ios');
  raise exception 'FALHA: token inválido aceito';
exception when sqlstate 'P0001' then
  if sqlerrm like 'FALHA%' then raise; end if;
end $$;
do $$
begin
  if (select count(*) from public.push_devices) <> 1 then
    raise exception 'FALHA: cliente não vê só o próprio aparelho';
  end if;
end $$;
-- Ninguém escreve na caixa de saída direto.
do $$
begin
  insert into public.notification_outbox (user_id, channel, app, kind, title, body)
  values ('0d000000-0000-4000-8000-000000000003', 'push', 'cliente', 'fake_kind', 'x', 'y');
  raise exception 'FALHA: cliente escreveu na caixa de saída';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.notification_claim(array['push']::public.notification_channel[], 10);
  raise exception 'FALHA: cliente reivindicou lote';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ── despacho: claim devolve token; complete desliga token morto ─────────────
do $$
declare
  l_row record;
begin
  update public.notification_outbox set status = 'failed' where kind <> 'queue_called';
  select * into l_row from public.notification_claim(array['push']::public.notification_channel[], 10);
  if l_row.expo_tokens <> array['ExponentPushToken[abc123]'] then
    raise exception 'FALHA: claim não trouxe o token (%).', l_row.expo_tokens;
  end if;
  perform public.notification_complete(jsonb_build_array(jsonb_build_object(
    'id', l_row.id, 'outcome', 'retry', 'error', 'x',
    'disable_tokens', jsonb_build_array('ExponentPushToken[abc123]'))));
  if (select status from public.notification_outbox where id = l_row.id) <> 'pending'
    or (select disabled_at from public.push_devices where expo_token = 'ExponentPushToken[abc123]') is null
  then
    raise exception 'FALHA: complete não reagendou nem desligou o token';
  end if;
  -- Canal sem provedor: vai para unconfigured sem gastar tentativa.
  update public.notification_outbox set available_at = now() where id = l_row.id;
  perform public.notification_hold_unconfigured(array['push']::public.notification_channel[]);
  if (select status from public.notification_outbox where id = l_row.id) <> 'unconfigured' then
    raise exception 'FALHA: hold não marcou unconfigured';
  end if;
end $$;

-- ── convite da loja ─────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
do $$
begin
  perform public.establishment_invite_check('0a000000-0000-4000-8000-000000000001', 'novo@vez.local', 'staff');
  raise exception 'FALHA: equipe (staff) pôde convidar';
exception when insufficient_privilege then null;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
do $$
begin
  perform public.establishment_invite_check('0a000000-0000-4000-8000-000000000001', 'diego@vez.local', 'staff');
  raise exception 'FALHA: convidou quem já é da equipe';
exception when unique_violation then null;
end $$;
-- Conta existente (cliente@) vira equipe na hora e recebe aviso.
select public.establishment_add_member('0a000000-0000-4000-8000-000000000001', 'cliente@vez.local',
                                       'Cliente Teste', 'staff', null, false);
do $$
begin
  if not exists (select 1 from public.establishment_members
                 where user_id = '0d000000-0000-4000-8000-000000000003' and role = 'staff') then
    raise exception 'FALHA: vínculo não gravado';
  end if;
  if (select count(*) from public.establishment_invites('0a000000-0000-4000-8000-000000000001')) <> 1 then
    raise exception 'FALHA: convite não listado';
  end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.notification_outbox where kind = 'team_added' and channel = 'email') then
    raise exception 'FALHA: conta existente não recebeu aviso de vínculo';
  end if;
end $$;

-- ── anexos ──────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
create temp table t_ticket on commit drop as
  select id from public.open_support_ticket('Erro no app', 'Tela branca ao pagar.', 'technical', null);
grant select on t_ticket to authenticated;
select public.support_ticket_can_access((select id from t_ticket)) as cliente_ve_o_proprio;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
do $$
begin
  if public.support_ticket_can_access((select id from t_ticket)) then
    raise exception 'FALHA: outra conta enxerga o chamado do cliente';
  end if;
  perform public.attach_support_file((select id from t_ticket),
    (select id from t_ticket)::text || '/' || gen_random_uuid() || '.png', 'x.png');
  raise exception 'FALHA: outra conta anexou';
exception when sqlstate 'P0002' then null;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
do $$
begin
  perform public.attach_support_file((select id from t_ticket),
    (select id from t_ticket)::text || '/' || gen_random_uuid() || '.png', 'x.png');
  raise exception 'FALHA: anexou sem objeto no bucket';
exception when sqlstate 'P0002' then null;
end $$;
reset role;

-- Admin em aal1 não enxerga (MFA obrigatório); em aal2 enxerga.
update public.platform_settings set admin_mfa_required = true where id;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}', true);
do $$
begin
  if public.support_ticket_can_access((select id from t_ticket)) then
    raise exception 'FALHA: admin em aal1 enxergou anexo';
  end if;
end $$;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
do $$
begin
  if not public.support_ticket_can_access((select id from t_ticket)) then
    raise exception 'FALHA: admin em aal2 não enxergou';
  end if;
end $$;

-- ── MFA ─────────────────────────────────────────────────────────────────────
do $$
begin
  perform public.admin_mfa_reset_check('0d000000-0000-4000-8000-000000000004');
  raise exception 'FALHA: admin redefiniu o próprio fator';
exception when sqlstate 'P0001' then
  if sqlerrm like 'FALHA%' then raise; end if;
end $$;
select public.admin_mfa_reset_check('0d000000-0000-4000-8000-000000000001') is not null as admin_reset_ok;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
do $$
begin
  perform public.admin_mfa_reset_check('0d000000-0000-4000-8000-000000000001');
  raise exception 'FALHA: conta comum redefiniu fator';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.mfa_redeem_recovery_code('0d000000-0000-4000-8000-000000000003', 'AAAAA-AAAAA');
  raise exception 'FALHA: conta comum chamou o resgate direto';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Resgate: código certo vale uma vez; 5 erros seguram.
insert into public.mfa_recovery_codes (user_id, code_hash)
values ('0d000000-0000-4000-8000-000000000003', extensions.crypt('ABCDE-FGHJK', extensions.gen_salt('bf', 4)));
do $$
begin
  if not public.mfa_redeem_recovery_code('0d000000-0000-4000-8000-000000000003', 'abcde fghjk') then
    raise exception 'FALHA: código certo recusado';
  end if;
  if public.mfa_redeem_recovery_code('0d000000-0000-4000-8000-000000000003', 'ABCDE-FGHJK') then
    raise exception 'FALHA: código reaproveitado';
  end if;
  for i in 1..4 loop
    perform public.mfa_redeem_recovery_code('0d000000-0000-4000-8000-000000000003', 'ZZZZZ-ZZZZZ');
  end loop;
  begin
    perform public.mfa_redeem_recovery_code('0d000000-0000-4000-8000-000000000003', 'ZZZZZ-ZZZZZ');
    raise exception 'FALHA: sem freio de tentativas';
  exception when sqlstate 'P0001' then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
end $$;

select 'OK: todas as verificações passaram' as resultado;
rollback;
