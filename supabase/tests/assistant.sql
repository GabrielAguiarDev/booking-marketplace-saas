\set ON_ERROR_STOP on

-- Matriz comportamental do assistente: cota, histórico e alcance das
-- ferramentas. Requer `db:demo` (contas e lojas). Roda em transação e termina
-- em rollback; nenhuma chamada à OpenAI acontece aqui.
--
--   cliente  0d000000-0000-4000-8000-000000000003
--   dono     0d000000-0000-4000-8000-000000000001
begin;

-- Parte do zero, qualquer que seja o estado do banco local.
delete from public.assistant_conversations
  where user_id in ('0d000000-0000-4000-8000-000000000003', '0d000000-0000-4000-8000-000000000001');
delete from public.assistant_usage_daily
  where user_id in ('0d000000-0000-4000-8000-000000000003', '0d000000-0000-4000-8000-000000000001');

create temporary table t_state (key text primary key, value uuid) on commit drop;
grant all on t_state to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. O cliente não escreve cota nem histórico por conta própria
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","email":"cliente@vez.local"}', true);

do $$
begin
  begin
    perform public.assistant_begin_turn(auth.uid(), null, 'oi');
    raise exception 'assistente: cliente executou assistant_begin_turn';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.assistant_abort_turn(auth.uid(), gen_random_uuid());
    raise exception 'assistente: cliente executou assistant_abort_turn';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.assistant_finish_turn(auth.uid(), gen_random_uuid(), 'resposta forjada');
    raise exception 'assistente: cliente executou assistant_finish_turn';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.assistant_usage_daily (user_id, usage_date, used)
    values (auth.uid(), public.assistant_local_day(), 0);
    raise exception 'assistente: cliente escreveu no registro de uso';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.assistant_conversations (user_id, title) values (auth.uid(), 'forjada');
    raise exception 'assistente: cliente criou conversa direto na tabela';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Um turno completo: pergunta, resposta, ordem e contagem
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  l_turn record;
  l_reply uuid;
  l_roles text;
begin
  select * into l_turn from public.assistant_begin_turn(
    '0d000000-0000-4000-8000-000000000003', null, '  tem corte hoje à tarde?  ');
  if l_turn.used <> 1 or l_turn.remaining <> 19 or l_turn.day_limit <> 20 then
    raise exception 'assistente: primeira pergunta devolveu cota % / % / %',
      l_turn.used, l_turn.remaining, l_turn.day_limit;
  end if;
  insert into t_state values ('conversation', l_turn.conversation_id);

  l_reply := public.assistant_finish_turn(
    '0d000000-0000-4000-8000-000000000003', l_turn.conversation_id, 'Achei uma barbearia perto de você.',
    '[{"kind":"establishment","id":"0a000000-0000-4000-8000-000000000001","name":"Barbearia"}]'::jsonb,
    'gpt-4o-mini', 420, 37);
  if l_reply is null then raise exception 'assistente: resposta não foi gravada'; end if;

  -- Segunda pergunta na mesma conversa.
  select * into l_turn from public.assistant_begin_turn(
    '0d000000-0000-4000-8000-000000000003', l_turn.conversation_id, 'e amanhã?');
  if l_turn.conversation_id <> (select value from t_state where key = 'conversation') then
    raise exception 'assistente: conversa própria não foi continuada';
  end if;
  if l_turn.used <> 2 then raise exception 'assistente: segunda pergunta não contou'; end if;
  insert into t_state values ('pending_message', l_turn.message_id);

  -- A ordem do histórico é a do `created_at`, mesmo dentro de uma transação só.
  select string_agg(m.role::text, ',' order by m.created_at) into l_roles
  from public.assistant_messages m where m.conversation_id = l_turn.conversation_id;
  if l_roles <> 'user,assistant,user' then
    raise exception 'assistente: histórico fora de ordem (%)', l_roles;
  end if;

  if not exists (
    select 1 from public.assistant_messages m
    where m.id = l_reply and m.model = 'gpt-4o-mini' and m.prompt_tokens = 420
      and m.completion_tokens = 37 and jsonb_array_length(m.cards) = 1
  ) then
    raise exception 'assistente: cartões ou consumo da resposta não foram gravados';
  end if;
  if (select title from public.assistant_conversations where id = l_turn.conversation_id)
      <> 'tem corte hoje à tarde?' then
    raise exception 'assistente: título da conversa não é a primeira pergunta aparada';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Modelo falhou: a reserva volta, uma vez só
-- ---------------------------------------------------------------------------
do $$
declare
  l_message uuid := (select value from t_state where key = 'pending_message');
  l_used integer;
begin
  if not public.assistant_abort_turn('0d000000-0000-4000-8000-000000000003', l_message) then
    raise exception 'assistente: abort não desfez a pergunta';
  end if;
  if public.assistant_abort_turn('0d000000-0000-4000-8000-000000000003', l_message) then
    raise exception 'assistente: abort repetido devolveu cota de novo';
  end if;
  -- Abort com o usuário errado não mexe em nada.
  if public.assistant_abort_turn('0d000000-0000-4000-8000-000000000001', l_message) then
    raise exception 'assistente: abort de outra conta foi aceito';
  end if;
  select u.used into l_used from public.assistant_usage_daily u
  where u.user_id = '0d000000-0000-4000-8000-000000000003' and u.usage_date = public.assistant_local_day();
  if l_used <> 1 then raise exception 'assistente: cota após abort deveria ser 1, é %', l_used; end if;
  if exists (select 1 from public.assistant_messages m where m.id = l_message) then
    raise exception 'assistente: pergunta sem resposta ficou no histórico';
  end if;
  -- A conversa tinha um turno completo e continua existindo.
  if not exists (select 1 from public.assistant_conversations c
    where c.id = (select value from t_state where key = 'conversation')) then
    raise exception 'assistente: abort apagou conversa com histórico';
  end if;
end $$;

-- Conversa aberta só para a pergunta que falhou não sobra vazia.
do $$
declare l_turn record;
begin
  select * into l_turn from public.assistant_begin_turn(
    '0d000000-0000-4000-8000-000000000003', null, 'pergunta que vai falhar');
  perform public.assistant_abort_turn('0d000000-0000-4000-8000-000000000003', l_turn.message_id);
  if exists (select 1 from public.assistant_conversations c where c.id = l_turn.conversation_id) then
    raise exception 'assistente: conversa vazia sobrou depois do abort';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Limite diário: a 20ª passa, a 21ª não, e nada é gravado na recusa
-- ---------------------------------------------------------------------------
reset role;
update public.assistant_usage_daily set used = 19
where user_id = '0d000000-0000-4000-8000-000000000003' and usage_date = public.assistant_local_day();

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  l_turn record;
  l_before integer;
  l_hint text;
begin
  select * into l_turn from public.assistant_begin_turn(
    '0d000000-0000-4000-8000-000000000003', (select value from t_state where key = 'conversation'), 'última de hoje');
  if l_turn.used <> 20 or l_turn.remaining <> 0 then
    raise exception 'assistente: vigésima pergunta devolveu % / %', l_turn.used, l_turn.remaining;
  end if;

  select count(*) into l_before from public.assistant_messages
  where user_id = '0d000000-0000-4000-8000-000000000003';
  begin
    perform public.assistant_begin_turn('0d000000-0000-4000-8000-000000000003', null, 'uma a mais');
    raise exception 'assistente: 21ª pergunta foi aceita';
  exception when raise_exception then
    get stacked diagnostics l_hint = pg_exception_hint;
    if l_hint is distinct from 'daily_limit_reached' then raise; end if;
  end;
  if (select count(*) from public.assistant_messages
      where user_id = '0d000000-0000-4000-8000-000000000003') <> l_before then
    raise exception 'assistente: pergunta recusada pela cota foi gravada';
  end if;
  if (select used from public.assistant_usage_daily
      where user_id = '0d000000-0000-4000-8000-000000000003'
        and usage_date = public.assistant_local_day()) <> 20 then
    raise exception 'assistente: recusa alterou o registro de uso';
  end if;

  -- Entrada inválida é recusada antes de reservar cota.
  begin
    perform public.assistant_begin_turn('0d000000-0000-4000-8000-000000000001', null, '   ');
    raise exception 'assistente: pergunta vazia foi aceita';
  exception when raise_exception then
    get stacked diagnostics l_hint = pg_exception_hint;
    if l_hint is distinct from 'empty_message' then raise; end if;
  end;
  begin
    perform public.assistant_begin_turn('0d000000-0000-4000-8000-000000000001', null, repeat('a', 1001));
    raise exception 'assistente: pergunta longa demais foi aceita';
  exception when raise_exception then
    get stacked diagnostics l_hint = pg_exception_hint;
    if l_hint is distinct from 'message_too_long' then raise; end if;
  end;
  if exists (select 1 from public.assistant_usage_daily
    where user_id = '0d000000-0000-4000-8000-000000000001') then
    raise exception 'assistente: entrada inválida consumiu cota';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Conversa de outra pessoa não é continuada nem lida
-- ---------------------------------------------------------------------------
do $$
declare l_turn record;
begin
  select * into l_turn from public.assistant_begin_turn(
    '0d000000-0000-4000-8000-000000000001', (select value from t_state where key = 'conversation'),
    'pergunta do dono');
  if l_turn.conversation_id = (select value from t_state where key = 'conversation') then
    raise exception 'assistente: conversa alheia foi continuada';
  end if;
  insert into t_state values ('owner_conversation', l_turn.conversation_id);
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated","email":"rafael@vez.local"}', true);

do $$
declare l_deleted integer;
begin
  if exists (select 1 from public.assistant_messages
    where user_id = '0d000000-0000-4000-8000-000000000003') then
    raise exception 'assistente: outra conta leu mensagens do cliente';
  end if;
  if (select count(*) from public.assistant_conversations) <> 1 then
    raise exception 'assistente: outra conta enxerga conversas que não são dela';
  end if;
  if exists (select 1 from public.assistant_usage_daily
    where user_id = '0d000000-0000-4000-8000-000000000003') then
    raise exception 'assistente: outra conta leu o uso do cliente';
  end if;
  delete from public.assistant_conversations
  where id = (select value from t_state where key = 'conversation');
  get diagnostics l_deleted = row_count;
  if l_deleted <> 0 then raise exception 'assistente: outra conta apagou a conversa do cliente'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. O contrato do histórico para a tela, e apagar não devolve cota
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","email":"cliente@vez.local"}', true);

do $$
declare
  l_conversation uuid := (select value from t_state where key = 'conversation');
  l_usage record;
  l_deleted integer;
begin
  -- Lista de conversas e mensagens, como o app lê.
  if (select count(*) from public.assistant_conversations) <> 1 then
    raise exception 'assistente: cliente não lista a própria conversa';
  end if;
  if (select count(*) from public.assistant_messages where conversation_id = l_conversation) <> 3 then
    raise exception 'assistente: cliente não lê as próprias mensagens';
  end if;

  select * into l_usage from public.assistant_usage_today();
  if l_usage.used <> 20 or l_usage.remaining <> 0 or l_usage.day_limit <> 20 then
    raise exception 'assistente: assistant_usage_today devolveu % / % / %',
      l_usage.used, l_usage.remaining, l_usage.day_limit;
  end if;

  -- Não reescreve o que o modelo disse.
  begin
    update public.assistant_messages set content = 'adulterada' where conversation_id = l_conversation;
    raise exception 'assistente: cliente editou mensagem do histórico';
  exception when insufficient_privilege then null;
  end;

  -- Apaga a conversa (direito dele) e as mensagens vão junto…
  delete from public.assistant_conversations where id = l_conversation;
  get diagnostics l_deleted = row_count;
  if l_deleted <> 1 then raise exception 'assistente: cliente não conseguiu apagar a própria conversa'; end if;
  if exists (select 1 from public.assistant_messages where conversation_id = l_conversation) then
    raise exception 'assistente: mensagens sobraram depois de apagar a conversa';
  end if;

  -- …mas a cota do dia continua gasta.
  select * into l_usage from public.assistant_usage_today();
  if l_usage.used <> 20 or l_usage.remaining <> 0 then
    raise exception 'assistente: apagar a conversa devolveu cota (% usadas)', l_usage.used;
  end if;
end $$;

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare l_hint text;
begin
  begin
    perform public.assistant_begin_turn('0d000000-0000-4000-8000-000000000003', null, 'depois de apagar');
    raise exception 'assistente: apagar o histórico reabriu a cota';
  exception when raise_exception then
    get stacked diagnostics l_hint = pg_exception_hint;
    if l_hint is distinct from 'daily_limit_reached' then raise; end if;
  end;
  -- Resposta que chega depois de a conversa ter sido apagada não é erro.
  if public.assistant_finish_turn('0d000000-0000-4000-8000-000000000003',
      (select value from t_state where key = 'conversation'), 'tarde demais') is not null then
    raise exception 'assistente: resposta foi gravada em conversa apagada';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. A cota vira no dia de Brasília, não no de UTC
-- ---------------------------------------------------------------------------
reset role;
do $$
begin
  if public.assistant_local_day() <> (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'assistente: o dia da cota não é o de America/Sao_Paulo';
  end if;
end $$;

-- O uso de ontem não conta hoje.
update public.assistant_usage_daily set usage_date = usage_date - 1
where user_id = '0d000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","email":"cliente@vez.local"}', true);
do $$
begin
  if (select remaining from public.assistant_usage_today()) <> 20 then
    raise exception 'assistente: uso de ontem descontou da cota de hoje';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8. As ferramentas rodam com a RLS do usuário: loja fora do ar não aparece
-- ---------------------------------------------------------------------------
reset role;
update public.establishments set status = 'suspended', status_reason = 'teste'
where id = '0a000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","email":"cliente@vez.local"}', true);
do $$
begin
  if exists (select 1 from public.establishments where id = '0a000000-0000-4000-8000-000000000002') then
    raise exception 'assistente: loja suspensa aparece na busca do usuário';
  end if;
  if exists (select 1 from public.services where establishment_id = '0a000000-0000-4000-8000-000000000002') then
    raise exception 'assistente: serviços de loja suspensa aparecem para o usuário';
  end if;
  if exists (select 1 from public.available_slots(
      '0a000000-0000-4000-8000-000000000002', '0b000000-0000-4000-8000-000000000011',
      (now() at time zone 'America/Sao_Paulo')::date + 1)) then
    raise exception 'assistente: loja suspensa devolveu horário';
  end if;
  -- A loja ativa continua visível pelo mesmo caminho.
  if not exists (select 1 from public.services
    where establishment_id = '0a000000-0000-4000-8000-000000000001' and is_active) then
    raise exception 'assistente: serviços de loja ativa não aparecem para o usuário';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Exclusão de conta (LGPD) leva histórico e registro de uso
-- ---------------------------------------------------------------------------
reset role;
delete from public.establishment_members where user_id = '0d000000-0000-4000-8000-000000000003';
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.assistant_begin_turn('0d000000-0000-4000-8000-000000000003', null, 'antes de excluir');
select public.customer_delete_account('0d000000-0000-4000-8000-000000000003');
reset role;
do $$
begin
  if exists (select 1 from public.assistant_usage_daily where user_id = '0d000000-0000-4000-8000-000000000003')
    or exists (select 1 from public.assistant_messages where user_id = '0d000000-0000-4000-8000-000000000003')
    or exists (select 1 from public.assistant_conversations where user_id = '0d000000-0000-4000-8000-000000000003')
  then
    raise exception 'assistente: exclusão de conta deixou dado do assistente';
  end if;
end $$;

rollback;
\echo 'assistant: OK'
