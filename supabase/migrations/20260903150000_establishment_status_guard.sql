-- ---------------------------------------------------------------------------
-- Loja não se aprova sozinha
-- ---------------------------------------------------------------------------
-- `establishments_update_manager` deixa dono e gerente atualizarem a própria
-- loja — o que está certo para nome, endereço, cor e política comercial. Só que
-- `status` está na mesma tabela, e a política não distingue coluna. Na prática,
-- qualquer dono podia rodar `update establishments set status = 'active'` e
-- pular a aprovação da plataforma inteira. Uma loja suspensa por fraude podia
-- se reativar.
--
-- Isso é vulnerabilidade, não bug de tela: neste projeto a autorização é o
-- schema. E RLS não filtra por coluna, então a checagem tem que ser um gatilho.
--
-- `pending → active` continua existindo; só muda quem pode fazer. Como o
-- gatilho compara a role da conexão, service_role (Edge Function e o admin da
-- plataforma) passa, e o app do estabelecimento não.

create function public.guard_establishment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and current_setting('role', true) is distinct from 'service_role'
     and not public.is_platform_admin()
  then
    raise exception 'status do estabelecimento só muda por admin da plataforma'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger establishments_guard_status
  before update on public.establishments
  for each row execute function public.guard_establishment_status();
