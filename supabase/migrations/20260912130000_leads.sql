-- Interessados da landing.
--
-- A landing é a única superfície que fala com quem ainda não é cliente, e o
-- formulário dela não gravava nada: o dono preenchia, via "Enviar" e nada
-- acontecia. Esta migration dá a ele um destino.
--
-- Quem escreve é `anon` — não há conta ainda —, e por isso a escrita não é uma
-- política de insert e sim uma RPC `security definer` com validação e freio
-- contra abuso. Uma política de insert para `anon` numa tabela de leads é um
-- formulário aberto para a internet inteira: sem validação de formato, sem
-- limite por número e sem como recusar o mesmo envio repetido.
--
-- Quem lê é a equipe da plataforma, pela RLS e pela RPC `admin_leads()`.

create type public.lead_status as enum ('new', 'contacted', 'discarded');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  establishment_name text not null check (char_length(establishment_name) between 2 and 120),
  -- O contato como a pessoa digitou, para a equipe ler e ligar…
  contact text not null check (char_length(contact) between 8 and 40),
  -- …e só os dígitos, normalizados, que é o que serve para achar repetido e
  -- segurar abuso. Coluna própria em vez de `regexp_replace` na consulta: com
  -- índice, o freio da RPC é uma busca, e não uma varredura da tabela inteira a
  -- cada envio.
  contact_digits text not null check (contact_digits ~ '^[0-9]{10,11}$'),
  category public.establishment_category,
  message text check (message is null or char_length(message) <= 1000),
  -- De onde veio. Hoje só a landing escreve; amanhã pode haver campanha.
  source text not null default 'landing' check (char_length(source) between 2 and 40),
  status public.lead_status not null default 'new',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  handled_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.leads is
  'Quem pediu contato pela landing. Escrita só por submit_lead; leitura pela equipe da plataforma.';

create index leads_queue_idx on public.leads (status, created_at desc);
create index leads_contact_idx on public.leads (contact_digits, created_at desc);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- Sem política de escrita: `submit_lead` é `security definer` e entra por fora.
-- A ausência é a regra, não um esquecimento.
create policy leads_select_admin
  on public.leads for select
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Escrita: o formulário da landing
-- ---------------------------------------------------------------------------

create function public.submit_lead(
  p_name text,
  p_establishment_name text,
  p_contact text,
  p_category public.establishment_category default null,
  p_message text default null,
  p_source text default 'landing'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text := btrim(coalesce(p_name, ''));
  l_establishment text := btrim(coalesce(p_establishment_name, ''));
  l_contact text := btrim(coalesce(p_contact, ''));
  l_message text := nullif(btrim(coalesce(p_message, '')), '');
  l_source text := nullif(btrim(coalesce(p_source, '')), '');
  l_digits text;
  l_recent public.leads;
  l_id uuid;
begin
  if char_length(l_name) < 2 then
    raise exception 'Escreva seu nome.' using errcode = 'P0001';
  end if;
  if char_length(l_name) > 80 then
    raise exception 'O nome vai até 80 caracteres.' using errcode = 'P0001';
  end if;
  if char_length(l_establishment) < 2 then
    raise exception 'Escreva o nome do estabelecimento.' using errcode = 'P0001';
  end if;
  if char_length(l_establishment) > 120 then
    raise exception 'O nome do estabelecimento vai até 120 caracteres.' using errcode = 'P0001';
  end if;

  l_digits := regexp_replace(l_contact, '[^0-9]', '', 'g');
  -- `+55 47 99999-0000` e `47 99999-0000` são a mesma pessoa. Sem derrubar o
  -- código do país, o freio abaixo cairia só em digitar o `+55` — que é o
  -- primeiro jeito que qualquer um encontra de mandar o mesmo número de novo.
  if l_digits ~ '^55[0-9]{10,11}$' then
    l_digits := substr(l_digits, 3);
  end if;
  -- 10 dígitos é DDD + fixo; 11, DDD + celular.
  if l_digits !~ '^[0-9]{10,11}$' then
    raise exception 'Informe um WhatsApp com DDD, como (47) 99999-0000.' using errcode = 'P0001';
  end if;
  if char_length(l_message) > 1000 then
    raise exception 'A mensagem vai até 1.000 caracteres.' using errcode = 'P0001';
  end if;

  -- Freio contra abuso, em duas camadas:
  --
  -- 1. O mesmo número mandando de novo em poucos minutos quase sempre é o
  --    dedo no botão duas vezes ou a página recarregada. Devolver o mesmo
  --    `id` em silêncio é mais honesto do que uma segunda linha na fila da
  --    equipe ou um erro na cara de quem não fez nada de errado.
  select * into l_recent
  from public.leads
  where contact_digits = l_digits
    and created_at >= now() - interval '10 minutes'
  order by created_at desc
  limit 1;
  if found then
    return l_recent.id;
  end if;

  -- 2. Passou dos dez minutos e já mandou três vezes no dia: aí é insistência
  --    ou robô, e a fila da equipe não é o lugar disso.
  if (
    select count(*) from public.leads
    where contact_digits = l_digits and created_at >= now() - interval '24 hours'
  ) >= 3 then
    raise exception 'Já recebemos seu contato. A equipe responde em até um dia útil.'
      using errcode = 'P0001';
  end if;

  insert into public.leads (
    name, establishment_name, contact, contact_digits, category, message, source
  ) values (
    l_name, l_establishment, l_contact, l_digits, p_category, l_message,
    coalesce(l_source, 'landing')
  )
  returning id into l_id;

  return l_id;
end;
$$;

-- `anon` é justamente quem chama: quem preenche a landing não tem conta.
revoke execute on function public.submit_lead(
  text, text, text, public.establishment_category, text, text
) from public;
grant execute on function public.submit_lead(
  text, text, text, public.establishment_category, text, text
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Leitura e triagem pela equipe da plataforma
-- ---------------------------------------------------------------------------

create function public.admin_leads()
returns table (
  id uuid,
  name text,
  establishment_name text,
  contact text,
  category public.establishment_category,
  message text,
  source text,
  status public.lead_status,
  handled_by text,
  handled_at timestamptz,
  handled_note text,
  created_at timestamptz,
  -- Quantas vezes este mesmo número já apareceu antes.
  previous_attempts integer
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
      l.id,
      l.name,
      l.establishment_name,
      l.contact,
      l.category,
      l.message,
      l.source,
      l.status,
      coalesce(nullif(p.full_name, ''), ''),
      l.handled_at,
      l.handled_note,
      l.created_at,
      (select count(*)::integer from public.leads o
        where o.contact_digits = l.contact_digits and o.created_at < l.created_at)
    from public.leads l
    left join public.profiles p on p.id = l.handled_by
    where l.created_at >= now() - interval '180 days'
    order by (l.status = 'new') desc, l.created_at desc;
end;
$$;

revoke execute on function public.admin_leads() from public, anon;
grant execute on function public.admin_leads() to authenticated, service_role;

-- Triagem: "falei com essa pessoa" ou "não era para nós". Sem isto a lista
-- nunca esvazia e a equipe perde a conta de quem já foi chamado.
create function public.admin_set_lead_status(
  p_lead_id uuid,
  p_status public.lead_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_lead public.leads;
  l_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform public.admin_require(array['operations']::public.platform_role[]);
  if p_status = 'discarded' and l_note is null then
    raise exception 'Escreva por que este contato foi descartado.' using errcode = 'P0001';
  end if;

  select * into l_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Contato não encontrado.' using errcode = 'P0002';
  end if;

  update public.leads
  set status = p_status,
      handled_by = case when p_status = 'new' then null else (select auth.uid()) end,
      handled_at = case when p_status = 'new' then null else now() end,
      handled_note = case when p_status = 'new' then null else l_note end
  where id = l_lead.id;

  perform public.admin_write_audit(
    case p_status
      when 'contacted' then 'Marcou como falado o contato de '
      when 'discarded' then 'Descartou o contato de '
      else 'Devolveu para a fila o contato de '
    end || l_lead.establishment_name,
    concat_ws(' · ', l_lead.name, l_lead.contact, l_note)
  );
end;
$$;

revoke execute on function public.admin_set_lead_status(uuid, public.lead_status, text)
  from public, anon;
grant execute on function public.admin_set_lead_status(uuid, public.lead_status, text)
  to authenticated, service_role;
