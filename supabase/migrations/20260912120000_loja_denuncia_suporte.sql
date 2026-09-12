-- A loja do outro lado da moderação de avaliações.
--
-- O admin já decide denúncia e já pede esclarecimento à loja
-- (`admin_decide_report`, `admin_request_clarification`), mas até aqui nenhuma
-- superfície abria denúncia nem respondia ao pedido: a fila de Denúncias só
-- enchia por SQL. Esta migration fecha o ciclo pelo app do estabelecimento.
--
-- Três funções novas, todas `security definer` e com o papel conferido por
-- dentro:
--
--   `establishment_reviews`        as avaliações da loja com a denúncia de cada
--   `report_review`                abrir denúncia (dono ou gerente)
--   `answer_review_clarification`  responder o pedido da equipe
--
-- Por que RPC e não o insert direto que a política `review_reports_insert_manager`
-- já permitiria: a política sabe dizer *quem* pode, não *o quê*. Ela aceitaria
-- qualquer `reason` de 3 a 80 caracteres e uma justificativa vazia, e a
-- violação do índice `review_reports_one_open` chegaria na tela como
-- "duplicate key value violates unique constraint". A RPC guarda o vocabulário
-- de motivos (o mesmo que o admin usa para decidir), exige justificativa e
-- devolve frase em português. A política continua onde está, como segunda
-- tranca: sem ela, um insert direto pela PostgREST passaria por cima de tudo.
--
-- Chamados da loja não precisam de nada novo: `open_support_ticket` e
-- `reply_support_ticket` (T2) já atendem, e a política
-- `support_tickets_select_member` já deixa qualquer membro acompanhar.

-- ---------------------------------------------------------------------------
-- A resposta da loja ao pedido de esclarecimento
-- ---------------------------------------------------------------------------
-- `clarification_request` já existia (o que a equipe perguntou). Faltava onde
-- guardar o que a loja respondeu — sem isso a conversa acabava no app da loja
-- e a equipe decidia sem ler.

alter table public.review_reports
  add column clarification_answer text,
  add column clarification_answered_at timestamptz;

comment on column public.review_reports.clarification_answer is
  'O que a loja respondeu ao pedido da equipe. Escrita só por answer_review_clarification.';

-- ---------------------------------------------------------------------------
-- Vocabulário de motivos
-- ---------------------------------------------------------------------------
-- Os mesmos critérios de remoção que o admin oferece ao decidir
-- (`MOTIVES_REMOVE` em `apps/admin/components/data.ts`): a loja alega um deles,
-- e a equipe decide sobre o mesmo vocabulário. Motivo livre viraria campo de
-- desabafo, e a fila do admin deixaria de ser ordenável por tipo.
--
-- A lista vive aqui e é repetida em `apps/mobile-staff/src/data/reviews.ts`.
-- Quem mudar uma muda a outra; se escaparem, a RPC recusa com a frase abaixo.

create function public.review_report_reasons()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'Conteúdo ofensivo ou ataque pessoal',
    'Dado pessoal exposto',
    'Não se refere a este estabelecimento',
    'Retaliação por cobrança prevista em política',
    'Conteúdo comercial ou spam'
  ];
$$;

revoke execute on function public.review_report_reasons() from public, anon;
grant execute on function public.review_report_reasons() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Leitura: as avaliações da loja, com a denúncia de cada uma
-- ---------------------------------------------------------------------------
-- Por que RPC e não consulta com RLS: `reviews_select_public` esconde a
-- avaliação removida — inclusive da loja que a denunciou. Sem esta função, o
-- fim da história ("removemos, e por isto") desapareceria junto com o texto, e
-- a loja nunca saberia o que a equipe decidiu. Aqui a removida continua na
-- lista, marcada, com o motivo da decisão ao lado.

create function public.establishment_reviews(p_establishment_id uuid)
returns table (
  review_id uuid,
  rating integer,
  comment text,
  tags text[],
  created_at timestamptz,
  author text,
  service text,
  professional text,
  appointment_at timestamptz,
  removed boolean,
  report_id uuid,
  report_reason text,
  report_justification text,
  report_status public.review_report_status,
  report_opened_at timestamptz,
  clarification_request text,
  clarification_answer text,
  clarification_answered_at timestamptz,
  decision_motive text,
  decision_note text,
  decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_establishment_member(p_establishment_id) then
    raise exception 'Loja não encontrada.' using errcode = 'P0002';
  end if;

  return query
    with last_report as (
      -- Uma avaliação pode ter sido denunciada mais de uma vez ao longo do
      -- tempo (o índice único só cobre a que está aberta). Vale a última.
      select distinct on (rr.review_id) rr.*
      from public.review_reports rr
      where rr.establishment_id = p_establishment_id
      order by rr.review_id, rr.opened_at desc
    )
    select
      r.id,
      r.rating::integer,
      coalesce(r.comment, ''),
      r.tags,
      r.created_at,
      coalesce(nullif(au.full_name, ''), 'Cliente'),
      s.name,
      coalesce(pr.display_name, '—'),
      a.starts_at,
      r.removed_at is not null,
      lr.id,
      lr.reason,
      lr.justification,
      lr.status,
      lr.opened_at,
      lr.clarification_request,
      lr.clarification_answer,
      lr.clarification_answered_at,
      lr.decision_motive,
      lr.decision_note,
      lr.decided_at
    from public.reviews r
    join public.appointments a on a.id = r.appointment_id
    join public.services s on s.id = a.service_id
    left join public.professionals pr on pr.id = a.professional_id
    left join public.profiles au on au.id = r.customer_id
    left join last_report lr on lr.review_id = r.id
    where r.establishment_id = p_establishment_id
    order by r.created_at desc
    limit 200;
end;
$$;

revoke execute on function public.establishment_reviews(uuid) from public, anon;
grant execute on function public.establishment_reviews(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Abrir denúncia
-- ---------------------------------------------------------------------------

create function public.report_review(
  p_review_id uuid,
  p_reason text,
  p_justification text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_reason text := btrim(coalesce(p_reason, ''));
  l_justification text := btrim(coalesce(p_justification, ''));
  l_review public.reviews;
  l_id uuid;
begin
  if l_uid is null then
    raise exception 'Entre na sua conta para denunciar.' using errcode = '42501';
  end if;

  select * into l_review from public.reviews where id = p_review_id;
  if not found then
    raise exception 'Avaliação não encontrada.' using errcode = 'P0002';
  end if;

  -- Papel antes de qualquer outra coisa: quem é equipe sem gerência não vê
  -- mensagem de validação, vê "não encontrada" — a existência da avaliação de
  -- outra loja não é informação dele.
  if not public.has_establishment_role(
    l_review.establishment_id,
    array['owner', 'manager']::public.establishment_role[]
  ) then
    raise exception 'Só o dono ou a gerência denuncia uma avaliação.' using errcode = '42501';
  end if;

  if not (l_reason = any (public.review_report_reasons())) then
    raise exception 'Escolha um dos motivos da lista.' using errcode = 'P0001';
  end if;
  if char_length(l_justification) < 20 then
    raise exception 'Explique em pelo menos 20 caracteres o que houve.' using errcode = 'P0001';
  end if;
  if char_length(l_justification) > 2000 then
    raise exception 'A explicação vai até 2.000 caracteres.' using errcode = 'P0001';
  end if;

  if l_review.removed_at is not null then
    raise exception 'Esta avaliação já foi removida pela equipe.' using errcode = 'P0001';
  end if;
  if public.review_in_moderation(l_review.id) then
    raise exception 'Esta avaliação já está com a equipe.' using errcode = 'P0001';
  end if;

  insert into public.review_reports (
    review_id, establishment_id, reason, justification, status, opened_by
  ) values (
    l_review.id, l_review.establishment_id, l_reason, l_justification, 'open', l_uid
  )
  returning id into l_id;

  return l_id;
end;
$$;

revoke execute on function public.report_review(uuid, text, text) from public, anon;
grant execute on function public.report_review(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Responder o pedido de esclarecimento
-- ---------------------------------------------------------------------------
-- Responder devolve a denúncia para `open`: a vez volta a ser da equipe, e ela
-- reaparece na fila de Denúncias sem o rótulo "aguardando loja".

create function public.answer_review_clarification(p_report_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_answer text := btrim(coalesce(p_answer, ''));
  l_report public.review_reports;
begin
  if l_uid is null then
    raise exception 'Entre na sua conta para responder.' using errcode = '42501';
  end if;

  select * into l_report from public.review_reports where id = p_report_id for update;
  if not found then
    raise exception 'Denúncia não encontrada.' using errcode = 'P0002';
  end if;
  if not public.has_establishment_role(
    l_report.establishment_id,
    array['owner', 'manager']::public.establishment_role[]
  ) then
    raise exception 'Só o dono ou a gerência responde à equipe.' using errcode = '42501';
  end if;

  if l_report.status <> 'awaiting_establishment' then
    raise exception 'A equipe não está esperando resposta nesta denúncia.' using errcode = 'P0001';
  end if;
  if char_length(l_answer) < 10 then
    raise exception 'Escreva a resposta em pelo menos 10 caracteres.' using errcode = 'P0001';
  end if;
  if char_length(l_answer) > 2000 then
    raise exception 'A resposta vai até 2.000 caracteres.' using errcode = 'P0001';
  end if;

  update public.review_reports
  set clarification_answer = l_answer,
      clarification_answered_at = now(),
      status = 'open'
  where id = l_report.id;
end;
$$;

revoke execute on function public.answer_review_clarification(uuid, text) from public, anon;
grant execute on function public.answer_review_clarification(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A resposta da loja na tela de Denúncias do admin
-- ---------------------------------------------------------------------------
-- `drop` + `create` e não `create or replace`: três colunas a mais mudam o tipo
-- de retorno, e `replace` recusa isso. O corpo é o da migration
-- `20260910121000_admin_platform.sql` com `clarification_request`,
-- `clarification_answer` e `clarification_answered_at` no fim.

drop function public.admin_review_reports();

create function public.admin_review_reports()
returns table (
  id uuid,
  review_id uuid,
  establishment_id uuid,
  establishment text,
  city text,
  reason text,
  justification text,
  status public.review_report_status,
  opened_at timestamptz,
  rating integer,
  comment text,
  author text,
  reviewed_at timestamptz,
  service text,
  professional text,
  appointment_at timestamptz,
  value_cents integer,
  author_reviews integer,
  author_average numeric,
  author_removed integer,
  establishment_average numeric,
  establishment_reviews integer,
  establishment_reports integer,
  clarification_request text,
  clarification_answer text,
  clarification_answered_at timestamptz
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
      rr.id,
      r.id,
      e.id,
      e.name,
      c.name,
      rr.reason,
      rr.justification,
      rr.status,
      rr.opened_at,
      r.rating::integer,
      coalesce(r.comment, ''),
      coalesce(nullif(au.full_name, ''), 'Cliente'),
      r.created_at,
      s.name,
      coalesce(pr.display_name, '—'),
      a.starts_at,
      a.price_cents,
      (select count(*)::integer from public.reviews x where x.customer_id = r.customer_id),
      (select round(avg(x.rating)::numeric, 1) from public.reviews x where x.customer_id = r.customer_id),
      (select count(*)::integer from public.reviews x where x.customer_id = r.customer_id and x.removed_at is not null),
      coalesce(e.rating_avg, 0),
      e.rating_count,
      (select count(*)::integer from public.review_reports y where y.establishment_id = e.id and y.id <> rr.id),
      rr.clarification_request,
      rr.clarification_answer,
      rr.clarification_answered_at
    from public.review_reports rr
    join public.reviews r on r.id = rr.review_id
    join public.establishments e on e.id = rr.establishment_id
    join public.cities c on c.id = e.city_id
    join public.appointments a on a.id = r.appointment_id
    join public.services s on s.id = a.service_id
    left join public.professionals pr on pr.id = a.professional_id
    left join public.profiles au on au.id = r.customer_id
    where rr.status in ('open', 'awaiting_establishment')
    order by rr.opened_at;
end;
$$;

-- O `do $$ … $$` que dava permissão a toda `admin_*` rodou na migration antiga;
-- a função recriada nasce sem herdar nada dele.
revoke execute on function public.admin_review_reports() from public, anon;
grant execute on function public.admin_review_reports() to authenticated, service_role;
