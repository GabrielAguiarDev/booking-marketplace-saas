-- ---------------------------------------------------------------------------
-- Equipe e acessos do painel administrativo
-- ---------------------------------------------------------------------------
-- Até aqui incluir alguém na equipe ou mudar o papel exigia SQL direto em
-- `platform_admins`. Agora:
--
-- * convidar: a Edge Function `admin-invite` cria a conta pela Admin API do
--   Auth (precisa da secret key, por isso não é RPC) e depois chama
--   `admin_add_team_member` com o JWT de quem convidou — assim a auditoria sai
--   em nome da pessoa certa, na mesma transação da concessão;
-- * mudar papel e remover: `admin_set_team_role` e `admin_remove_team_member`.
--
-- Regras, conferidas no banco e não só na tela:
--
-- 1. Só o papel `admin` gerencia a equipe. `admin_require` é chamado (é por ele
--    que passam as regras gerais de acesso), mas o papel é conferido de novo,
--    explicitamente, depois de travar as linhas: `admin_require` trata `admin`
--    como curinga de qualquer lista, e aqui a regra é "somente admin", não
--    "admin ou quem estiver na lista" (ver `admin_require_team_admin`).
-- 2. Ninguém muda o próprio papel nem remove a si mesmo.
-- 3. Sempre sobra ao menos um `admin`. As linhas de `admin` são travadas antes
--    da checagem: dois admins rebaixando um ao outro ao mesmo tempo não deixam
--    a plataforma sem ninguém — o segundo espera o primeiro e é recusado.
--
-- Convite pendente não precisa de tabela própria: a conta convidada já existe
-- em `auth.users` com `invited_at` preenchido e `email_confirmed_at` vazio até
-- a pessoa aceitar. `admin_team` passa a devolver esse estado.

-- Nome do papel como aparece na tela e na auditoria.
create function public.admin_role_label(p_role public.platform_role)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'admin' then 'Administrador da plataforma'
    when 'operations' then 'Operações e moderação'
    when 'finance' then 'Financeiro'
    when 'support' then 'Suporte'
  end;
$$;

revoke execute on function public.admin_role_label(public.platform_role) from public, anon, authenticated, service_role;

-- Porta de entrada das escritas da equipe. Trava as linhas de `admin` (a regra
-- do "ao menos um admin" depende delas) e só então confere o papel de quem
-- chama, para ler o papel já depois de qualquer rebaixamento concorrente.
create function public.admin_require_team_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_require(array['admin']::public.platform_role[]);

  perform 1 from public.platform_admins where role = 'admin' for update;

  if not exists (
    select 1 from public.platform_admins
    where user_id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'Só quem é administrador da plataforma gerencia a equipe.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.admin_require_team_admin() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Leitura
-- ---------------------------------------------------------------------------
-- A assinatura de retorno muda (convite pendente), então `create or replace`
-- não serve: drop e create.

drop function public.admin_team();

create function public.admin_team()
returns table (
  id uuid,
  name text,
  email text,
  role public.platform_role,
  last_seen_at timestamptz,
  pending boolean,
  invited_at timestamptz
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
      pa.user_id,
      coalesce(nullif(p.full_name, ''), u.email::text),
      u.email::text,
      pa.role,
      pa.last_seen_at,
      u.invited_at is not null and u.email_confirmed_at is null,
      u.invited_at
    from public.platform_admins pa
    join public.profiles p on p.id = pa.user_id
    join auth.users u on u.id = pa.user_id
    order by pa.role, p.full_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Escrita
-- ---------------------------------------------------------------------------

-- Concede um papel a uma conta existente, achada pelo e-mail. Quem cria a
-- conta nova é a Edge Function `admin-invite`; ela avisa em `p_invited` se o
-- e-mail de convite saiu, e isso muda o texto da auditoria.
--
-- Reenviar um convite ainda não aceito cai aqui também: a pessoa já está na
-- equipe, o Auth mandou o e-mail de novo, e o papel pedido passa a valer.
create function public.admin_add_team_member(
  p_email text,
  p_name text,
  p_role public.platform_role,
  p_invited boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_email text := lower(btrim(coalesce(p_email, '')));
  l_name text := nullif(btrim(coalesce(p_name, '')), '');
  l_user_id uuid;
  l_pending boolean;
  l_current public.platform_role;
  l_label text;
begin
  perform public.admin_require_team_admin();

  if p_role is null then
    raise exception 'Escolha o papel da pessoa.' using errcode = 'P0001';
  end if;
  if l_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = 'P0001';
  end if;
  if l_name is not null and char_length(l_name) > 120 then
    raise exception 'O nome pode ter até 120 caracteres.' using errcode = 'P0001';
  end if;

  select u.id, u.invited_at is not null and u.email_confirmed_at is null
  into l_user_id, l_pending
  from auth.users u
  where lower(u.email) = l_email;

  if l_user_id is null then
    raise exception 'Nenhuma conta usa o e-mail %.', l_email using errcode = 'P0002';
  end if;

  -- O gatilho do signup já cria o perfil; uma conta antiga pode não ter nome.
  insert into public.profiles (id, full_name)
  values (l_user_id, l_name)
  on conflict (id) do update
    set full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

  select coalesce(nullif(p.full_name, ''), l_email) into l_label
  from public.profiles p
  where p.id = l_user_id;

  select role into l_current
  from public.platform_admins
  where user_id = l_user_id;

  if found then
    if not (p_invited and l_pending) then
      raise exception '% já faz parte da equipe como %. Para mudar o acesso, troque o papel na lista.',
        l_label, public.admin_role_label(l_current)
        using errcode = '23505';
    end if;

    update public.platform_admins set role = p_role where user_id = l_user_id;

    perform public.admin_write_audit(
      'Reenviou o convite da equipe a ' || l_label,
      l_email || ' · papel: ' || public.admin_role_label(p_role)
        || case when l_current <> p_role
             then ' (antes ' || public.admin_role_label(l_current) || ')'
             else '' end
    );
    return l_user_id;
  end if;

  insert into public.platform_admins (user_id, role) values (l_user_id, p_role);

  perform public.admin_write_audit(
    case when p_invited
      then 'Convidou ' || l_label || ' para a equipe'
      else 'Incluiu ' || l_label || ' na equipe'
    end,
    'papel: ' || public.admin_role_label(p_role) || ' · '
      || case when p_invited
           then 'convite enviado para ' || l_email
           else 'conta já existente (' || l_email || '), entra com a senha que já usa'
         end
  );

  return l_user_id;
end;
$$;

create function public.admin_set_team_role(p_user_id uuid, p_role public.platform_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_current public.platform_role;
  l_label text;
begin
  perform public.admin_require_team_admin();

  if p_role is null then
    raise exception 'Escolha o novo papel.' using errcode = 'P0001';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Você não pode mudar o próprio papel. Peça a outra pessoa administradora.'
      using errcode = '42501';
  end if;

  select pa.role, coalesce(nullif(p.full_name, ''), u.email::text)
  into l_current, l_label
  from public.platform_admins pa
  join public.profiles p on p.id = pa.user_id
  join auth.users u on u.id = pa.user_id
  where pa.user_id = p_user_id;

  if not found then
    raise exception 'Esta pessoa não faz parte da equipe.' using errcode = 'P0002';
  end if;
  if l_current = p_role then
    raise exception '% já tem o papel %.', l_label, public.admin_role_label(p_role)
      using errcode = 'P0001';
  end if;
  if l_current = 'admin' and not exists (
    select 1 from public.platform_admins
    where role = 'admin' and user_id <> p_user_id
  ) then
    raise exception 'A plataforma precisa de ao menos uma pessoa administradora.'
      using errcode = 'P0001';
  end if;

  update public.platform_admins set role = p_role where user_id = p_user_id;

  perform public.admin_write_audit(
    'Mudou o papel de ' || l_label || ' na equipe',
    public.admin_role_label(l_current) || ' → ' || public.admin_role_label(p_role)
  );
end;
$$;

-- Tira a pessoa da equipe. A conta do Auth continua existindo (pode ser cliente
-- ou dona de loja) — só perde o acesso ao painel.
create function public.admin_remove_team_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_current public.platform_role;
  l_label text;
  l_email text;
  l_pending boolean;
begin
  perform public.admin_require_team_admin();

  if p_user_id = (select auth.uid()) then
    raise exception 'Você não pode remover a si mesmo da equipe. Peça a outra pessoa administradora.'
      using errcode = '42501';
  end if;

  select pa.role, coalesce(nullif(p.full_name, ''), u.email::text), u.email::text,
    u.invited_at is not null and u.email_confirmed_at is null
  into l_current, l_label, l_email, l_pending
  from public.platform_admins pa
  join public.profiles p on p.id = pa.user_id
  join auth.users u on u.id = pa.user_id
  where pa.user_id = p_user_id;

  if not found then
    raise exception 'Esta pessoa não faz parte da equipe.' using errcode = 'P0002';
  end if;
  if l_current = 'admin' and not exists (
    select 1 from public.platform_admins
    where role = 'admin' and user_id <> p_user_id
  ) then
    raise exception 'A plataforma precisa de ao menos uma pessoa administradora.'
      using errcode = 'P0001';
  end if;

  delete from public.platform_admins where user_id = p_user_id;

  perform public.admin_write_audit(
    'Removeu ' || l_label || ' da equipe',
    l_email || ' · papel anterior: ' || public.admin_role_label(l_current)
      || case when l_pending then ' · convite ainda não aceito' else '' end
      || ' · a conta continua existindo, sem acesso ao painel'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
-- O `grant` em laço da migration do painel só cobriu as funções dela.

revoke execute on function public.admin_team() from public, anon;
grant execute on function public.admin_team() to authenticated, service_role;

revoke execute on function public.admin_add_team_member(text, text, public.platform_role, boolean) from public, anon;
grant execute on function public.admin_add_team_member(text, text, public.platform_role, boolean) to authenticated, service_role;

revoke execute on function public.admin_set_team_role(uuid, public.platform_role) from public, anon;
grant execute on function public.admin_set_team_role(uuid, public.platform_role) to authenticated, service_role;

revoke execute on function public.admin_remove_team_member(uuid) from public, anon;
grant execute on function public.admin_remove_team_member(uuid) to authenticated, service_role;
