-- ---------------------------------------------------------------------------
-- Vitrine: banners da home do app do cliente
-- ---------------------------------------------------------------------------
-- A tela "Vitrine" do admin (canvas: "Banners da Home do app") mantém os
-- banners que o app do cliente mostra no topo da home. O banner é global: o MVP
-- não tem cidade na interface do usuário final, então não há segmentação por
-- cidade aqui.
--
-- Como o resto do admin, a tabela não tem política de escrita: criar, editar,
-- pausar, reordenar e remover passam por funções `admin_*` que conferem o papel
-- (`operations`, ou `admin`), validam e gravam a auditoria na mesma transação.
--
-- A imagem vive no bucket público `showcase` do Storage. O navegador do admin
-- sobe o arquivo direto (política de upload só para a equipe com o papel certo)
-- e depois grava o caminho pelo `admin_save_banner`, que confere que o arquivo
-- existe. Apagar o arquivo também é do navegador: o Storage não aceita
-- `delete` direto em `storage.objects`.

create type public.showcase_target as enum ('establishment', 'category', 'url');

create table public.showcase_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 60),
  subtitle text not null default '' check (char_length(subtitle) <= 120),
  -- caminho dentro do bucket `showcase`, ex.: banners/2f1c….webp
  image_path text not null check (image_path ~ '^banners/[A-Za-z0-9._-]+$'),
  target_kind public.showcase_target not null,
  target_establishment_id uuid references public.establishments (id) on delete cascade,
  target_category public.establishment_category,
  target_url text check (char_length(target_url) <= 500 and target_url ~ '^https://\S+$'),
  -- janela de exibição; nulo = sem limite daquele lado
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint showcase_banners_target_check check (
    case target_kind
      when 'establishment' then
        target_establishment_id is not null and target_category is null and target_url is null
      when 'category' then
        target_category is not null and target_establishment_id is null and target_url is null
      else
        target_url is not null and target_establishment_id is null and target_category is null
    end
  ),
  constraint showcase_banners_window_check check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

comment on table public.showcase_banners is
  'Banners da home do app do cliente. Globais (sem cidade). Escrita só pelas funções admin_*; leitura pública só dos vigentes.';

create index showcase_banners_sort_idx on public.showcase_banners (sort_order, created_at);
create index showcase_banners_target_establishment_idx
  on public.showcase_banners (target_establishment_id)
  where target_establishment_id is not null;

create trigger showcase_banners_set_updated_at
  before update on public.showcase_banners
  for each row execute function public.set_updated_at();

-- Vigente = ativo, dentro da janela e com destino que ainda existe para o
-- cliente (loja suspensa não recebe tráfego de banner). É a regra única usada
-- pela política de leitura, pela RPC pública e pela situação no admin.
-- `security definer` para a checagem da loja não depender da RLS de quem lê.
create function public.showcase_is_live(p_banner public.showcase_banners)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_banner.is_active
    and (p_banner.starts_at is null or p_banner.starts_at <= now())
    and (p_banner.ends_at is null or p_banner.ends_at > now())
    and (
      p_banner.target_kind <> 'establishment'
      or exists (
        select 1 from public.establishments e
        where e.id = p_banner.target_establishment_id and e.status = 'active'
      )
    );
$$;

revoke execute on function public.showcase_is_live(public.showcase_banners) from public;
grant execute on function public.showcase_is_live(public.showcase_banners)
  to anon, authenticated, service_role;

alter table public.showcase_banners enable row level security;

create policy showcase_banners_select_live on public.showcase_banners
  for select to anon, authenticated
  using (public.showcase_is_live(showcase_banners));

-- Sem política de escrita; tirar também o privilégio deixa isso explícito.
revoke insert, update, delete, truncate on public.showcase_banners from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leitura pública
-- ---------------------------------------------------------------------------
-- O que a home do app do cliente consome. `image_path` é relativo ao bucket
-- `showcase`: o app monta a URL com `storage.from('showcase').getPublicUrl()`.
-- `target_value` é o id da loja, a categoria (valor do enum) ou o link https.

create function public.showcase_banners()
returns table (
  id uuid,
  title text,
  subtitle text,
  image_path text,
  target_kind public.showcase_target,
  target_value text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.title,
    b.subtitle,
    b.image_path,
    b.target_kind,
    coalesce(b.target_establishment_id::text, b.target_category::text, b.target_url)
  from public.showcase_banners b
  where public.showcase_is_live(b)
  order by b.sort_order, b.created_at;
$$;

revoke execute on function public.showcase_banners() from public;
grant execute on function public.showcase_banners() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Imagens no Storage
-- ---------------------------------------------------------------------------
-- Bucket público: a imagem é servida pela URL pública, sem RLS, para qualquer
-- um. A listagem do bucket (select em storage.objects) fica só com a equipe
-- que cuida da vitrine, para não expor a arte de campanha ainda agendada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('showcase', 'showcase', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Quem pode mexer no bucket: a mesma porta de entrada das funções `admin_*`,
-- para uma regra nova de acesso administrativo valer aqui também.
create function public.showcase_can_manage()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  return true;
exception
  when insufficient_privilege then
    return false;
end;
$$;

revoke execute on function public.showcase_can_manage() from public, anon;
grant execute on function public.showcase_can_manage() to authenticated, service_role;

create policy showcase_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'showcase' and public.showcase_can_manage());

create policy showcase_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'showcase' and public.showcase_can_manage());

create policy showcase_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'showcase' and public.showcase_can_manage())
  with check (bucket_id = 'showcase' and public.showcase_can_manage());

create policy showcase_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'showcase' and public.showcase_can_manage());

-- ---------------------------------------------------------------------------
-- Textos para a auditoria
-- ---------------------------------------------------------------------------

create function public.showcase_target_label(p_banner public.showcase_banners)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case p_banner.target_kind
    when 'establishment' then
      'loja ' || coalesce(
        (select e.name from public.establishments e where e.id = p_banner.target_establishment_id),
        'removida'
      )
    when 'category' then
      'categoria ' || case p_banner.target_category
        when 'barbershop' then 'Barbearia'
        when 'salon' then 'Salão'
        when 'aesthetic_clinic' then 'Estética'
        when 'dermatology' then 'Dermatologia'
        when 'petshop' then 'Petshop'
        when 'nail_salon' then 'Manicure'
        when 'dentistry' then 'Odontologia'
        else 'Massagem'
      end
    else 'link ' || p_banner.target_url
  end;
$$;

revoke execute on function public.showcase_target_label(public.showcase_banners)
  from public, anon, authenticated, service_role;

-- "de 12/09/2026 08:00 até 20/09/2026 23:59", no fuso de Brasília.
create function public.showcase_window_text(p_starts_at timestamptz, p_ends_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_starts_at is null and p_ends_at is null then 'sem data de início ou fim'
    when p_ends_at is null then
      'a partir de ' || to_char(p_starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
    when p_starts_at is null then
      'até ' || to_char(p_ends_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
    else
      'de ' || to_char(p_starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
        || ' até ' || to_char(p_ends_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
  end;
$$;

revoke execute on function public.showcase_window_text(timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin: leitura
-- ---------------------------------------------------------------------------
-- Toda a equipe lê (o painel carrega tudo de uma vez); só operações escreve.

create function public.admin_showcase_banners()
returns table (
  id uuid,
  title text,
  subtitle text,
  image_path text,
  target_kind public.showcase_target,
  target_value text,
  target_label text,
  -- a loja de destino ainda está ativa (sempre verdadeiro para categoria e link)
  target_available boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer,
  is_active boolean,
  is_live boolean,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz
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
      b.id,
      b.title,
      b.subtitle,
      b.image_path,
      b.target_kind,
      coalesce(b.target_establishment_id::text, b.target_category::text, b.target_url),
      case b.target_kind
        when 'establishment' then coalesce(e.name, 'Loja removida')
        when 'category' then b.target_category::text
        else b.target_url
      end,
      b.target_kind <> 'establishment' or coalesce(e.status = 'active', false),
      b.starts_at,
      b.ends_at,
      b.sort_order,
      b.is_active,
      public.showcase_is_live(b),
      coalesce(nullif(p.full_name, ''), u.email::text),
      b.created_at,
      b.updated_at
    from public.showcase_banners b
    left join public.establishments e on e.id = b.target_establishment_id
    left join public.profiles p on p.id = b.created_by
    left join auth.users u on u.id = b.created_by
    order by b.sort_order, b.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: escrita
-- ---------------------------------------------------------------------------

-- Cria (sem `p_id`) ou edita um banner. Grava o estado inteiro: janela omitida
-- é janela sem limite. `p_target_value` segue `p_target_kind`: id da loja,
-- valor da categoria ou link https.
create function public.admin_save_banner(
  p_title text,
  p_subtitle text,
  p_image_path text,
  p_target_kind public.showcase_target,
  p_target_value text,
  p_id uuid default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_title text := btrim(coalesce(p_title, ''));
  l_subtitle text := btrim(coalesce(p_subtitle, ''));
  l_path text := btrim(coalesce(p_image_path, ''));
  l_value text := btrim(coalesce(p_target_value, ''));
  l_before public.showcase_banners;
  l_after public.showcase_banners;
  l_establishment public.establishments;
  l_category public.establishment_category;
  l_changes text[] := '{}'::text[];
begin
  perform public.admin_require(array['operations']::public.platform_role[]);

  if p_id is not null then
    select * into l_before from public.showcase_banners where id = p_id for update;
    if not found then
      raise exception 'Banner não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  if char_length(l_title) < 2 or char_length(l_title) > 60 then
    raise exception 'O título do banner tem de 2 a 60 caracteres.' using errcode = 'P0001';
  end if;
  if char_length(l_subtitle) > 120 then
    raise exception 'O subtítulo tem no máximo 120 caracteres.' using errcode = 'P0001';
  end if;

  if l_path = '' then
    raise exception 'Envie a imagem do banner.' using errcode = 'P0001';
  end if;
  if l_path !~ '^banners/[A-Za-z0-9._-]+$' or not exists (
    select 1 from storage.objects o where o.bucket_id = 'showcase' and o.name = l_path
  ) then
    raise exception 'A imagem não foi encontrada no armazenamento. Envie o arquivo de novo.'
      using errcode = 'P0001';
  end if;

  if p_target_kind is null then
    raise exception 'Escolha o destino do banner.' using errcode = 'P0001';
  elsif p_target_kind = 'establishment' then
    if l_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Escolha a loja de destino.' using errcode = 'P0001';
    end if;
    select * into l_establishment from public.establishments where id = l_value::uuid;
    if not found then
      raise exception 'A loja de destino não existe.' using errcode = 'P0001';
    end if;
    if l_establishment.status <> 'active' then
      raise exception '% não está ativa; o banner não pode levar a ela.', l_establishment.name
        using errcode = 'P0001';
    end if;
  elsif p_target_kind = 'category' then
    if not l_value = any (enum_range(null::public.establishment_category)::text[]) then
      raise exception 'Escolha a categoria de destino.' using errcode = 'P0001';
    end if;
    l_category := l_value::public.establishment_category;
  else
    if l_value !~ '^https://[^\s/.?#][^\s]*$' then
      raise exception 'O link de destino precisa começar com https://.' using errcode = 'P0001';
    end if;
    if char_length(l_value) > 500 then
      raise exception 'O link de destino tem no máximo 500 caracteres.' using errcode = 'P0001';
    end if;
  end if;

  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'O fim da exibição precisa ser depois do início.' using errcode = 'P0001';
  end if;
  -- Um banner antigo pode ser editado sem mexer nas datas; data de fim nova
  -- no passado é engano de digitação.
  if p_ends_at is not null and p_ends_at <= now()
     and (l_before.id is null or p_ends_at is distinct from l_before.ends_at) then
    raise exception 'O fim da exibição já passou.' using errcode = 'P0001';
  end if;

  if l_before.id is null then
    insert into public.showcase_banners (
      title, subtitle, image_path, target_kind,
      target_establishment_id, target_category, target_url,
      starts_at, ends_at, sort_order, is_active, created_by
    ) values (
      l_title, l_subtitle, l_path, p_target_kind,
      l_establishment.id, l_category,
      case when p_target_kind = 'url' then l_value end,
      p_starts_at, p_ends_at,
      coalesce((select max(sort_order) from public.showcase_banners), 0) + 1,
      true, (select auth.uid())
    )
    returning * into l_after;

    perform public.admin_write_audit(
      'Criou o banner "' || l_title || '" na vitrine',
      public.showcase_target_label(l_after) || ' · '
        || public.showcase_window_text(p_starts_at, p_ends_at)
    );
    return l_after.id;
  end if;

  update public.showcase_banners
  set title = l_title,
      subtitle = l_subtitle,
      image_path = l_path,
      target_kind = p_target_kind,
      target_establishment_id = l_establishment.id,
      target_category = l_category,
      target_url = case when p_target_kind = 'url' then l_value end,
      starts_at = p_starts_at,
      ends_at = p_ends_at
  where id = l_before.id
  returning * into l_after;

  if l_after.title <> l_before.title then
    l_changes := l_changes || ('título: "' || l_before.title || '" → "' || l_after.title || '"');
  end if;
  if l_after.subtitle <> l_before.subtitle then
    l_changes := l_changes || 'subtítulo alterado'::text;
  end if;
  if l_after.image_path <> l_before.image_path then
    l_changes := l_changes || 'imagem trocada'::text;
  end if;
  if public.showcase_target_label(l_after) <> public.showcase_target_label(l_before) then
    l_changes := l_changes
      || ('destino: ' || public.showcase_target_label(l_before) || ' → '
          || public.showcase_target_label(l_after));
  end if;
  if l_after.starts_at is distinct from l_before.starts_at
     or l_after.ends_at is distinct from l_before.ends_at then
    l_changes := l_changes
      || ('exibição: ' || public.showcase_window_text(l_after.starts_at, l_after.ends_at));
  end if;

  perform public.admin_write_audit(
    'Editou o banner "' || l_after.title || '" na vitrine',
    coalesce(nullif(array_to_string(l_changes, ' · '), ''), 'sem mudança de conteúdo')
  );
  return l_after.id;
end;
$$;

create function public.admin_set_banner_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_banner public.showcase_banners;
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  if p_active is null then
    raise exception 'Informe se o banner fica ativo ou pausado.' using errcode = 'P0001';
  end if;

  select * into l_banner from public.showcase_banners where id = p_id for update;
  if not found then
    raise exception 'Banner não encontrado.' using errcode = 'P0002';
  end if;
  if l_banner.is_active = p_active then
    raise exception 'O banner já está %.', case when p_active then 'ativo' else 'pausado' end
      using errcode = 'P0001';
  end if;

  update public.showcase_banners set is_active = p_active where id = l_banner.id
  returning * into l_banner;

  perform public.admin_write_audit(
    case when p_active then 'Reativou' else 'Pausou' end
      || ' o banner "' || l_banner.title || '" na vitrine',
    case
      when not p_active then 'sai da home do app'
      when public.showcase_is_live(l_banner) then 'volta para a home do app'
      when l_banner.ends_at is not null and l_banner.ends_at <= now()
        then 'exibição já encerrada; não aparece até mudar as datas'
      when l_banner.starts_at is not null and l_banner.starts_at > now()
        then 'agendado: ' || public.showcase_window_text(l_banner.starts_at, l_banner.ends_at)
      else 'destino indisponível; não aparece até trocar o destino'
    end
  );
end;
$$;

-- `p_ids`: todos os banners, na ordem nova. Lista incompleta ou velha é
-- recusada, para duas pessoas reordenando ao mesmo tempo não se atropelarem.
create function public.admin_reorder_banners(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_total integer;
  l_changed integer;
  l_order text;
begin
  perform public.admin_require(array['operations']::public.platform_role[]);

  perform 1 from public.showcase_banners for update;
  select count(*) into l_total from public.showcase_banners;

  if p_ids is null
     or cardinality(p_ids) <> l_total
     or (select count(distinct x) from unnest(p_ids) as x) <> l_total
     or exists (
       select 1 from unnest(p_ids) as x
       where not exists (select 1 from public.showcase_banners b where b.id = x)
     ) then
    raise exception 'A lista de banners mudou desde que a tela abriu. Recarregue e tente de novo.'
      using errcode = 'P0001';
  end if;

  with wanted as (
    select x as id, ord::integer as sort_order
    from unnest(p_ids) with ordinality as t (x, ord)
  )
  update public.showcase_banners b
  set sort_order = w.sort_order
  from wanted w
  where b.id = w.id and b.sort_order is distinct from w.sort_order;
  get diagnostics l_changed = row_count;

  if l_changed = 0 then
    return;
  end if;

  select string_agg(b.sort_order || '. ' || b.title, ' · ' order by b.sort_order)
  into l_order
  from public.showcase_banners b;

  perform public.admin_write_audit('Reordenou os banners da vitrine', l_order);
end;
$$;

-- Devolve o caminho da imagem: o navegador apaga o arquivo no Storage depois.
create function public.admin_delete_banner(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_banner public.showcase_banners;
begin
  perform public.admin_require(array['operations']::public.platform_role[]);

  select * into l_banner from public.showcase_banners where id = p_id for update;
  if not found then
    raise exception 'Banner não encontrado.' using errcode = 'P0002';
  end if;

  perform public.admin_write_audit(
    'Removeu o banner "' || l_banner.title || '" da vitrine',
    public.showcase_target_label(l_banner) || ' · '
      || case when public.showcase_is_live(l_banner) then 'estava no ar' else 'não estava no ar' end
  );

  delete from public.showcase_banners where id = l_banner.id;
  return l_banner.image_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões das funções do admin desta migration
-- ---------------------------------------------------------------------------

revoke execute on function public.admin_showcase_banners() from public, anon;
revoke execute on function public.admin_save_banner(
  text, text, text, public.showcase_target, text, uuid, timestamptz, timestamptz
) from public, anon;
revoke execute on function public.admin_set_banner_active(uuid, boolean) from public, anon;
revoke execute on function public.admin_reorder_banners(uuid[]) from public, anon;
revoke execute on function public.admin_delete_banner(uuid) from public, anon;

grant execute on function public.admin_showcase_banners() to authenticated, service_role;
grant execute on function public.admin_save_banner(
  text, text, text, public.showcase_target, text, uuid, timestamptz, timestamptz
) to authenticated, service_role;
grant execute on function public.admin_set_banner_active(uuid, boolean) to authenticated, service_role;
grant execute on function public.admin_reorder_banners(uuid[]) to authenticated, service_role;
grant execute on function public.admin_delete_banner(uuid) to authenticated, service_role;
