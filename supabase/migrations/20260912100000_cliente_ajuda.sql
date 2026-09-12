-- Ajuda no app do cliente: listar e acompanhar os próprios chamados.
--
-- Abrir e responder já existem (`open_support_ticket`, `reply_support_ticket`,
-- da migration do suporte). Faltava a leitura do lado de quem abriu. A RLS de
-- `support_tickets` já deixa o autor ler o próprio chamado, mas a tabela e a
-- conversa carregam o que é da operação: prioridade, atribuição e o nome de
-- quem da equipe respondeu — que cai no e-mail da pessoa quando o perfil não
-- tem nome. Estas duas funções devolvem só o que o cliente precisa ver, com a
-- equipe assinando como "Equipe Vez".
--
-- Aparecem aqui todos os chamados que a pessoa abriu. Quem abre pelo app do
-- cliente a partir da página de uma loja da qual é membro gera um chamado da
-- loja (regra do `open_support_ticket`); ele continua aparecendo para ela aqui.

create function public.customer_support_tickets(p_ticket_id uuid default null)
returns table (
  id uuid,
  number integer,
  subject text,
  category public.support_ticket_category,
  status public.support_ticket_status,
  establishment_id uuid,
  establishment_name text,
  created_at timestamptz,
  last_message_at timestamptz,
  last_message_from_staff boolean,
  preview text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
begin
  if l_uid is null then
    raise exception 'Entre na sua conta para ver seus chamados.' using errcode = '42501';
  end if;

  return query
    select
      t.id,
      t.number,
      t.subject,
      t.category,
      t.status,
      t.establishment_id,
      e.name,
      t.created_at,
      t.last_message_at,
      t.last_message_from_staff,
      coalesce(
        (
          select left(m.body, 160)
          from public.support_ticket_messages m
          where m.ticket_id = t.id
          order by m.created_at desc, m.id desc
          limit 1
        ),
        ''
      )
    from public.support_tickets t
    left join public.establishments e on e.id = t.establishment_id
    where t.requester_id = l_uid
      and (p_ticket_id is null or t.id = p_ticket_id)
    -- Primeiro o que pede resposta da pessoa, depois o que espera a equipe, por
    -- último o resolvido; dentro de cada grupo, o mais recente em cima.
    order by
      t.status = 'resolved',
      t.status <> 'waiting_customer',
      t.last_message_at desc
    limit 50;
end;
$$;

create function public.customer_support_ticket_messages(p_ticket_id uuid)
returns table (
  id uuid,
  from_staff boolean,
  author_name text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
begin
  if l_uid is null then
    raise exception 'Entre na sua conta para ver seus chamados.' using errcode = '42501';
  end if;
  -- Chamado de outra pessoa responde igual a chamado inexistente: não confirma
  -- que o id existe.
  if not exists (
    select 1 from public.support_tickets t
    where t.id = p_ticket_id and t.requester_id = l_uid
  ) then
    raise exception 'Chamado não encontrado.' using errcode = 'P0002';
  end if;

  return query
    select
      m.id,
      m.from_staff,
      case when m.from_staff then 'Equipe Vez' else m.author_name end,
      m.body,
      m.created_at
    from public.support_ticket_messages m
    where m.ticket_id = p_ticket_id
    order by m.created_at, m.id;
end;
$$;

revoke execute on function public.customer_support_tickets(uuid) from public, anon;
grant execute on function public.customer_support_tickets(uuid) to authenticated, service_role;
revoke execute on function public.customer_support_ticket_messages(uuid) from public, anon;
grant execute on function public.customer_support_ticket_messages(uuid)
  to authenticated, service_role;
