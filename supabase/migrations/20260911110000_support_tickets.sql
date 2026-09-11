-- Suporte: chamados abertos por uma loja ou por um cliente e atendidos pela
-- equipe da plataforma.
--
-- Quem abre é sempre uma conta autenticada. A loja abre em nome dela (qualquer
-- membro), e todos os membros acompanham a conversa; o cliente abre em nome
-- próprio e pode citar a loja de que está falando, sem que a loja veja. A
-- equipe atende pelo painel admin, com os papéis `support` e `operations`
-- (`admin` passa sempre).
--
-- Ninguém escreve direto nas tabelas: abrir e responder são RPCs públicas
-- (`open_support_ticket`, `reply_support_ticket`) e o atendimento são RPCs
-- `admin_*`, auditadas na mesma transação.

create type public.support_ticket_category as enum (
  'account',
  'billing',
  'booking',
  'payment',
  'technical',
  'other'
);

-- A ordem importa: `order by priority desc` põe a alta em cima.
create type public.support_ticket_priority as enum ('low', 'normal', 'high');

create type public.support_ticket_status as enum ('open', 'waiting_customer', 'resolved');

create type public.support_requester_kind as enum ('establishment', 'customer');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  -- Número curto para falar ao telefone e citar em auditoria: "chamado #4417".
  number integer generated always as identity (start with 4401),
  requester_kind public.support_requester_kind not null,
  requester_id uuid references public.profiles (id) on delete set null,
  requester_name text not null,
  -- Loja que abriu (requester_kind = 'establishment') ou de que o cliente fala.
  establishment_id uuid references public.establishments (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 120),
  category public.support_ticket_category not null default 'other',
  priority public.support_ticket_priority not null default 'normal',
  status public.support_ticket_status not null default 'open',
  assigned_to uuid references public.platform_admins (user_id) on delete set null,
  -- Desde quando o chamado espera quem está com a vez: a equipe, se aberto; a
  -- pessoa, se aguardando cliente. A fila ordena por aqui.
  waiting_since timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_from_staff boolean not null default false,
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_number_key unique (number)
);

comment on table public.support_tickets is
  'Chamados de suporte. Escrita só pelas RPCs open/reply_support_ticket e admin_*.';

create index support_tickets_queue_idx
  on public.support_tickets (status, priority desc, waiting_since);
create index support_tickets_establishment_idx on public.support_tickets (establishment_id);
create index support_tickets_requester_idx on public.support_tickets (requester_id);
create index support_tickets_assigned_idx on public.support_tickets (assigned_to);

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  -- Nome no momento da mensagem: a conversa não muda se a pessoa sair da equipe.
  author_name text not null,
  from_staff boolean not null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at);
create index support_ticket_messages_author_idx on public.support_ticket_messages (author_id);

-- ---------------------------------------------------------------------------
-- Leitura (RLS)
-- ---------------------------------------------------------------------------

-- Quem da equipe atende chamado. Financeiro fica de fora: a conversa pode ter
-- dado pessoal, e o papel dele não precisa dela.
create function public.is_support_agent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
      and pa.role in ('admin', 'operations', 'support')
  );
$$;

revoke execute on function public.is_support_agent() from public, anon;
grant execute on function public.is_support_agent() to authenticated, service_role;

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

create policy support_tickets_select_requester
  on public.support_tickets for select
  to authenticated
  using (requester_id = (select auth.uid()));

-- Chamado da loja é da loja: qualquer membro acompanha. Chamado de cliente que
-- só cita a loja não aparece para ela.
create policy support_tickets_select_member
  on public.support_tickets for select
  to authenticated
  using (
    requester_kind = 'establishment'
    and public.is_establishment_member(establishment_id)
  );

create policy support_tickets_select_agent
  on public.support_tickets for select
  to authenticated
  using (public.is_support_agent());

-- A mensagem segue o chamado: quem lê o chamado lê a conversa.
create policy support_ticket_messages_select_visible
  on public.support_ticket_messages for select
  to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id));

-- ---------------------------------------------------------------------------
-- Rótulos para auditoria (lida por gente, em português)
-- ---------------------------------------------------------------------------

create function public.support_status_label(p_status public.support_ticket_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'open' then 'aberto'
    when 'waiting_customer' then 'aguardando cliente'
    when 'resolved' then 'resolvido'
  end;
$$;

create function public.support_priority_label(p_priority public.support_ticket_priority)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_priority
    when 'low' then 'baixa'
    when 'normal' then 'normal'
    when 'high' then 'alta'
  end;
$$;

revoke execute on function public.support_status_label(public.support_ticket_status)
  from public, anon, authenticated, service_role;
revoke execute on function public.support_priority_label(public.support_ticket_priority)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Lado de quem abre: portal da loja e app do cliente
-- ---------------------------------------------------------------------------

-- Abre o chamado com a primeira mensagem. Com `p_establishment_id` de uma loja
-- da qual a pessoa é membro, o chamado é da loja; de outra loja, é um chamado
-- de cliente que fala daquela loja.
create function public.open_support_ticket(
  p_subject text,
  p_body text,
  p_category public.support_ticket_category default 'other',
  p_establishment_id uuid default null
)
returns table (id uuid, number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_subject text := btrim(coalesce(p_subject, ''));
  l_body text := btrim(coalesce(p_body, ''));
  l_kind public.support_requester_kind;
  l_name text;
  l_ticket public.support_tickets;
begin
  if l_uid is null then
    raise exception 'Entre na sua conta para abrir um chamado.' using errcode = '42501';
  end if;
  if char_length(l_subject) < 3 then
    raise exception 'Descreva o assunto em poucas palavras.' using errcode = 'P0001';
  end if;
  if char_length(l_subject) > 120 then
    raise exception 'O assunto vai até 120 caracteres.' using errcode = 'P0001';
  end if;
  if l_body = '' then
    raise exception 'Conte o que aconteceu.' using errcode = 'P0001';
  end if;
  if char_length(l_body) > 4000 then
    raise exception 'A mensagem vai até 4.000 caracteres.' using errcode = 'P0001';
  end if;

  if p_establishment_id is null then
    l_kind := 'customer';
  elsif public.is_establishment_member(p_establishment_id) then
    l_kind := 'establishment';
  elsif exists (select 1 from public.establishments e where e.id = p_establishment_id) then
    l_kind := 'customer';
  else
    raise exception 'Estabelecimento não encontrado.' using errcode = 'P0002';
  end if;

  -- Freio contra abrir o mesmo pedido várias vezes.
  if (
    select count(*) from public.support_tickets t
    where t.requester_id = l_uid and t.status <> 'resolved'
  ) >= 5 then
    raise exception 'Você já tem 5 chamados em andamento. Continue por um deles.' using errcode = 'P0001';
  end if;

  select coalesce(nullif(p.full_name, ''), u.email::text, 'Usuário')
  into l_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = l_uid;

  insert into public.support_tickets (
    requester_kind, requester_id, requester_name, establishment_id, subject, category
  ) values (
    l_kind, l_uid, coalesce(l_name, 'Usuário'), p_establishment_id, l_subject,
    coalesce(p_category, 'other')
  )
  returning * into l_ticket;

  insert into public.support_ticket_messages (ticket_id, author_id, author_name, from_staff, body)
  values (l_ticket.id, l_uid, l_ticket.requester_name, false, l_body);

  return query select l_ticket.id, l_ticket.number;
end;
$$;

-- Responde pelo lado de quem abriu. Responder chamado resolvido ou aguardando
-- a pessoa devolve a vez à equipe.
create function public.reply_support_ticket(p_ticket_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_body text := btrim(coalesce(p_body, ''));
  l_ticket public.support_tickets;
  l_name text;
begin
  if l_uid is null then
    raise exception 'Entre na sua conta para responder.' using errcode = '42501';
  end if;

  select * into l_ticket from public.support_tickets t where t.id = p_ticket_id for update;
  if not found or not (
    l_ticket.requester_id = l_uid
    or (
      l_ticket.requester_kind = 'establishment'
      and public.is_establishment_member(l_ticket.establishment_id)
    )
  ) then
    raise exception 'Chamado não encontrado.' using errcode = 'P0002';
  end if;
  if l_body = '' then
    raise exception 'Escreva a mensagem.' using errcode = 'P0001';
  end if;
  if char_length(l_body) > 4000 then
    raise exception 'A mensagem vai até 4.000 caracteres.' using errcode = 'P0001';
  end if;

  select coalesce(nullif(p.full_name, ''), u.email::text, 'Usuário')
  into l_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = l_uid;

  insert into public.support_ticket_messages (ticket_id, author_id, author_name, from_staff, body)
  values (l_ticket.id, l_uid, coalesce(l_name, 'Usuário'), false, l_body);

  update public.support_tickets t
  set status = 'open',
      -- Quem já esperava a equipe continua contando do começo da espera.
      waiting_since = case
        when t.status = 'open' and not t.last_message_from_staff then t.waiting_since
        else now()
      end,
      resolved_at = null,
      last_message_at = now(),
      last_message_from_staff = false
  where t.id = l_ticket.id;
end;
$$;

revoke execute on function public.open_support_ticket(text, text, public.support_ticket_category, uuid)
  from public, anon;
grant execute on function public.open_support_ticket(text, text, public.support_ticket_category, uuid)
  to authenticated, service_role;
revoke execute on function public.reply_support_ticket(uuid, text) from public, anon;
grant execute on function public.reply_support_ticket(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Painel admin: leitura
-- ---------------------------------------------------------------------------

-- A fila: tudo o que não foi resolvido e o que foi resolvido nos últimos 90
-- dias (a ficha da loja mostra esse histórico). Aberto primeiro, depois
-- aguardando cliente, por prioridade e pelo tempo de espera.
create function public.admin_support_tickets()
returns table (
  id uuid,
  number integer,
  requester_kind public.support_requester_kind,
  requester_id uuid,
  requester_name text,
  requester_email text,
  establishment_id uuid,
  establishment text,
  subject text,
  category public.support_ticket_category,
  priority public.support_ticket_priority,
  status public.support_ticket_status,
  assigned_to uuid,
  assignee text,
  waiting_since timestamptz,
  last_message_at timestamptz,
  last_message_from_staff boolean,
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz,
  messages integer,
  preview text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require(array['support', 'operations']::public.platform_role[]);
  return query
    select
      t.id,
      t.number,
      t.requester_kind,
      t.requester_id,
      t.requester_name,
      coalesce(ru.email::text, ''),
      t.establishment_id,
      e.name,
      t.subject,
      t.category,
      t.priority,
      t.status,
      t.assigned_to,
      coalesce(nullif(ap.full_name, ''), au.email::text),
      t.waiting_since,
      t.last_message_at,
      t.last_message_from_staff,
      t.first_response_at,
      t.resolved_at,
      t.created_at,
      (select count(*)::integer from public.support_ticket_messages m where m.ticket_id = t.id),
      coalesce(
        (
          select left(m.body, 160)
          from public.support_ticket_messages m
          where m.ticket_id = t.id
          order by m.created_at desc
          limit 1
        ),
        ''
      )
    from public.support_tickets t
    left join public.establishments e on e.id = t.establishment_id
    left join auth.users ru on ru.id = t.requester_id
    left join public.profiles ap on ap.id = t.assigned_to
    left join auth.users au on au.id = t.assigned_to
    where t.status <> 'resolved' or t.resolved_at >= now() - interval '90 days'
    order by
      t.status = 'resolved',
      t.status = 'waiting_customer',
      t.priority desc,
      t.waiting_since;
end;
$$;

create function public.admin_support_ticket_messages(p_ticket_id uuid)
returns table (
  id uuid,
  author_name text,
  from_staff boolean,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require(array['support', 'operations']::public.platform_role[]);
  if not exists (select 1 from public.support_tickets t where t.id = p_ticket_id) then
    raise exception 'Chamado não encontrado.' using errcode = 'P0002';
  end if;
  return query
    select m.id, m.author_name, m.from_staff, m.body, m.created_at
    from public.support_ticket_messages m
    where m.ticket_id = p_ticket_id
    order by m.created_at, m.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Painel admin: atendimento
-- ---------------------------------------------------------------------------

-- Responde e já define a situação que o chamado assume: aguardando cliente (o
-- normal), resolvido, ou aberto (a equipe ainda deve algo). Quem responde um
-- chamado sem dono passa a ser o dono.
create function public.admin_reply_ticket(
  p_ticket_id uuid,
  p_body text,
  p_status public.support_ticket_status default 'waiting_customer'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_body text := btrim(coalesce(p_body, ''));
  l_status public.support_ticket_status := coalesce(p_status, 'waiting_customer');
  l_ticket public.support_tickets;
  l_name text;
begin
  perform public.admin_require(array['support', 'operations']::public.platform_role[]);
  if l_body = '' then
    raise exception 'Escreva a resposta.' using errcode = 'P0001';
  end if;
  if char_length(l_body) > 4000 then
    raise exception 'A resposta vai até 4.000 caracteres.' using errcode = 'P0001';
  end if;

  select * into l_ticket from public.support_tickets t where t.id = p_ticket_id for update;
  if not found then
    raise exception 'Chamado não encontrado.' using errcode = 'P0002';
  end if;

  select coalesce(nullif(p.full_name, ''), u.email::text)
  into l_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = l_uid;

  insert into public.support_ticket_messages (ticket_id, author_id, author_name, from_staff, body)
  values (l_ticket.id, l_uid, coalesce(l_name, 'Equipe Vez'), true, l_body);

  update public.support_tickets t
  set status = l_status,
      waiting_since = now(),
      last_message_at = now(),
      last_message_from_staff = true,
      first_response_at = coalesce(t.first_response_at, now()),
      resolved_at = case when l_status = 'resolved' then now() end,
      assigned_to = coalesce(t.assigned_to, l_uid)
  where t.id = l_ticket.id;

  perform public.admin_write_audit(
    'Respondeu o chamado #' || l_ticket.number,
    l_ticket.subject
      || case
        when l_status <> l_ticket.status
          then ' · ' || public.support_status_label(l_ticket.status) || ' → '
            || public.support_status_label(l_status)
        else ''
      end
      || ' · resposta: ' || left(l_body, 140)
      || case when char_length(l_body) > 140 then '…' else '' end,
    l_ticket.establishment_id
  );
end;
$$;

create function public.admin_set_ticket_status(
  p_ticket_id uuid,
  p_status public.support_ticket_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_ticket public.support_tickets;
begin
  perform public.admin_require(array['support', 'operations']::public.platform_role[]);
  if p_status is null then
    raise exception 'Escolha a situação.' using errcode = 'P0001';
  end if;
  select * into l_ticket from public.support_tickets t where t.id = p_ticket_id for update;
  if not found then
    raise exception 'Chamado não encontrado.' using errcode = 'P0002';
  end if;
  if l_ticket.status = p_status then
    return;
  end if;

  update public.support_tickets t
  set status = p_status,
      waiting_since = now(),
      resolved_at = case when p_status = 'resolved' then now() end
  where t.id = l_ticket.id;

  perform public.admin_write_audit(
    case
      when p_status = 'resolved' then 'Resolveu o chamado #' || l_ticket.number
      when l_ticket.status = 'resolved' then 'Reabriu o chamado #' || l_ticket.number
      else 'Mudou a situação do chamado #' || l_ticket.number
    end,
    l_ticket.subject || ' · ' || public.support_status_label(l_ticket.status) || ' → '
      || public.support_status_label(p_status),
    l_ticket.establishment_id
  );
end;
$$;

create function public.admin_set_ticket_priority(
  p_ticket_id uuid,
  p_priority public.support_ticket_priority
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_ticket public.support_tickets;
begin
  perform public.admin_require(array['support', 'operations']::public.platform_role[]);
  if p_priority is null then
    raise exception 'Escolha a prioridade.' using errcode = 'P0001';
  end if;
  select * into l_ticket from public.support_tickets t where t.id = p_ticket_id for update;
  if not found then
    raise exception 'Chamado não encontrado.' using errcode = 'P0002';
  end if;
  if l_ticket.status = 'resolved' then
    raise exception 'Chamado resolvido não muda de prioridade. Reabra antes.' using errcode = 'P0001';
  end if;
  if l_ticket.priority = p_priority then
    return;
  end if;

  update public.support_tickets t set priority = p_priority where t.id = l_ticket.id;

  perform public.admin_write_audit(
    'Mudou a prioridade do chamado #' || l_ticket.number,
    l_ticket.subject || ' · ' || public.support_priority_label(l_ticket.priority) || ' → '
      || public.support_priority_label(p_priority),
    l_ticket.establishment_id
  );
end;
$$;

-- `p_admin_id` nulo (ou o UUID zero, que é como a tela manda "ninguém") tira a
-- atribuição. Só recebe chamado quem pode atendê-lo.
create function public.admin_assign_ticket(p_ticket_id uuid, p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_ticket public.support_tickets;
  l_target uuid := nullif(p_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  l_name text;
begin
  perform public.admin_require(array['support', 'operations']::public.platform_role[]);
  select * into l_ticket from public.support_tickets t where t.id = p_ticket_id for update;
  if not found then
    raise exception 'Chamado não encontrado.' using errcode = 'P0002';
  end if;

  if l_target is not null then
    select coalesce(nullif(p.full_name, ''), u.email::text)
    into l_name
    from public.platform_admins pa
    join auth.users u on u.id = pa.user_id
    left join public.profiles p on p.id = pa.user_id
    where pa.user_id = l_target and pa.role in ('admin', 'operations', 'support');
    if l_name is null then
      raise exception 'Só quem atende suporte pode receber o chamado.' using errcode = 'P0001';
    end if;
  end if;

  if l_ticket.assigned_to is not distinct from l_target then
    return;
  end if;

  update public.support_tickets t set assigned_to = l_target where t.id = l_ticket.id;

  perform public.admin_write_audit(
    case
      when l_target is null then 'Tirou a atribuição do chamado #' || l_ticket.number
      else 'Atribuiu o chamado #' || l_ticket.number || ' a ' || l_name
    end,
    l_ticket.subject,
    l_ticket.establishment_id
  );
end;
$$;

-- O `grant` automático da migration do admin só cobriu as funções dela.
revoke execute on function public.admin_support_tickets() from public, anon;
grant execute on function public.admin_support_tickets() to authenticated, service_role;
revoke execute on function public.admin_support_ticket_messages(uuid) from public, anon;
grant execute on function public.admin_support_ticket_messages(uuid) to authenticated, service_role;
revoke execute on function public.admin_reply_ticket(uuid, text, public.support_ticket_status)
  from public, anon;
grant execute on function public.admin_reply_ticket(uuid, text, public.support_ticket_status)
  to authenticated, service_role;
revoke execute on function public.admin_set_ticket_status(uuid, public.support_ticket_status)
  from public, anon;
grant execute on function public.admin_set_ticket_status(uuid, public.support_ticket_status)
  to authenticated, service_role;
revoke execute on function public.admin_set_ticket_priority(uuid, public.support_ticket_priority)
  from public, anon;
grant execute on function public.admin_set_ticket_priority(uuid, public.support_ticket_priority)
  to authenticated, service_role;
revoke execute on function public.admin_assign_ticket(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_ticket(uuid, uuid) to authenticated, service_role;
