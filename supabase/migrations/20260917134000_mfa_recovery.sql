-- ---------------------------------------------------------------------------
-- Autenticador perdido tem volta
-- ---------------------------------------------------------------------------
-- O painel exige segundo fator (`20260911140000_admin_mfa.sql`) e, até aqui,
-- perder o celular significava alguém apagar `auth.mfa_factors` no Studio. Dois
-- caminhos, ambos terminando na Admin API do Auth (Edge Function
-- `mfa-recovery`), que é quem remove o fator:
--
--   1. Códigos de recuperação. Com a sessão em aal2 a pessoa gera 10 códigos
--      de uso único (`mfa_recovery_generate_codes`), vistos uma vez só; o banco
--      guarda o hash bcrypt. Perdido o autenticador, ela entra com a senha
--      (aal1), manda um código e a função remove os fatores. No login seguinte
--      o painel pede o cadastro de um autenticador novo.
--   2. Um admin da plataforma, em aal2, redefine o fator de outra pessoa
--      (`admin_mfa_reset_check`), com auditoria.
--
-- Em ambos, a pessoa recebe e-mail avisando que o fator saiu — é o que
-- denuncia uma recuperação que ela não fez.

create table public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

comment on table public.mfa_recovery_codes is
  'Hash bcrypt dos códigos de recuperação do segundo fator. Escrita só pelas RPCs mfa_recovery_*.';

create index mfa_recovery_codes_user_idx on public.mfa_recovery_codes (user_id) where used_at is null;

create table public.mfa_recovery_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  method text not null check (method in ('code', 'admin')),
  succeeded boolean not null,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.mfa_recovery_attempts is
  'Tentativas de recuperação do segundo fator: freio contra força bruta e histórico para a própria pessoa.';

create index mfa_recovery_attempts_user_idx on public.mfa_recovery_attempts (user_id, created_at desc);

alter table public.mfa_recovery_codes enable row level security;
alter table public.mfa_recovery_attempts enable row level security;

create policy mfa_recovery_codes_select_own
  on public.mfa_recovery_codes for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy mfa_recovery_attempts_select_own
  on public.mfa_recovery_attempts for select
  to authenticated
  using (user_id = (select auth.uid()));

-- O hash não precisa ir para lugar nenhum fora do banco.
revoke select on public.mfa_recovery_codes from anon, authenticated;
grant select (id, user_id, created_at, used_at) on public.mfa_recovery_codes to authenticated;

-- ---------------------------------------------------------------------------
-- Gerar e consultar (a própria pessoa, pelo painel)
-- ---------------------------------------------------------------------------

create function public.mfa_recovery_generate_codes()
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := (select auth.uid());
  l_code text;
begin
  if l_uid is null then
    raise exception 'Entre na sua conta.' using errcode = '42501', hint = 'unauthorized';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'Confirme o segundo fator para gerar códigos de recuperação.'
      using errcode = 'PVMFA', hint = 'mfa_required';
  end if;
  if not exists (
    select 1 from auth.mfa_factors f where f.user_id = l_uid and f.status = 'verified'
  ) then
    raise exception 'Cadastre um autenticador antes de gerar os códigos.'
      using errcode = 'P0001', hint = 'no_factor';
  end if;

  -- Gerar de novo invalida os anteriores: é o que se faz quando a folha vazou.
  delete from public.mfa_recovery_codes c where c.user_id = l_uid;

  for i in 1..10 loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(b, n) % 32) + 1, 1), '')
    into l_code
    from extensions.gen_random_bytes(10) as b, generate_series(0, 9) as n;
    l_code := substr(l_code, 1, 5) || '-' || substr(l_code, 6, 5);
    insert into public.mfa_recovery_codes (user_id, code_hash)
    values (l_uid, extensions.crypt(l_code, extensions.gen_salt('bf', 10)));
    return next l_code;
  end loop;
end;
$$;

create function public.mfa_recovery_status()
returns table (remaining integer, total integer, generated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (count(*) filter (where c.used_at is null))::integer,
    count(*)::integer,
    min(c.created_at)
  from public.mfa_recovery_codes c
  where c.user_id = (select auth.uid());
$$;

revoke execute on function public.mfa_recovery_generate_codes() from public, anon;
grant execute on function public.mfa_recovery_generate_codes() to authenticated, service_role;
revoke execute on function public.mfa_recovery_status() from public, anon;
grant execute on function public.mfa_recovery_status() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Usar um código (service role — só a Edge Function `mfa-recovery`)
-- ---------------------------------------------------------------------------
-- Cinco erros em 15 minutos seguram a conta por 15 minutos. O código certo é
-- consumido aqui; a remoção do fator vem logo depois, na função.

create function public.mfa_redeem_recovery_code(p_user_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  l_id uuid;
begin
  if p_user_id is null then
    raise exception 'Conta não informada.' using errcode = '42501', hint = 'unauthorized';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mfa-recovery:' || p_user_id, 0));

  if (
    select count(*) from public.mfa_recovery_attempts a
    where a.user_id = p_user_id and not a.succeeded and a.method = 'code'
      and a.created_at > now() - interval '15 minutes'
  ) >= 5 then
    raise exception 'Muitas tentativas. Espere 15 minutos e tente de novo.'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;

  if char_length(l_code) = 10 then
    l_code := substr(l_code, 1, 5) || '-' || substr(l_code, 6, 5);
    select c.id into l_id
    from public.mfa_recovery_codes c
    where c.user_id = p_user_id
      and c.used_at is null
      and c.code_hash = extensions.crypt(l_code, c.code_hash)
    limit 1
    for update;
  end if;

  if l_id is null then
    insert into public.mfa_recovery_attempts (user_id, method, succeeded, actor_id)
    values (p_user_id, 'code', false, p_user_id);
    return false;
  end if;

  update public.mfa_recovery_codes set used_at = now() where id = l_id;
  insert into public.mfa_recovery_attempts (user_id, method, succeeded, actor_id)
  values (p_user_id, 'code', true, p_user_id);
  return true;
end;
$$;

-- Depois que a Admin API removeu os fatores: os códigos restantes perdem o
-- sentido (eram do autenticador que saiu) e a pessoa é avisada por e-mail.
create function public.mfa_recovery_completed(p_user_id uuid, p_method text, p_actor_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.mfa_recovery_codes c where c.user_id = p_user_id;
  if p_method = 'admin' then
    insert into public.mfa_recovery_attempts (user_id, method, succeeded, actor_id)
    values (p_user_id, 'admin', true, p_actor_id);
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user_id) then
    perform public.notify_enqueue(
      p_user_id, 'email', 'mfa_reset', 'Seu segundo fator foi removido',
      case when p_method = 'admin'
        then 'Um administrador da plataforma removeu o autenticador da sua conta Vez.'
        else 'Um código de recuperação foi usado para remover o autenticador da sua conta Vez.'
      end
        || ' No próximo acesso ao painel você cadastra um autenticador novo.'
        || ' Se não foi você, troque sua senha agora e fale com a equipe.',
      jsonb_build_object('type', 'mfa_reset', 'method', p_method),
      null, 'mfa_reset:' || p_user_id || ':' || extract(epoch from now())::bigint
    );
  end if;
end;
$$;

revoke execute on function public.mfa_redeem_recovery_code(uuid, text) from public, anon, authenticated;
grant execute on function public.mfa_redeem_recovery_code(uuid, text) to service_role;
revoke execute on function public.mfa_recovery_completed(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.mfa_recovery_completed(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Admin redefine o fator de outra pessoa
-- ---------------------------------------------------------------------------
-- Chamada pela Edge Function com o JWT de quem pede, ANTES de remover o
-- fator: confere papel `admin` e aal2 (`admin_require`) e grava a auditoria.
-- Redefinir o próprio fator por aqui não é permitido — para isso existem os
-- códigos, e um admin sozinho não deve conseguir tirar a própria proteção.

create function public.admin_mfa_reset_check(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_email text;
begin
  perform public.admin_require(array[]::public.platform_role[]);
  if p_user_id = (select auth.uid()) then
    raise exception 'Use um código de recuperação para redefinir o seu próprio fator.'
      using errcode = 'P0001', hint = 'self_reset';
  end if;
  select u.email::text into l_email from auth.users u where u.id = p_user_id;
  if l_email is null then
    raise exception 'Conta não encontrada.' using errcode = 'P0002', hint = 'not_found';
  end if;
  perform public.admin_write_audit('Redefiniu o segundo fator de ' || l_email, 'autenticador removido; a pessoa cadastra outro no próximo acesso');
  return l_email;
end;
$$;

revoke execute on function public.admin_mfa_reset_check(uuid) from public, anon;
grant execute on function public.admin_mfa_reset_check(uuid) to authenticated, service_role;
