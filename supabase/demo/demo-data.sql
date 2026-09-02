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

commit;

\echo 'Demo carregada: 2 lojas em Joinville, 6 serviços, 4 profissionais.'
