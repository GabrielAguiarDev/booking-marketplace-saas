-- ---------------------------------------------------------------------------
-- Cadastro e negócio no portal da loja (P6)
-- ---------------------------------------------------------------------------
-- O portal já lia serviço, profissional, jornada e regra; o que faltava era
-- editar. Quase tudo disso já tinha política de escrita para dono e gerente
-- (`services_write_manager`, `professionals_write_manager`,
-- `business_hours_write_manager`, `professional_schedules_write_manager`,
-- `schedule_exceptions_write_member`, `establishment_settings_write_manager`),
-- então esta migration não cria tabela nenhuma. Ela entrega as duas coisas que
-- faltavam para a edição ser honesta:
--
--   1. A resposta da regra R9 — "mudar a agenda não invalida venda em
--      silêncio". Quem fecha a quarta-feira ou encurta a jornada precisa ver,
--      ANTES de salvar, quais reservas já vendidas ficam fora do novo desenho.
--      Isso é uma pergunta sobre a agenda, e por isso é respondida pelo
--      Postgres, junto de `available_slots()` — não por uma reimplementação em
--      TypeScript que erraria em fuso, turno e reserva que cruza a meia-noite.
--
--   2. O envio de foto do perfil público. `establishment_photos` existia desde
--      o catálogo e nunca recebeu uma linha, porque não havia bucket. Sem isso
--      a loja aparece sem imagem no app do cliente.
--
-- Nada aqui mexe em plano, desconto ou cobrança: continuam sendo do admin
-- (gatilho `guard_establishment_status`) e do provedor de pagamento que ainda
-- não foi escolhido.

-- ---------------------------------------------------------------------------
-- R9: o que quebra se a agenda mudar
-- ---------------------------------------------------------------------------
-- As duas funções abaixo são `security definer` porque cruzam `appointments`,
-- `profiles` e `professionals` para montar uma frase legível ("Marcos Vieira,
-- Corte + barba, quinta às 19:30"). O portão é explícito e vem primeiro: só
-- dono ou gerente da própria loja pergunta. Leitura pura — nenhuma das duas
-- escreve nada, e nem podia: a decisão de salvar continua sendo de quem edita.

create function public.assert_establishment_manager(p_establishment_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_establishment_role(
    p_establishment_id,
    array['owner', 'manager']::public.establishment_role[]
  ) then
    raise exception 'apenas dono ou gerente da loja pode consultar isto'
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.assert_establishment_manager(uuid) is
  'Portão das consultas de cadastro do portal: levanta 42501 para quem não é dono nem gerente da loja.';

revoke execute on function public.assert_establishment_manager(uuid) from public, anon;
grant execute on function public.assert_establishment_manager(uuid) to authenticated, service_role;

-- `p_windows` é a jornada PROPOSTA, no formato [{"starts_at":"09:00","ends_at":"18:00"}].
-- Lista vazia significa "esse dia deixa de existir" — fechar a loja na quarta,
-- tirar a folga de alguém, desativar quem atende.
--
--   p_professional_id nulo  → funcionamento da loja (vale para todo mundo)
--   p_weekday nulo          → qualquer dia (desativar profissional)
--
-- Devolve só reserva viva e futura: o que já foi concluído, cancelado ou
-- faltou não "quebra" — e o passado não se conserta mudando a escala de agora.
create function public.schedule_change_impact(
  p_establishment_id uuid,
  p_professional_id uuid default null,
  p_weekday smallint default null,
  p_windows jsonb default '[]'::jsonb
)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  customer_name text,
  service_name text,
  professional_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_timezone text;
begin
  perform public.assert_establishment_manager(p_establishment_id);

  select e.timezone into l_timezone
  from public.establishments e
  where e.id = p_establishment_id;

  if l_timezone is null then
    return;
  end if;

  return query
  with proposed as (
    select
      (w->>'starts_at')::time as opens_at,
      (w->>'ends_at')::time as closes_at
    from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) as w
  ),
  live as (
    select
      a.id,
      a.starts_at,
      a.ends_at,
      a.status,
      coalesce(nullif(btrim(pr.full_name), ''), nullif(btrim(a.guest_name), ''), 'Cliente')
        as customer_name,
      s.name as service_name,
      p.display_name as professional_name,
      (a.starts_at at time zone l_timezone)::time as local_start,
      (a.ends_at at time zone l_timezone)::time as local_end,
      extract(dow from (a.starts_at at time zone l_timezone))::smallint as local_weekday
    from public.appointments a
      join public.services s on s.id = a.service_id
      join public.professionals p on p.id = a.professional_id
      left join public.profiles pr on pr.id = a.customer_id
    where a.establishment_id = p_establishment_id
      and a.status in ('scheduled', 'confirmed')
      and a.starts_at >= now()
      and (p_professional_id is null or a.professional_id = p_professional_id)
  )
  select
    live.id,
    live.starts_at,
    live.ends_at,
    live.status,
    live.customer_name,
    live.service_name,
    live.professional_name
  from live
  where (p_weekday is null or live.local_weekday = p_weekday)
    -- Cabe se existir um turno proposto que contenha a reserva inteira. A
    -- comparação `local_end > local_start` descarta o atendimento que cruza a
    -- meia-noite: ele nunca cabe num turno do mesmo dia, e sem esta linha
    -- passaria despercebido (00:30 é menor que qualquer hora de fechamento).
    and not exists (
      select 1 from proposed
      where live.local_end > live.local_start
        and live.local_start >= proposed.opens_at
        and live.local_end <= proposed.closes_at
    )
  order by live.starts_at;
end;
$$;

comment on function public.schedule_change_impact(uuid, uuid, smallint, jsonb) is
  'Regra R9: reservas vivas e futuras que ficariam fora da jornada proposta. Lista vazia significa que nada quebra.';

revoke execute on function public.schedule_change_impact(uuid, uuid, smallint, jsonb)
  from public, anon;
grant execute on function public.schedule_change_impact(uuid, uuid, smallint, jsonb)
  to authenticated, service_role;

-- Bloqueio pontual (`schedule_exceptions` com `is_available = false`): aqui a
-- pergunta se inverte — quebra quem ENCOSTA no período fechado, não quem sai
-- dele. Hora nula dos dois lados é o dia inteiro.
create function public.block_impact(
  p_establishment_id uuid,
  p_professional_id uuid,
  p_date date,
  p_starts_at time default null,
  p_ends_at time default null
)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  customer_name text,
  service_name text,
  professional_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_timezone text;
begin
  perform public.assert_establishment_manager(p_establishment_id);

  select e.timezone into l_timezone
  from public.establishments e
  where e.id = p_establishment_id;

  if l_timezone is null then
    return;
  end if;

  return query
  select
    a.id,
    a.starts_at,
    a.ends_at,
    a.status,
    coalesce(nullif(btrim(pr.full_name), ''), nullif(btrim(a.guest_name), ''), 'Cliente'),
    s.name,
    p.display_name
  from public.appointments a
    join public.services s on s.id = a.service_id
    join public.professionals p on p.id = a.professional_id
    left join public.profiles pr on pr.id = a.customer_id
  where a.establishment_id = p_establishment_id
    and a.status in ('scheduled', 'confirmed')
    and (p_professional_id is null or a.professional_id = p_professional_id)
    and (a.starts_at at time zone l_timezone)::date = p_date
    and (
      p_starts_at is null or p_ends_at is null
      or (
        (a.starts_at at time zone l_timezone)::time < p_ends_at
        and (a.ends_at at time zone l_timezone)::time > p_starts_at
      )
    )
  order by a.starts_at;
end;
$$;

comment on function public.block_impact(uuid, uuid, date, time, time) is
  'Regra R9: reservas vivas que caem dentro do período que se quer bloquear.';

revoke execute on function public.block_impact(uuid, uuid, date, time, time) from public, anon;
grant execute on function public.block_impact(uuid, uuid, date, time, time)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fotos do perfil público
-- ---------------------------------------------------------------------------
-- Bucket público pelo mesmo motivo do `showcase`: a imagem da loja é mostrada
-- no app do cliente antes de qualquer login, e URL assinada que expira faria a
-- vitrine piscar. O que é controlado é quem ESCREVE.
--
-- O caminho carrega a autorização: `<id da loja>/<arquivo>`. Sem isso, uma
-- política em `storage.objects` não teria como ligar o arquivo à loja — o
-- bucket é uma tabela só, compartilhada por todas elas.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'establishment-photos',
  'establishment-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- `storage.foldername(name)` devolve os diretórios do caminho; o primeiro é o
-- id da loja. `security definer` para poder ler `establishment_members` sem
-- depender da RLS de quem chama, e `stable` porque é lida dentro da política.
create function public.establishment_photo_can_write(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_folder text := (storage.foldername(p_object_name))[1];
  l_establishment_id uuid;
begin
  begin
    l_establishment_id := l_folder::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return public.has_establishment_role(
    l_establishment_id,
    array['owner', 'manager']::public.establishment_role[]
  );
end;
$$;

comment on function public.establishment_photo_can_write(text) is
  'Verdadeiro quando quem chama é dono ou gerente da loja nomeada na primeira pasta do caminho.';

revoke execute on function public.establishment_photo_can_write(text) from public, anon;
grant execute on function public.establishment_photo_can_write(text) to authenticated, service_role;

create policy establishment_photos_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'establishment-photos'
    and public.establishment_photo_can_write(name)
  );

create policy establishment_photos_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'establishment-photos'
    and public.establishment_photo_can_write(name)
  )
  with check (
    bucket_id = 'establishment-photos'
    and public.establishment_photo_can_write(name)
  );

create policy establishment_photos_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'establishment-photos'
    and public.establishment_photo_can_write(name)
  );

-- Listar o próprio bucket: a loja precisa ver o que já enviou. O arquivo em si
-- continua acessível pela URL pública para qualquer um, como o app exige.
create policy establishment_photos_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'establishment-photos'
    and public.establishment_photo_can_write(name)
  );

-- `establishment_photos.storage_path` passa a ter formato conhecido. A
-- restrição é o que garante que a política acima consiga ligar arquivo e loja:
-- um caminho fora do padrão ficaria órfão, visível no app e imune à política.
alter table public.establishment_photos
  add constraint establishment_photos_storage_path_format
  check (storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
