-- ---------------------------------------------------------------------------
-- Assistente: conversas e limite de uso
-- ---------------------------------------------------------------------------
-- O assistente conversa com um modelo da OpenAI. Duas coisas moram no banco:
-- o histórico (sem ele cada pergunta começa do zero e o modelo não entende
-- "e amanhã?") e a contagem de uso, que é o que impede uma conta gratuita de
-- virar uma fatura.

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Primeira pergunta, encurtada. Serve para listar conversas sem carregar tudo.
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assistant_conversations_user_idx
  on public.assistant_conversations (user_id, updated_at desc);

create trigger assistant_conversations_set_updated_at
  before update on public.assistant_conversations
  for each row execute function public.set_updated_at();

create type public.assistant_role as enum ('user', 'assistant');

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.assistant_conversations (id) on delete cascade,
  -- Desnormalizado de propósito: a política de RLS e a contagem diária de uso
  -- precisam do dono da mensagem sem passar por join a cada leitura.
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.assistant_role not null,
  content text not null,
  -- Lojas e horários que a resposta produziu, para o app desenhar cartões
  -- nativos em vez de despejar uma lista dentro de um balão de texto.
  cards jsonb,
  created_at timestamptz not null default now()
);

create index assistant_messages_conversation_idx
  on public.assistant_messages (conversation_id, created_at);

-- Índice da contagem diária. Parcial porque só mensagens do usuário contam:
-- a resposta do modelo não é cota dele.
create index assistant_messages_daily_idx
  on public.assistant_messages (user_id, created_at)
  where role = 'user';

-- ---------------------------------------------------------------------------
-- Cota
-- ---------------------------------------------------------------------------
-- Quem cobra é a OpenAI, e numa conta de testes o crédito acaba sem aviso. O
-- limite existe para o app degradar com uma frase clara em vez de um erro 429
-- traduzido do inglês no meio de uma conversa.

create function public.assistant_usage_today()
returns table (used integer, remaining integer, day_limit integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::integer as used,
    greatest(20 - count(*), 0)::integer as remaining,
    20 as day_limit
  from public.assistant_messages m
  where m.user_id = (select auth.uid())
    and m.role = 'user'
    and m.created_at >= date_trunc('day', now())
$$;

comment on function public.assistant_usage_today is
  'Cota diária por usuário. O número 20 está aqui e na Edge Function; mudar num lugar só faz a tela mentir.';

revoke execute on function public.assistant_usage_today() from public;
grant execute on function public.assistant_usage_today() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

create policy assistant_conversations_select_own
  on public.assistant_conversations for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Apagar a própria conversa, sim. É histórico de perguntas pessoais, e quem
-- não pode apagar o que perguntou pensa duas vezes antes de perguntar.
create policy assistant_conversations_delete_own
  on public.assistant_conversations for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy assistant_messages_select_own
  on public.assistant_messages for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Sem política de INSERT em nenhuma das duas, de propósito: quem escreve é a
-- Edge Function. Se o cliente pudesse inserir em `assistant_messages`, ele
-- poderia gravar respostas que o modelo nunca deu — e a cota seria contornável
-- inserindo direto na conversa sem passar pela função que chama a OpenAI.
