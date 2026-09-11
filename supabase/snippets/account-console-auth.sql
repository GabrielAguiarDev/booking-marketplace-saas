-- Teste manual da autorização do console de conta. Tudo roda em transação e
-- volta ao estado anterior; execute com psql -v ON_ERROR_STOP=1.
begin;

update public.platform_admins
set role = 'support'
where user_id = '0d000000-0000-4000-8000-000000000004';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);

select public.admin_start_access_session(
  '0a000000-0000-4000-8000-000000000001',
  'investigar chamado #4401 no console',
  15
) as session_id \gset

select public.admin_has_active_access_session(
  :'session_id', '0a000000-0000-4000-8000-000000000001'
) as support_active;
select count(*) as agenda_rows from public.admin_account_agenda(
  :'session_id', '0a000000-0000-4000-8000-000000000001'
);
select count(*) as service_rows from public.admin_account_services(
  :'session_id', '0a000000-0000-4000-8000-000000000001'
);
select count(*) as professional_rows from public.admin_account_professionals(
  :'session_id', '0a000000-0000-4000-8000-000000000001'
);
select count(*) as settings_rows from public.admin_account_settings(
  :'session_id', '0a000000-0000-4000-8000-000000000001'
);
select count(*) as review_rows from public.admin_account_reviews(
  :'session_id', '0a000000-0000-4000-8000-000000000001'
);

do $$
begin
  perform public.admin_account_services(
    '00000000-0000-4000-8000-000000000000',
    '0a000000-0000-4000-8000-000000000001'
  );
  raise exception 'sessão inexistente foi aceita';
exception when insufficient_privilege then
  null;
end;
$$;

reset role;
update public.platform_admins
set role = 'admin'
where user_id = '0d000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
select public.admin_has_active_access_session(
  :'session_id', '0a000000-0000-4000-8000-000000000001'
) as admin_active;
select count(*) as admin_service_rows from public.admin_account_services(
  :'session_id', '0a000000-0000-4000-8000-000000000001'
);

reset role;
update public.platform_admins
set role = 'operations'
where user_id = '0d000000-0000-4000-8000-000000000004';
set local role authenticated;
do $$
begin
  perform public.admin_account_services(
    (select id from public.admin_access_sessions order by started_at desc limit 1),
    '0a000000-0000-4000-8000-000000000001'
  );
  raise exception 'operations foi aceito';
exception when insufficient_privilege then
  null;
end;
$$;

reset role;
update public.platform_admins
set role = 'finance'
where user_id = '0d000000-0000-4000-8000-000000000004';
set local role authenticated;
do $$
begin
  perform public.admin_has_active_access_session(
    (select id from public.admin_access_sessions order by started_at desc limit 1),
    '0a000000-0000-4000-8000-000000000001'
  );
  raise exception 'finance foi aceito';
exception when insufficient_privilege then
  null;
end;
$$;

reset role;
update public.platform_admins
set role = 'support'
where user_id = '0d000000-0000-4000-8000-000000000004';
update public.admin_access_sessions
set started_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute'
where id = :'session_id';
set local role authenticated;
do $$
begin
  perform public.admin_account_services(
    (select id from public.admin_access_sessions order by started_at desc limit 1),
    '0a000000-0000-4000-8000-000000000001'
  );
  raise exception 'sessão expirada foi aceita';
exception when insufficient_privilege then
  null;
end;
$$;

reset role;
update public.admin_access_sessions
set expires_at = now() + interval '15 minutes', ended_at = now()
where id = :'session_id';
set local role authenticated;
do $$
begin
  perform public.admin_account_services(
    (select id from public.admin_access_sessions order by started_at desc limit 1),
    '0a000000-0000-4000-8000-000000000001'
  );
  raise exception 'sessão encerrada foi aceita';
exception when insufficient_privilege then
  null;
end;
$$;

-- Conta comum: nem a função booleana fica disponível como atalho.
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
do $$
begin
  perform public.admin_has_active_access_session(
    (select id from public.admin_access_sessions order by started_at desc limit 1),
    '0a000000-0000-4000-8000-000000000001'
  );
  raise exception 'conta comum foi aceita';
exception when insufficient_privilege then
  null;
end;
$$;

reset role;
rollback;
