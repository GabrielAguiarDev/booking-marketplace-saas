-- Matriz de autorização do MFA administrativo. Tudo é revertido ao final.
begin;

update public.platform_settings set admin_mfa_required = true where id;

insert into public.platform_admins (user_id, role)
values ('0d000000-0000-4000-8000-000000000001', 'operations')
on conflict (user_id) do update set role = excluded.role;

set local role authenticated;

-- Admin em aal1: até a leitura é barrada pelo banco com o código próprio.
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  true
);
do $$
begin
  perform public.admin_me();
  raise exception 'FALHA: admin em aal1 conseguiu usar admin_me';
exception when sqlstate 'PVMFA' then
  null;
end;
$$;

-- A RPC de bootstrap revela a política somente a quem já pertence à equipe.
do $$
begin
  if public.admin_mfa_policy() is distinct from true then
    raise exception 'FALHA: política de MFA inesperada';
  end if;
end;
$$;

-- Admin em aal2 passa e pode alterar a política.
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',
  true
);
select count(*) from public.admin_me();
select public.admin_set_mfa_required(false);

-- Mesmo com a política desligada, alterar o próprio flag continua exigindo aal2.
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  true
);
do $$
begin
  perform public.admin_set_mfa_required(true);
  raise exception 'FALHA: admin em aal1 alterou a política';
exception when sqlstate 'PVMFA' then
  null;
end;
$$;
select count(*) from public.admin_me();

-- Outro papel não altera a política, mesmo com aal2.
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
do $$
begin
  perform public.admin_set_mfa_required(true);
  raise exception 'FALHA: operations alterou a política';
exception when insufficient_privilege then
  null;
end;
$$;

-- Uma conta comum não descobre nem a política de bootstrap.
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);
do $$
begin
  perform public.admin_mfa_policy();
  raise exception 'FALHA: conta comum leu a política administrativa';
exception when insufficient_privilege then
  null;
end;
$$;

reset role;
rollback;
