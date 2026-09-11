-- Segundo fator obrigatório no painel administrativo.
-- O Auth emite o claim `aal`; a autorização continua centralizada no banco,
-- portanto uma chamada direta à API também é recusada quando estiver em aal1.

alter table public.platform_settings
  add column admin_mfa_required boolean not null default true;

create or replace function public.admin_require(p_roles public.platform_role[] default null)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_role public.platform_role;
  l_mfa_required boolean;
begin
  select role into l_role
  from public.platform_admins
  where user_id = (select auth.uid());

  if not found then
    raise exception 'Acesso restrito à equipe da plataforma.' using errcode = '42501';
  end if;

  select coalesce(s.admin_mfa_required, true) into l_mfa_required
  from public.platform_settings s
  where s.id = true;

  if coalesce(l_mfa_required, true)
    and coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2'
  then
    raise exception 'Confirme o segundo fator para acessar o painel.' using errcode = 'PVMFA';
  end if;

  if l_role <> 'admin' and p_roles is not null and not (l_role = any (p_roles)) then
    raise exception 'Seu papel não permite esta ação administrativa.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.admin_require(public.platform_role[])
  from public, anon, authenticated, service_role;

-- Esta leitura é a única RPC administrativa que deliberadamente não passa por
-- admin_require: o Server Component precisa saber se deve pedir o segundo fator
-- antes de chamar as demais RPCs. Ainda assim, só membros da equipe a acessam.
create function public.admin_mfa_policy()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_required boolean;
begin
  if not exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  ) then
    raise exception 'Acesso restrito à equipe da plataforma.' using errcode = '42501';
  end if;

  select coalesce(s.admin_mfa_required, true) into l_required
  from public.platform_settings s
  where s.id = true;

  return coalesce(l_required, true);
end;
$$;

-- Só o papel admin altera esta proteção. Desligar é a ação sensível: exige aal2
-- sempre, mesmo que a exigência já esteja desligada. Ligar só endurece o acesso
-- (a sessão seguinte cai no cadastro ou no desafio), então vale com aal1 — é o
-- único jeito de ligar pela tela quando ninguém ainda tem autenticador.
create function public.admin_set_mfa_required(p_required boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_before boolean;
begin
  perform public.admin_require(array[]::public.platform_role[]);

  if p_required is null then
    raise exception 'Informe se o segundo fator deve ser obrigatório.' using errcode = 'P0001';
  end if;

  if not p_required and coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'Confirme o segundo fator para desligar a proteção do painel.'
      using errcode = 'PVMFA';
  end if;

  select s.admin_mfa_required into l_before
  from public.platform_settings s
  where s.id = true
  for update;

  update public.platform_settings
  set admin_mfa_required = p_required,
      updated_by = (select auth.uid())
  where id = true;

  perform public.admin_write_audit(
    case when p_required then 'Ativou' else 'Desativou' end || ' o segundo fator administrativo',
    case
      when l_before = p_required then 'a configuração já estava assim'
      else case when l_before then 'obrigatório → opcional' else 'opcional → obrigatório' end
    end
  );
end;
$$;

revoke execute on function public.admin_mfa_policy()
  from public, anon;
revoke execute on function public.admin_set_mfa_required(boolean)
  from public, anon;

grant execute on function public.admin_mfa_policy()
  to authenticated, service_role;
grant execute on function public.admin_set_mfa_required(boolean)
  to authenticated, service_role;
