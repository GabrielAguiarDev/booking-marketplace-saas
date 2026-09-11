-- ---------------------------------------------------------------------------
-- Cenário de demonstração — NÃO é seed
-- ---------------------------------------------------------------------------
-- `seed.sql` guarda só dado de referência (cidades), porque ele roda em todo
-- `db reset` e o banco local deve parecer produção no dia zero. Este arquivo é
-- o contrário: são duas lojas inventadas, para dar o que testar no app.
--
--   pnpm db:demo      carrega
--   pnpm db:reset     apaga (não roda este arquivo)
--
-- Apague este diretório quando houver estabelecimento de verdade cadastrado.

begin;

delete from public.establishments where slug in ('barbearia-meia-nove', 'clinica-aurora-derma');

-- --------------------------------------------------------------------------
-- Barbearia Meia-Nove — fila e hora marcada, sem sinal
-- --------------------------------------------------------------------------
insert into public.establishments (
  id, city_id, name, slug, category, status, booking_mode, description,
  address_line, neighborhood, latitude, longitude, accent_color,
  slot_interval_minutes, min_lead_minutes, deposit_percent, cancellation_window_minutes
)
select
  '0a000000-0000-4000-8000-000000000001', c.id,
  'Barbearia Meia-Nove', 'barbearia-meia-nove', 'barbershop', 'active', 'both',
  'Corte, barba e navalha. Atendemos por ordem de chegada e também com hora marcada.',
  'Rua das Palmeiras, 959', 'Centro', -26.304400, -48.845700, '#7B2136',
  30, 15, 0, 120
from public.cities c where c.slug = 'joinville';

insert into public.services (id, establishment_id, name, description, duration_minutes, price_cents, sort_order) values
  ('0b000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'Corte masculino', 'Máquina e tesoura, com finalização.', 30, 5500, 1),
  ('0b000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001', 'Barba na navalha', 'Toalha quente e navalha.', 30, 4500, 2),
  ('0b000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000001', 'Corte + barba', 'O combo da casa.', 60, 9000, 3);

insert into public.professionals (id, establishment_id, display_name, title, sort_order) values
  ('0c000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'Rafael Nunes', 'Barbeiro', 1),
  ('0c000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001', 'Diego Alves', 'Barbeiro', 2);

insert into public.professional_services (professional_id, service_id)
select p.id, s.id
from public.professionals p, public.services s
where p.establishment_id = '0a000000-0000-4000-8000-000000000001'
  and s.establishment_id = '0a000000-0000-4000-8000-000000000001';

-- Terça a sábado, 9h às 19h, fechado para almoço entre 12h e 13h.
insert into public.business_hours (establishment_id, weekday, opens_at, closes_at)
select '0a000000-0000-4000-8000-000000000001', d, '09:00', '12:00' from generate_series(2, 6) d;
insert into public.business_hours (establishment_id, weekday, opens_at, closes_at)
select '0a000000-0000-4000-8000-000000000001', d, '13:00', '19:00' from generate_series(2, 6) d;

insert into public.professional_schedules (professional_id, weekday, starts_at, ends_at)
select p.id, d, '09:00', '19:00'
from public.professionals p, generate_series(2, 6) d
where p.establishment_id = '0a000000-0000-4000-8000-000000000001';

-- --------------------------------------------------------------------------
-- Clínica Aurora Derma — só hora marcada, sinal de 30%
-- --------------------------------------------------------------------------
insert into public.establishments (
  id, city_id, name, slug, category, status, booking_mode, description,
  address_line, neighborhood, latitude, longitude, accent_color,
  slot_interval_minutes, min_lead_minutes, deposit_percent, cancellation_window_minutes
)
select
  '0a000000-0000-4000-8000-000000000002', c.id,
  'Clínica Aurora Derma', 'clinica-aurora-derma', 'dermatology', 'active', 'scheduled',
  'Dermatologia clínica e estética avançada. Três consultórios, atendimento por hora marcada com tolerância de 10 minutos.',
  'Av. Getúlio Vargas, 1200', 'América', -26.298100, -48.851200, '#0B6E7C',
  20, 60, 30, 1440
from public.cities c where c.slug = 'joinville';

insert into public.services (id, establishment_id, name, description, duration_minutes, price_cents, sort_order) values
  ('0b000000-0000-4000-8000-000000000011', '0a000000-0000-4000-8000-000000000002', 'Consulta dermatológica', 'Convênio ou particular.', 40, 18000, 1),
  ('0b000000-0000-4000-8000-000000000012', '0a000000-0000-4000-8000-000000000002', 'Mapeamento de pintas', 'Dermatoscopia digital.', 60, 32000, 2),
  ('0b000000-0000-4000-8000-000000000013', '0a000000-0000-4000-8000-000000000002', 'Limpeza de pele', 'Profunda, com extração.', 80, 22000, 3);

insert into public.professionals (id, establishment_id, display_name, title, sort_order) values
  ('0c000000-0000-4000-8000-000000000011', '0a000000-0000-4000-8000-000000000002', 'Dra. Helena Prado', 'Dermatologista', 1),
  ('0c000000-0000-4000-8000-000000000012', '0a000000-0000-4000-8000-000000000002', 'Dra. Marina Costa', 'Dermatologista', 2);

insert into public.professional_services (professional_id, service_id)
select p.id, s.id
from public.professionals p, public.services s
where p.establishment_id = '0a000000-0000-4000-8000-000000000002'
  and s.establishment_id = '0a000000-0000-4000-8000-000000000002';

-- Segunda a sexta, 8h às 18h, direto.
insert into public.business_hours (establishment_id, weekday, opens_at, closes_at)
select '0a000000-0000-4000-8000-000000000002', d, '08:00', '18:00' from generate_series(1, 5) d;

insert into public.professional_schedules (professional_id, weekday, starts_at, ends_at)
select p.id, d, '08:00', '18:00'
from public.professionals p, generate_series(1, 5) d
where p.establishment_id = '0a000000-0000-4000-8000-000000000002';

update public.establishments
set plan_id = (select id from public.plans where kind = 'commission' and is_default)
where id in (
  '0a000000-0000-4000-8000-000000000001',
  '0a000000-0000-4000-8000-000000000002'
);

-- --------------------------------------------------------------------------
-- Equipe, clientes e o dia de hoje na Barbearia Meia-Nove
-- --------------------------------------------------------------------------
-- Sem isto o app do estabelecimento não abre: ele começa perguntando de qual
-- loja o usuário é equipe, e a resposta vinha vazia.
--
-- As contas são criadas direto em `auth.users` porque este arquivo roda por
-- psql, fora do alcance da API de Auth. É aceitável aqui e em nenhum outro
-- lugar: é banco local de demonstração, e a senha está escrita duas linhas
-- abaixo.
--
--   rafael@vez.local   dono      · acesso total
--   diego@vez.local    equipe    · só a própria agenda
--   cliente@vez.local  cliente   · aparece na fila e na agenda
--   admin@vez.local    plataforma · painel administrativo
--
-- Senha das quatro: senha-forte-123

delete from auth.users where email in ('rafael@vez.local', 'diego@vez.local', 'cliente@vez.local', 'admin@vez.local');

-- Os quatro tokens vazios não são enfeite: as colunas não têm default, e o
-- GoTrue lê cada uma numa string não-anulável. Deixá-las NULL faz o login
-- responder "Database error querying schema" — erro que não menciona a causa.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '0d000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'rafael@vez.local',
   extensions.crypt('senha-forte-123', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Rafael Nunes"}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '0d000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'diego@vez.local',
   extensions.crypt('senha-forte-123', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Diego Alves"}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '0d000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'cliente@vez.local',
   extensions.crypt('senha-forte-123', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Marcos Aurélio"}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '0d000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'admin@vez.local',
   extensions.crypt('senha-forte-123', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Helena Reis"}'::jsonb, '', '', '', '');

-- Sem a linha em `auth.identities` o GoTrue aceita a senha e depois devolve
-- "Database error querying schema" no primeiro refresh.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email in ('rafael@vez.local', 'diego@vez.local', 'cliente@vez.local', 'admin@vez.local');

insert into public.platform_admins (user_id, role)
values ('0d000000-0000-4000-8000-000000000004', 'admin');

update public.profiles set phone = '47 99912-4408'
where id = '0d000000-0000-4000-8000-000000000003';

insert into public.establishment_members (user_id, establishment_id, role) values
  ('0d000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'owner'),
  ('0d000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001', 'staff');

-- Liga cada login ao profissional que ele é. É esse vínculo que faz a agenda
-- do Diego abrir filtrada nele.
update public.professionals set user_id = '0d000000-0000-4000-8000-000000000001'
where id = '0c000000-0000-4000-8000-000000000001';
update public.professionals set user_id = '0d000000-0000-4000-8000-000000000002'
where id = '0c000000-0000-4000-8000-000000000002';

-- --------------------------------------------------------------------------
-- O dia de hoje
-- --------------------------------------------------------------------------
-- Ancorado em `current_date` no fuso da loja, para o app do estabelecimento
-- abrir com conteúdo em qualquer dia que a demo for carregada.

insert into public.appointments (
  establishment_id, professional_id, service_id, customer_id, guest_name, guest_phone,
  starts_at, ends_at, status, price_cents, deposit_cents
)
values
  -- já saíram da cadeira
  ('0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001',
   '0b000000-0000-4000-8000-000000000001', null, 'Rogério Maia', '47 99881-2010',
   (current_date + time '09:00') at time zone 'America/Sao_Paulo',
   (current_date + time '09:30') at time zone 'America/Sao_Paulo',
   'completed', 5500, 0),
  ('0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000002',
   '0b000000-0000-4000-8000-000000000003', null, 'Sandro Alves', null,
   (current_date + time '10:00') at time zone 'America/Sao_Paulo',
   (current_date + time '11:00') at time zone 'America/Sao_Paulo',
   'completed', 9000, 0),
  ('0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001',
   '0b000000-0000-4000-8000-000000000002', null, 'Elias Prado', null,
   (current_date + time '10:30') at time zone 'America/Sao_Paulo',
   (current_date + time '11:00') at time zone 'America/Sao_Paulo',
   'completed', 4500, 0),
  -- esperando o sim da loja: é a pilha de "precisa da sua decisão"
  ('0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000002',
   '0b000000-0000-4000-8000-000000000002', '0d000000-0000-4000-8000-000000000003', null, null,
   (current_date + time '17:15') at time zone 'America/Sao_Paulo',
   (current_date + time '17:45') at time zone 'America/Sao_Paulo',
   'scheduled', 4500, 0),
  ('0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001',
   '0b000000-0000-4000-8000-000000000003', null, 'Tiago Peçanha', '47 98812-3391',
   (current_date + time '16:00') at time zone 'America/Sao_Paulo',
   (current_date + time '17:00') at time zone 'America/Sao_Paulo',
   'scheduled', 9000, 0),
  -- já aprovados
  ('0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000002',
   '0b000000-0000-4000-8000-000000000003', null, 'Otávio Brandão', null,
   (current_date + time '15:30') at time zone 'America/Sao_Paulo',
   (current_date + time '16:30') at time zone 'America/Sao_Paulo',
   'confirmed', 9000, 0),
  ('0a000000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000001',
   '0b000000-0000-4000-8000-000000000002', null, 'Heitor Cruz', null,
   (current_date + time '18:00') at time zone 'America/Sao_Paulo',
   (current_date + time '18:30') at time zone 'America/Sao_Paulo',
   'confirmed', 4500, 0);

-- Almoço de amanhã: dá o que ver na tela de bloqueio.
insert into public.schedule_exceptions (
  establishment_id, professional_id, exception_date, starts_at, ends_at, is_available, reason
) values (
  '0a000000-0000-4000-8000-000000000001', null, current_date + 1, '12:00', '13:00', false, 'Almoço'
);

-- Fila viva: um em atendimento e quatro esperando, das três origens.
insert into public.queue_entries (
  establishment_id, customer_id, guest_name, guest_phone, service_id, source, status,
  joined_at, called_at, served_at, arrived_at
)
values
  ('0a000000-0000-4000-8000-000000000001', null, 'Ederson Luz', '47 99640-1180',
   '0b000000-0000-4000-8000-000000000003', 'counter', 'in_service',
   now() - interval '52 minutes', now() - interval '38 minutes', now() - interval '36 minutes', now() - interval '52 minutes'),
  ('0a000000-0000-4000-8000-000000000001', null, 'Wagner Pires', null,
   '0b000000-0000-4000-8000-000000000001', 'qr', 'waiting',
   now() - interval '31 minutes', null, null, now() - interval '31 minutes'),
  ('0a000000-0000-4000-8000-000000000001', '0d000000-0000-4000-8000-000000000003', null, null,
   '0b000000-0000-4000-8000-000000000002', 'app', 'waiting',
   now() - interval '23 minutes', null, null, now() - interval '20 minutes'),
  ('0a000000-0000-4000-8000-000000000001', null, 'Kelvin Mota', null,
   '0b000000-0000-4000-8000-000000000001', 'counter', 'waiting',
   now() - interval '14 minutes', null, null, now() - interval '14 minutes'),
  -- a caminho: entrou pelo app e ainda não confirmou chegada
  ('0a000000-0000-4000-8000-000000000001', null, 'Douglas Sé', '47 98110-7722',
   '0b000000-0000-4000-8000-000000000003', 'app', 'waiting',
   now() - interval '9 minutes', null, null, null);

commit;

\echo 'Demo carregada: 2 lojas em Joinville, 6 serviços, 4 profissionais, 1 equipe, 1 admin e o dia de hoje.'
