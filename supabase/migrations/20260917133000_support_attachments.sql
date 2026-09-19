-- ---------------------------------------------------------------------------
-- Anexos em chamados
-- ---------------------------------------------------------------------------
-- Print da tela com erro, comprovante, foto do cartaz: o chamado sem anexo vira
-- "manda por WhatsApp". O bucket é PRIVADO — ao contrário da vitrine e das
-- fotos da loja, o conteúdo pode ter dado pessoal — e a leitura é sempre por
-- URL assinada de curta duração (`createSignedUrl`).
--
-- O caminho carrega a autorização: `<ticket_id>/<uuid>.<ext>`. As políticas de
-- `storage.objects` leem a primeira pasta e perguntam a
-- `support_ticket_can_access()` se a pessoa enxerga aquele chamado — a mesma
-- regra da RLS de `support_tickets`. Para a equipe da plataforma vale também o
-- segundo fator (`admin_require`), como no resto do painel.
--
-- Fluxo: o app sobe o arquivo no bucket e chama `attach_support_file()`, que
-- confere o objeto, grava a linha e amarra à mensagem (opcional). Arquivo sem
-- linha (upload abandonado) é apagado pelo despacho `notifications-dispatch`
-- depois de 24 horas, pela API do Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments', 'support-attachments', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Quem enxerga o chamado: quem abriu, a loja (se o chamado é dela) ou a equipe
-- de suporte com o acesso administrativo válido.
create function public.support_ticket_can_access(p_ticket_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_ticket public.support_tickets;
begin
  select * into l_ticket from public.support_tickets t where t.id = p_ticket_id;
  if not found then
    return false;
  end if;
  if l_ticket.requester_id = (select auth.uid()) then
    return true;
  end if;
  if l_ticket.requester_kind = 'establishment' and public.is_establishment_member(l_ticket.establishment_id) then
    return true;
  end if;
  if public.is_support_agent() then
    begin
      perform public.admin_require(array['support', 'operations']::public.platform_role[]);
      return true;
    exception
      when insufficient_privilege or sqlstate 'PVMFA' then
        return false;
    end;
  end if;
  return false;
end;
$$;

revoke execute on function public.support_ticket_can_access(uuid) from public, anon;
grant execute on function public.support_ticket_can_access(uuid) to authenticated, service_role;

-- A primeira pasta do caminho, como uuid, sem estourar em nome malformado.
create function public.support_attachment_ticket_id(p_object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  l_folder text := (storage.foldername(p_object_name))[1];
begin
  if l_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return l_folder::uuid;
end;
$$;

revoke execute on function public.support_attachment_ticket_id(text) from public, anon;
grant execute on function public.support_attachment_ticket_id(text) to authenticated, service_role;

create table public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  message_id uuid references public.support_ticket_messages (id) on delete set null,
  storage_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 160),
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid references public.profiles (id) on delete set null,
  from_staff boolean not null,
  created_at timestamptz not null default now(),
  constraint support_ticket_attachments_path_key unique (storage_path),
  constraint support_ticket_attachments_path_format
    check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|pdf)$'),
  constraint support_ticket_attachments_path_matches_ticket
    check (split_part(storage_path, '/', 1) = ticket_id::text)
);

comment on table public.support_ticket_attachments is
  'Anexos de chamado no bucket privado support-attachments. Escrita só por attach_support_file; leitura segue o chamado.';

create index support_ticket_attachments_ticket_idx on public.support_ticket_attachments (ticket_id, created_at);
create index support_ticket_attachments_message_idx on public.support_ticket_attachments (message_id);

alter table public.support_ticket_attachments enable row level security;

create policy support_ticket_attachments_select_visible
  on public.support_ticket_attachments for select
  to authenticated
  using (public.support_ticket_can_access(ticket_id));

-- ── storage.objects ─────────────────────────────────────────────────────────
-- Subir: só em chamado que a pessoa enxerga e que não esteja resolvido (quem
-- quer anexar a um resolvido responde antes, e a resposta reabre).
-- Ler (assinar URL): quem enxerga o chamado. Apagar: só quem subiu, enquanto o
-- arquivo não virou anexo. Não há update: anexo não se troca, se apaga.

create policy support_attachments_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and public.support_ticket_can_access(public.support_attachment_ticket_id(name))
    and exists (
      select 1 from public.support_tickets t
      where t.id = public.support_attachment_ticket_id(name) and t.status <> 'resolved'
    )
  );

create policy support_attachments_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and public.support_ticket_can_access(public.support_attachment_ticket_id(name))
  );

create policy support_attachments_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'support-attachments'
    and owner_id = (select auth.uid())::text
    and not exists (
      select 1 from public.support_ticket_attachments a where a.storage_path = name
    )
  );

-- ---------------------------------------------------------------------------
-- Registrar o anexo
-- ---------------------------------------------------------------------------
-- Tipo e tamanho vêm do `metadata` que o Storage gravou, não do cliente. A
-- mensagem, se informada, precisa ser do mesmo chamado. Limite de 10 anexos
-- por chamado.

create function public.attach_support_file(
  p_ticket_id uuid,
  p_storage_path text,
  p_file_name text,
  p_message_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_object storage.objects;
  l_mime text;
  l_size integer;
  l_name text := left(regexp_replace(btrim(coalesce(p_file_name, '')), '[\r\n/\\]', '_', 'g'), 160);
  l_id uuid;
  l_staff boolean;
begin
  if l_uid is null then
    raise exception 'Entre na sua conta.' using errcode = '42501', hint = 'unauthorized';
  end if;
  if not public.support_ticket_can_access(p_ticket_id) then
    raise exception 'Chamado não encontrado.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if public.support_attachment_ticket_id(p_storage_path) is distinct from p_ticket_id then
    raise exception 'O arquivo não pertence a este chamado.' using errcode = 'P0001', hint = 'invalid_path';
  end if;

  select * into l_object from storage.objects o
  where o.bucket_id = 'support-attachments' and o.name = p_storage_path;
  if not found then
    raise exception 'Envie o arquivo antes de anexar.' using errcode = 'P0002', hint = 'object_missing';
  end if;
  if l_object.owner_id is distinct from l_uid::text then
    raise exception 'O arquivo não foi enviado por você.' using errcode = '42501', hint = 'forbidden';
  end if;

  l_mime := l_object.metadata ->> 'mimetype';
  l_size := (l_object.metadata ->> 'size')::integer;
  if l_mime is null or l_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf') then
    raise exception 'Formato não aceito. Use imagem ou PDF.' using errcode = 'P0001', hint = 'invalid_type';
  end if;

  if p_message_id is not null and not exists (
    select 1 from public.support_ticket_messages m where m.id = p_message_id and m.ticket_id = p_ticket_id
  ) then
    raise exception 'Mensagem não encontrada neste chamado.' using errcode = 'P0002', hint = 'invalid_message';
  end if;

  if (select count(*) from public.support_ticket_attachments a where a.ticket_id = p_ticket_id) >= 10 then
    raise exception 'O chamado já tem 10 anexos.' using errcode = 'P0001', hint = 'attachment_limit';
  end if;

  l_staff := public.is_support_agent() and not exists (
    select 1 from public.support_tickets t where t.id = p_ticket_id and t.requester_id = l_uid
  );

  insert into public.support_ticket_attachments (
    ticket_id, message_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, from_staff
  ) values (
    p_ticket_id, p_message_id, p_storage_path, coalesce(nullif(l_name, ''), 'anexo'), l_mime,
    coalesce(l_size, 1), l_uid, l_staff
  )
  returning id into l_id;

  if l_staff then
    perform public.admin_write_audit(
      'Anexou arquivo ao chamado #' || (select t.number from public.support_tickets t where t.id = p_ticket_id),
      coalesce(nullif(l_name, ''), 'anexo'),
      (select t.establishment_id from public.support_tickets t where t.id = p_ticket_id)
    );
  end if;
  return l_id;
end;
$$;

-- Lista para qualquer lado da conversa (a RLS da tabela já basta para o app;
-- a RPC existe para o painel, que lê tudo por RPC).
create function public.support_ticket_attachments(p_ticket_id uuid)
returns table (
  id uuid,
  message_id uuid,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes integer,
  from_staff boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.support_ticket_can_access(p_ticket_id) then
    raise exception 'Chamado não encontrado.' using errcode = 'P0002', hint = 'not_found';
  end if;
  return query
    select a.id, a.message_id, a.storage_path, a.file_name, a.mime_type, a.size_bytes, a.from_staff, a.created_at
    from public.support_ticket_attachments a
    where a.ticket_id = p_ticket_id
    order by a.created_at, a.id;
end;
$$;

revoke execute on function public.attach_support_file(uuid, text, text, uuid) from public, anon;
grant execute on function public.attach_support_file(uuid, text, text, uuid) to authenticated, service_role;
revoke execute on function public.support_ticket_attachments(uuid) from public, anon;
grant execute on function public.support_ticket_attachments(uuid) to authenticated, service_role;

-- Upload abandonado: objeto sem linha há mais de 24 horas. Apagar pela tabela
-- de metadados não remove o binário do disco do Storage; a limpeza completa
-- é pela API do Storage — feita pelo despacho `notifications-dispatch`.
create function public.support_attachments_orphans()
returns table (name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, o.created_at
  from storage.objects o
  where o.bucket_id = 'support-attachments'
    and o.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.support_ticket_attachments a where a.storage_path = o.name);
$$;

revoke execute on function public.support_attachments_orphans() from public, anon, authenticated;
grant execute on function public.support_attachments_orphans() to service_role;
