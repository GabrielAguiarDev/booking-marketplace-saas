-- ---------------------------------------------------------------------------
-- Onboarding da loja (portal, P2)
-- ---------------------------------------------------------------------------
-- A loja nasce pelo portal: a Edge Function `create-establishment` confere o
-- JWT e chama `create_establishment_application` com a service key. Não há
-- política de INSERT em `establishments` (foundation) e continua não havendo:
-- a função abaixo só é executável por service_role.
--
-- Quando a plataforma pede correção (`admin_decide_application(…,
-- 'correction', …)`), o dono corrige e reenvia por
-- `resubmit_establishment_application`. O reenvio grava `submitted_at = now()`,
-- e é isso que devolve a loja à fila de Aprovações: `admin_applications()` só
-- esconde a loja pendente enquanto houver correção pedida depois do último
-- envio.
--
-- As regras de preenchimento moram numa função só
-- (`establishment_application_normalize`), usada pelos dois caminhos. A tela
-- não repete as regras; ela mostra a mensagem que volta daqui, e o campo vem
-- no `hint` do erro.

-- ---------------------------------------------------------------------------
-- Cidade do cadastro
-- ---------------------------------------------------------------------------
-- MVP sem localidade: o dono não escolhe cidade nem vê cidade no portal. A
-- cidade é necessária no dado (cota, preço, busca do app), então é inferida.
--
-- Regra de hoje: se só uma cidade está em operação (`launch_status =
-- 'active'`), é ela; se houver mais de uma, a que tem mais lojas ativas — onde
-- a operação de fato acontece —, com desempate pelo nome.
--
-- EXPANSÃO: quando houver mais de uma praça de verdade, esta regra deixa de
-- servir. Troque só esta função — pelo CEP do endereço, por geolocalização ou
-- por uma pergunta no formulário — e nada mais precisa mudar. O admin continua
-- vendo (e conferindo) a cidade na fila de Aprovações.
create function public.resolve_signup_city()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.cities c
  where c.is_active
    and c.launch_status = 'active'
  order by
    (select count(*) from public.establishments e where e.city_id = c.id and e.status = 'active') desc,
    c.name
  limit 1;
$$;

revoke execute on function public.resolve_signup_city() from public, anon, authenticated;
grant execute on function public.resolve_signup_city() to service_role;

-- ---------------------------------------------------------------------------
-- Validação do cadastro
-- ---------------------------------------------------------------------------

-- CNPJ com dígito verificador, já no formato alfanumérico (Receita, jul/2026):
-- os 12 primeiros caracteres podem ser letra ou número; cada caractere vale o
-- código ASCII menos 48 (dígitos continuam valendo 0–9). Os dois últimos são
-- sempre dígitos. Devolve o CNPJ formatado, ou null se for inválido.
create function public.normalize_cnpj(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  l_raw text := upper(regexp_replace(coalesce(p_value, ''), '[\s./-]', '', 'g'));
  l_weights1 int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  l_weights2 int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  l_sum int;
  l_dv1 int;
  l_dv2 int;
begin
  if l_raw !~ '^[0-9A-Z]{12}[0-9]{2}$' or l_raw ~ '^(.)\1{13}$' then
    return null;
  end if;

  l_sum := 0;
  for i in 1..12 loop
    l_sum := l_sum + (ascii(substr(l_raw, i, 1)) - 48) * l_weights1[i];
  end loop;
  l_dv1 := case when l_sum % 11 < 2 then 0 else 11 - l_sum % 11 end;

  l_sum := 0;
  for i in 1..13 loop
    l_sum := l_sum + (ascii(substr(l_raw, i, 1)) - 48) * l_weights2[i];
  end loop;
  l_dv2 := case when l_sum % 11 < 2 then 0 else 11 - l_sum % 11 end;

  if substr(l_raw, 13, 1)::int <> l_dv1 or substr(l_raw, 14, 1)::int <> l_dv2 then
    return null;
  end if;

  return substr(l_raw, 1, 2) || '.' || substr(l_raw, 3, 3) || '.' || substr(l_raw, 6, 3)
    || '/' || substr(l_raw, 9, 4) || '-' || substr(l_raw, 13, 2);
end;
$$;

revoke execute on function public.normalize_cnpj(text) from public, anon;
grant execute on function public.normalize_cnpj(text) to authenticated, service_role;

-- Confere e normaliza o cadastro. Cada erro é uma frase para a tela, com o
-- campo no `hint` (PostgREST devolve os dois) e código P0001; CNPJ repetido
-- sai como 23505.
--
-- Entrada (jsonb): name, category, cnpj, legal_name, responsible_name,
-- contact_email, phone, address_line, neighborhood e services — lista de
-- { id?, name, duration_minutes, price_cents }. `p_establishment_id` é a loja
-- que está sendo corrigida (fica fora da checagem de CNPJ repetido).
create function public.establishment_application_normalize(
  p_application jsonb,
  p_establishment_id uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  l_app jsonb := coalesce(p_application, '{}'::jsonb);
  l_name text := btrim(coalesce(l_app ->> 'name', ''));
  l_category_raw text := btrim(coalesce(l_app ->> 'category', ''));
  l_category public.establishment_category;
  l_cnpj text := public.normalize_cnpj(l_app ->> 'cnpj');
  l_legal_name text := btrim(coalesce(l_app ->> 'legal_name', ''));
  l_responsible text := btrim(coalesce(l_app ->> 'responsible_name', ''));
  l_email text := lower(btrim(coalesce(l_app ->> 'contact_email', '')));
  l_phone text := regexp_replace(coalesce(l_app ->> 'phone', ''), '\D', '', 'g');
  l_address text := btrim(coalesce(l_app ->> 'address_line', ''));
  l_neighborhood text := btrim(coalesce(l_app ->> 'neighborhood', ''));
  l_services jsonb := l_app -> 'services';
  l_out_services jsonb := '[]'::jsonb;
  l_service jsonb;
  l_service_name text;
  l_service_id text;
  l_duration int;
  l_price int;
  l_names text[] := array[]::text[];
  l_position int := 0;
begin
  if jsonb_typeof(l_app) <> 'object' then
    raise exception 'Cadastro inválido.' using errcode = 'P0001';
  end if;

  if char_length(l_name) < 2 or char_length(l_name) > 80 then
    raise exception 'Informe o nome da loja (de 2 a 80 caracteres).' using errcode = 'P0001', hint = 'name';
  end if;

  if l_category_raw = '' or not l_category_raw = any (enum_range(null::public.establishment_category)::text[]) then
    raise exception 'Escolha a categoria da loja.' using errcode = 'P0001', hint = 'category';
  end if;
  l_category := l_category_raw::public.establishment_category;

  if l_cnpj is null then
    raise exception 'CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.'
      using errcode = 'P0001', hint = 'cnpj';
  end if;
  if exists (
    select 1 from public.establishments e
    where e.cnpj = l_cnpj
      and e.status <> 'rejected'
      and e.id is distinct from p_establishment_id
  ) then
    raise exception 'Já existe uma loja cadastrada com este CNPJ.' using errcode = '23505', hint = 'cnpj';
  end if;

  if char_length(l_legal_name) < 2 or char_length(l_legal_name) > 150 then
    raise exception 'Informe a razão social como está no CNPJ.' using errcode = 'P0001', hint = 'legal_name';
  end if;

  if char_length(l_responsible) < 2 or char_length(l_responsible) > 120 then
    raise exception 'Informe o nome de quem responde pela loja.' using errcode = 'P0001', hint = 'responsible_name';
  end if;

  if l_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(l_email) > 254 then
    raise exception 'Informe um e-mail de contato válido.' using errcode = 'P0001', hint = 'contact_email';
  end if;

  -- DDD + número; aceita com o 55 do país na frente.
  if char_length(l_phone) in (12, 13) and left(l_phone, 2) = '55' then
    l_phone := substr(l_phone, 3);
  end if;
  if l_phone !~ '^[1-9][1-9][0-9]{8,9}$' then
    raise exception 'Informe o telefone com DDD.' using errcode = 'P0001', hint = 'phone';
  end if;
  l_phone := '(' || left(l_phone, 2) || ') '
    || case when char_length(l_phone) = 11
         then substr(l_phone, 3, 5) || '-' || substr(l_phone, 8)
         else substr(l_phone, 3, 4) || '-' || substr(l_phone, 7)
       end;

  if char_length(l_address) < 5 or char_length(l_address) > 200 then
    raise exception 'Informe o endereço: rua e número.' using errcode = 'P0001', hint = 'address_line';
  end if;

  if char_length(l_neighborhood) < 2 or char_length(l_neighborhood) > 80 then
    raise exception 'Informe o bairro.' using errcode = 'P0001', hint = 'neighborhood';
  end if;

  if l_services is null or jsonb_typeof(l_services) <> 'array' or jsonb_array_length(l_services) = 0 then
    raise exception 'Cadastre ao menos um serviço que a loja vai oferecer.' using errcode = 'P0001', hint = 'services';
  end if;
  if jsonb_array_length(l_services) > 30 then
    raise exception 'Cadastre até 30 serviços agora; o resto dá para incluir depois.' using errcode = 'P0001', hint = 'services';
  end if;

  for l_service in select value from jsonb_array_elements(l_services) loop
    l_position := l_position + 1;
    if jsonb_typeof(l_service) <> 'object' then
      raise exception 'Serviço % inválido.', l_position using errcode = 'P0001', hint = 'services';
    end if;

    l_service_name := btrim(coalesce(l_service ->> 'name', ''));
    if char_length(l_service_name) < 2 or char_length(l_service_name) > 80 then
      raise exception 'Dê um nome ao serviço %.', l_position using errcode = 'P0001', hint = 'services';
    end if;
    if lower(l_service_name) = any (l_names) then
      raise exception 'O serviço "%" aparece duas vezes.', l_service_name using errcode = 'P0001', hint = 'services';
    end if;
    l_names := l_names || lower(l_service_name);

    if jsonb_typeof(l_service -> 'duration_minutes') <> 'number' then
      raise exception 'Informe a duração de "%".', l_service_name using errcode = 'P0001', hint = 'services';
    end if;
    l_duration := (l_service ->> 'duration_minutes')::numeric;
    if l_duration < 5 or l_duration > 480 then
      raise exception 'A duração de "%" precisa ficar entre 5 minutos e 8 horas.', l_service_name
        using errcode = 'P0001', hint = 'services';
    end if;

    if jsonb_typeof(l_service -> 'price_cents') <> 'number' then
      raise exception 'Informe o preço de "%".', l_service_name using errcode = 'P0001', hint = 'services';
    end if;
    l_price := (l_service ->> 'price_cents')::numeric;
    if l_price < 0 or l_price > 10000000 then
      raise exception 'O preço de "%" precisa ficar entre R$ 0 e R$ 100.000.', l_service_name
        using errcode = 'P0001', hint = 'services';
    end if;

    l_service_id := nullif(btrim(coalesce(l_service ->> 'id', '')), '');
    if l_service_id is not null
       and l_service_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception 'Serviço % inválido.', l_position using errcode = 'P0001', hint = 'services';
    end if;

    l_out_services := l_out_services || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', l_service_id,
      'name', l_service_name,
      'duration_minutes', l_duration,
      'price_cents', l_price
    )));
  end loop;

  return jsonb_build_object(
    'name', l_name,
    'category', l_category,
    'cnpj', l_cnpj,
    'legal_name', l_legal_name,
    'responsible_name', l_responsible,
    'contact_email', l_email,
    'phone', l_phone,
    'address_line', l_address,
    'neighborhood', l_neighborhood,
    'services', l_out_services
  );
end;
$$;

revoke execute on function public.establishment_application_normalize(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.establishment_application_normalize(jsonb, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Criação (só pela Edge Function)
-- ---------------------------------------------------------------------------
-- Loja, vínculo de dono e serviços numa transação só: ou nasce inteira, ou não
-- nasce. Status `pending` explícito — a decisão 0008 vale desde o primeiro
-- segundo: quem aprova é a plataforma.
create function public.create_establishment_application(p_owner uuid, p_application jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  l_app jsonb;
  l_city uuid;
  l_base text;
  l_slug text;
  l_suffix int := 1;
  l_id uuid;
begin
  if p_owner is null or not exists (select 1 from public.profiles p where p.id = p_owner) then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;

  -- Duas abas enviando juntas não criam duas lojas.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signup:' || p_owner::text, 0));

  -- Um cadastro em análise por dono. Loja ativa não impede uma segunda unidade.
  if exists (
    select 1
    from public.establishment_members m
    join public.establishments e on e.id = m.establishment_id
    where m.user_id = p_owner and m.role = 'owner' and e.status = 'pending'
  ) then
    raise exception 'Você já tem um cadastro em análise. Aguarde a resposta da equipe do Vez.'
      using errcode = '23505';
  end if;

  l_app := public.establishment_application_normalize(p_application, null);

  l_city := public.resolve_signup_city();
  if l_city is null then
    raise exception 'O Vez ainda não está recebendo cadastros.' using errcode = 'P0001';
  end if;

  l_base := regexp_replace(
    lower(translate(
      l_app ->> 'name',
      'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
    )),
    '[^a-z0-9]+', '-', 'g'
  );
  l_base := left(btrim(l_base, '-'), 60);
  l_base := btrim(l_base, '-');
  if l_base = '' then
    l_base := 'loja';
  end if;
  l_slug := l_base;
  while exists (select 1 from public.establishments e where e.slug = l_slug) loop
    l_suffix := l_suffix + 1;
    l_slug := l_base || '-' || l_suffix;
  end loop;

  insert into public.establishments (
    city_id, name, slug, category, status, phone, cnpj, legal_name,
    responsible_name, contact_email, address_line, neighborhood, submitted_at
  )
  values (
    l_city,
    l_app ->> 'name',
    l_slug,
    (l_app ->> 'category')::public.establishment_category,
    'pending',
    l_app ->> 'phone',
    l_app ->> 'cnpj',
    l_app ->> 'legal_name',
    l_app ->> 'responsible_name',
    l_app ->> 'contact_email',
    l_app ->> 'address_line',
    l_app ->> 'neighborhood',
    now()
  )
  returning id into l_id;

  insert into public.establishment_members (user_id, establishment_id, role)
  values (p_owner, l_id, 'owner');

  insert into public.services (establishment_id, name, duration_minutes, price_cents, sort_order)
  select l_id, s ->> 'name', (s ->> 'duration_minutes')::int, (s ->> 'price_cents')::int, (n - 1)::int
  from jsonb_array_elements(l_app -> 'services') with ordinality as t(s, n);

  return l_id;
end;
$$;

revoke execute on function public.create_establishment_application(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_establishment_application(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Reenvio depois de "pedir correção"
-- ---------------------------------------------------------------------------
-- Só o dono, só a própria loja, só em `pending` e só quando há correção pedida
-- depois do último envio — o mesmo predicado que tira a loja da fila em
-- `admin_applications()`. Reenviar sem correção pedida seria só furar a ordem
-- da fila.
--
-- Serviços: os que vêm com `id` são atualizados; os novos, criados; os que
-- saíram da lista, apagados — ou desativados, se alguma reserva já apontar
-- para eles (a FK de `appointments` é restrict).
create function public.resubmit_establishment_application(
  p_establishment_id uuid,
  p_application jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_est public.establishments;
  l_app jsonb;
  l_ids uuid[];
  l_now timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception 'Entre na sua conta para reenviar o cadastro.' using errcode = '42501';
  end if;

  if not public.has_establishment_role(p_establishment_id, array['owner']::public.establishment_role[]) then
    raise exception 'Só o dono da loja reenvia o cadastro.' using errcode = '42501';
  end if;

  select * into l_est from public.establishments where id = p_establishment_id for update;
  if not found then
    raise exception 'Cadastro não encontrado.' using errcode = 'P0002';
  end if;
  if l_est.status <> 'pending' then
    raise exception 'Este cadastro não está mais em análise.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.establishment_decisions d
    where d.establishment_id = l_est.id
      and d.decision = 'correction'
      and d.decided_at >= l_est.submitted_at
  ) then
    raise exception 'Não há correção pedida: o cadastro já está na fila de análise.' using errcode = 'P0001';
  end if;

  l_app := public.establishment_application_normalize(p_application, l_est.id);

  select coalesce(array_agg((s ->> 'id')::uuid), array[]::uuid[]) into l_ids
  from jsonb_array_elements(l_app -> 'services') s
  where s ? 'id';

  if exists (
    select 1 from unnest(l_ids) as i(id)
    where not exists (
      select 1 from public.services sv where sv.id = i.id and sv.establishment_id = l_est.id
    )
  ) then
    raise exception 'Um dos serviços não pertence a esta loja.' using errcode = 'P0001', hint = 'services';
  end if;

  update public.establishments set
    name = l_app ->> 'name',
    category = (l_app ->> 'category')::public.establishment_category,
    cnpj = l_app ->> 'cnpj',
    legal_name = l_app ->> 'legal_name',
    responsible_name = l_app ->> 'responsible_name',
    contact_email = l_app ->> 'contact_email',
    phone = l_app ->> 'phone',
    address_line = l_app ->> 'address_line',
    neighborhood = l_app ->> 'neighborhood',
    submitted_at = l_now
  where id = l_est.id;

  delete from public.services sv
  where sv.establishment_id = l_est.id
    and sv.id <> all (l_ids)
    and not exists (select 1 from public.appointments a where a.service_id = sv.id);

  update public.services sv set is_active = false
  where sv.establishment_id = l_est.id
    and sv.id <> all (l_ids);

  update public.services sv set
    name = s.value ->> 'name',
    duration_minutes = (s.value ->> 'duration_minutes')::int,
    price_cents = (s.value ->> 'price_cents')::int,
    sort_order = (s.ordinality - 1)::int,
    is_active = true
  from jsonb_array_elements(l_app -> 'services') with ordinality as s(value, ordinality)
  where s.value ? 'id'
    and sv.id = (s.value ->> 'id')::uuid;

  insert into public.services (establishment_id, name, duration_minutes, price_cents, sort_order)
  select l_est.id, s.value ->> 'name', (s.value ->> 'duration_minutes')::int,
    (s.value ->> 'price_cents')::int, (s.ordinality - 1)::int
  from jsonb_array_elements(l_app -> 'services') with ordinality as s(value, ordinality)
  where not s.value ? 'id';

  return l_now;
end;
$$;

revoke execute on function public.resubmit_establishment_application(uuid, jsonb) from public, anon;
grant execute on function public.resubmit_establishment_application(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- `submitted_at` só muda pelo reenvio
-- ---------------------------------------------------------------------------
-- A fila de Aprovações é ordenada por `submitted_at`, e a correção pedida só
-- conta se for posterior a ele. Como `establishments_update_manager` não
-- distingue coluna, um dono podia recuar a data para furar a fila, ou
-- avançá-la para voltar à fila sem corrigir nada. Mesmo gatilho da decisão
-- 0008, com uma coluna a mais; o resto do corpo é o de
-- `20260910121000_admin_platform.sql`. (Quem trocar este gatilho de novo:
-- preserve a linha de `submitted_at`.)
create or replace function public.guard_establishment_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  l_privileged boolean :=
    current_user = 'postgres'
    or current_setting('role', true) = 'service_role'
    ;
begin
  if not l_privileged and (
    new.status is distinct from old.status
    or new.plan_id is distinct from old.plan_id
    or new.plan_changed_at is distinct from old.plan_changed_at
    or new.discount_percent is distinct from old.discount_percent
    or new.discount_until is distinct from old.discount_until
    or new.status_reason is distinct from old.status_reason
  ) then
    raise exception 'situação, plano e desconto do estabelecimento só mudam por admin da plataforma'
      using errcode = '42501';
  end if;

  if not l_privileged and new.submitted_at is distinct from old.submitted_at then
    raise exception 'a data de envio do cadastro só muda pelo reenvio depois de uma correção'
      using errcode = '42501';
  end if;

  -- carimbo de quando a situação mudou: ninguém escreve à mão
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    new.status_changed_at := old.status_changed_at;
  end if;

  -- A primeira atribuição (aprovação, backfill) não é troca: o intervalo mínimo
  -- entre trocas não pode impedir de corrigir o plano logo depois de aprovar.
  if new.plan_id is distinct from old.plan_id then
    new.plan_changed_at := case when old.plan_id is null then null else now() end;
  else
    new.plan_changed_at := old.plan_changed_at;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Horário de funcionamento visível para a própria loja
-- ---------------------------------------------------------------------------
-- `business_hours` só tinha leitura pública (loja ativa). Uma loja pendente ou
-- suspensa não enxergava o próprio horário, e o "Primeiros passos" diria que
-- ele falta mesmo cadastrado.
create policy business_hours_select_member
  on public.business_hours for select
  to authenticated
  using (public.is_establishment_member(establishment_id));
