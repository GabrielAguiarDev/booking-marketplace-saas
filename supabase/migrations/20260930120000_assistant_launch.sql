-- ---------------------------------------------------------------------------
-- Assistente: cota que não se contorna e histórico que se sustenta
-- ---------------------------------------------------------------------------
-- A cota contava linhas de `assistant_messages`. Dois defeitos saíam daí:
--
--   1. Apagar a conversa (permitido, e deve continuar sendo) apagava as
--      mensagens em cascata e devolvia as perguntas do dia.
--   2. A Edge Function contava, chamava o modelo e só então gravava: N pedidos
--      em paralelo passavam todos pela contagem.
--
-- O uso passa a morar numa tabela própria, e a reserva da pergunta é uma
-- única instrução atômica no Postgres, feita ANTES de chamar o modelo. Se o
-- modelo falhar, a reserva é devolvida — pergunta sem resposta não gasta cota.

create table public.assistant_usage_daily (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Dia no fuso do produto (ver `assistant_local_day`), não em UTC.
  usage_date date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

comment on table public.assistant_usage_daily is
  'Perguntas ao assistente por usuário e por dia. Independe das mensagens: apagar conversa não devolve cota.';

alter table public.assistant_usage_daily enable row level security;

create policy assistant_usage_daily_select_own
  on public.assistant_usage_daily for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Sem política de escrita, e sem o privilégio também: quem escreve são as
-- funções abaixo, chamadas pela Edge Function com a chave secreta.
revoke insert, update, delete, truncate on public.assistant_usage_daily from anon, authenticated;
revoke insert, update, truncate on public.assistant_messages from anon, authenticated;
revoke insert, update, truncate on public.assistant_conversations from anon, authenticated;

-- O limite em um lugar só. A Edge Function lê daqui; a tela, de
-- `assistant_usage_today()`.
create function public.assistant_day_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 20 $$;

-- O "hoje" do assistente é o do usuário, não o do servidor: em UTC a cota
-- virava às 21h de Brasília.
create function public.assistant_local_day()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Continuidade: o que já foi perguntado hoje continua contando.
insert into public.assistant_usage_daily (user_id, usage_date, used)
select m.user_id, public.assistant_local_day(), count(*)::integer
from public.assistant_messages m
where m.role = 'user'
  and (m.created_at at time zone 'America/Sao_Paulo')::date = public.assistant_local_day()
group by m.user_id;

create or replace function public.assistant_usage_today()
returns table (used integer, remaining integer, day_limit integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(u.used, 0) as used,
    greatest(public.assistant_day_limit() - coalesce(u.used, 0), 0) as remaining,
    public.assistant_day_limit() as day_limit
  from (select 1) one
  left join public.assistant_usage_daily u
    on u.user_id = (select auth.uid())
   and u.usage_date = public.assistant_local_day()
$$;

comment on function public.assistant_usage_today is
  'Cota diária do próprio usuário. O limite vem de assistant_day_limit(); o dia, de assistant_local_day().';

-- Custo observável: o que cada resposta consumiu.
alter table public.assistant_messages
  add column model text,
  add column prompt_tokens integer check (prompt_tokens >= 0),
  add column completion_tokens integer check (completion_tokens >= 0);

-- ---------------------------------------------------------------------------
-- Turno em duas etapas
-- ---------------------------------------------------------------------------
-- begin  reserva a cota, resolve a conversa e grava a pergunta
-- finish grava a resposta (em outra transação: `created_at` da resposta é
--        sempre posterior ao da pergunta, e a ordem do histórico é estável)
-- abort  desfaz a reserva quando o modelo não respondeu

create function public.assistant_begin_turn(
  p_user_id uuid,
  p_conversation_id uuid,
  p_message text
)
returns table (
  conversation_id uuid,
  message_id uuid,
  used integer,
  remaining integer,
  day_limit integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_message text := btrim(coalesce(p_message, ''));
  l_limit integer := public.assistant_day_limit();
  l_day date := public.assistant_local_day();
  l_used integer;
  l_conversation uuid;
  l_message_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Operacao interna.' using errcode = '42501', hint = 'forbidden';
  end if;
  if p_user_id is null or not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Conta nao encontrada.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if l_message = '' then
    raise exception 'Escreva sua pergunta.' using errcode = 'P0001', hint = 'empty_message';
  end if;
  if char_length(l_message) > 1000 then
    raise exception 'Pergunta muito longa.' using errcode = 'P0001', hint = 'message_too_long';
  end if;

  -- A reserva. `on conflict ... where` trava a linha do dia: dois pedidos
  -- simultâneos disputam a mesma linha e só um leva a última pergunta.
  insert into public.assistant_usage_daily as u (user_id, usage_date, used)
  values (p_user_id, l_day, 1)
  on conflict (user_id, usage_date) do update
    set used = u.used + 1, updated_at = now()
    where u.used < l_limit
  returning u.used into l_used;

  if l_used is null then
    raise exception 'Voce usou as % perguntas de hoje. Amanha tem mais.', l_limit
      using errcode = 'P0001', hint = 'daily_limit_reached';
  end if;

  -- Conversa de outra pessoa (ou apagada) não é erro: abre-se uma nova.
  select c.id into l_conversation
  from public.assistant_conversations c
  where c.id = p_conversation_id and c.user_id = p_user_id
  for update;

  if l_conversation is null then
    insert into public.assistant_conversations (user_id, title)
    values (p_user_id, left(l_message, 80))
    returning id into l_conversation;
  else
    update public.assistant_conversations set updated_at = now() where id = l_conversation;
  end if;

  -- `clock_timestamp()` e não o `now()` padrão da coluna: a ordem do histórico
  -- é `created_at`, e ela não pode depender de pergunta e resposta caírem em
  -- transações diferentes.
  insert into public.assistant_messages (conversation_id, user_id, role, content, created_at)
  values (l_conversation, p_user_id, 'user', l_message, clock_timestamp())
  returning id into l_message_id;

  return query select l_conversation, l_message_id, l_used, greatest(l_limit - l_used, 0), l_limit;
end;
$$;

create function public.assistant_finish_turn(
  p_user_id uuid,
  p_conversation_id uuid,
  p_reply text,
  p_cards jsonb default null,
  p_model text default null,
  p_prompt_tokens integer default null,
  p_completion_tokens integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Operacao interna.' using errcode = '42501', hint = 'forbidden';
  end if;
  -- A pessoa pode ter apagado a conversa enquanto o modelo respondia. Nesse
  -- caso não há onde gravar, e isso não é falha.
  if not exists (
    select 1 from public.assistant_conversations c
    where c.id = p_conversation_id and c.user_id = p_user_id
  ) then
    return null;
  end if;

  insert into public.assistant_messages (
    conversation_id, user_id, role, content, cards, model, prompt_tokens, completion_tokens,
    created_at
  ) values (
    p_conversation_id, p_user_id, 'assistant', coalesce(p_reply, ''),
    case when jsonb_typeof(p_cards) = 'array' and jsonb_array_length(p_cards) > 0 then p_cards end,
    nullif(left(btrim(coalesce(p_model, '')), 120), ''),
    p_prompt_tokens, p_completion_tokens, clock_timestamp()
  ) returning id into l_id;

  update public.assistant_conversations set updated_at = now() where id = p_conversation_id;
  return l_id;
end;
$$;

create function public.assistant_abort_turn(p_user_id uuid, p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_conversation uuid;
  l_day date;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Operacao interna.' using errcode = '42501', hint = 'forbidden';
  end if;

  delete from public.assistant_messages m
  where m.id = p_message_id and m.user_id = p_user_id and m.role = 'user'
  returning m.conversation_id, (m.created_at at time zone 'America/Sao_Paulo')::date
    into l_conversation, l_day;

  -- Idempotente: sem pergunta para desfazer, nada é devolvido. Sem isto,
  -- repetir o abort devolveria cota que não foi reservada.
  if l_conversation is null then
    return false;
  end if;

  update public.assistant_usage_daily u
  set used = greatest(u.used - 1, 0), updated_at = now()
  where u.user_id = p_user_id and u.usage_date = l_day;

  -- Conversa aberta só para esta pergunta não deve sobrar vazia na lista.
  delete from public.assistant_conversations c
  where c.id = l_conversation
    and not exists (select 1 from public.assistant_messages m where m.conversation_id = c.id);

  return true;
end;
$$;

revoke execute on function public.assistant_day_limit() from public, anon;
grant execute on function public.assistant_day_limit() to authenticated, service_role;
revoke execute on function public.assistant_local_day() from public, anon;
grant execute on function public.assistant_local_day() to authenticated, service_role;
revoke execute on function public.assistant_usage_today() from public, anon;
grant execute on function public.assistant_usage_today() to authenticated, service_role;

-- As três recebem o usuário por parâmetro: expostas a `authenticated`, qualquer
-- conta gastaria a cota de outra ou escreveria no histórico alheio.
revoke execute on function public.assistant_begin_turn(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.assistant_begin_turn(uuid, uuid, text) to service_role;
revoke execute on function public.assistant_finish_turn(uuid, uuid, text, jsonb, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.assistant_finish_turn(uuid, uuid, text, jsonb, text, integer, integer)
  to service_role;
revoke execute on function public.assistant_abort_turn(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assistant_abort_turn(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- LGPD: a exclusão de conta leva também o registro de uso
-- ---------------------------------------------------------------------------
-- Mesmo corpo da versão de `20260918190000_launch_security_gate.sql`, com uma
-- linha a mais.

create or replace function public.customer_delete_account(p_user_id uuid)
returns table (cancelled_appointments integer, anonymized_reviews integer)
language plpgsql security definer set search_path = '' as $$
declare l_cancelled integer := 0; l_reviews integer := 0;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Operacao interna.' using errcode = '42501'; end if;
  if p_user_id is null or not exists (select 1 from public.profiles p where p.id = p_user_id) then raise exception 'Conta nao encontrada.' using errcode = 'P0002', hint = 'not_found'; end if;
  if exists (select 1 from public.establishment_members m where m.user_id = p_user_id) then raise exception 'Sua conta administra uma loja. Transfira a loja antes, pelo suporte.' using errcode = 'P0001', hint = 'has_establishment'; end if;
  if exists (select 1 from public.platform_admins a where a.user_id = p_user_id) then raise exception 'Conta da equipe da plataforma nao e excluida pelo app.' using errcode = 'P0001', hint = 'platform_staff'; end if;
  update public.appointments set status = 'cancelled_by_customer', cancelled_at = now(), cancellation_reason = 'Conta excluida pelo cliente'
    where customer_id = p_user_id and status in ('scheduled', 'confirmed') and starts_at > now();
  get diagnostics l_cancelled = row_count;
  update public.queue_entries set status = 'left', finished_at = now()
    where customer_id = p_user_id and status in ('waiting', 'called');
  update public.reviews set comment = null where customer_id = p_user_id and comment is not null;
  get diagnostics l_reviews = row_count;
  delete from public.customer_addresses where customer_id = p_user_id;
  delete from public.customer_favorites where customer_id = p_user_id;
  delete from public.customer_notification_prefs where customer_id = p_user_id;
  delete from public.assistant_messages where user_id = p_user_id;
  delete from public.assistant_conversations where user_id = p_user_id;
  delete from public.assistant_usage_daily where user_id = p_user_id;
  delete from public.notification_outbox where user_id = p_user_id;
  delete from public.push_devices where user_id = p_user_id;
  update public.profiles set full_name = null, phone = null, avatar_url = null where id = p_user_id;
  update auth.users set raw_user_meta_data = '{}'::jsonb where id = p_user_id;
  insert into public.account_deletions (user_id, cancelled_appointments, anonymized_reviews)
  values (p_user_id, l_cancelled, l_reviews)
  on conflict (user_id) do update set requested_at = now(),
    cancelled_appointments = public.account_deletions.cancelled_appointments + excluded.cancelled_appointments,
    anonymized_reviews = public.account_deletions.anonymized_reviews + excluded.anonymized_reviews;
  return query select l_cancelled, l_reviews;
end;
$$;
