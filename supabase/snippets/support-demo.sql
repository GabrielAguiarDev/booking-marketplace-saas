-- Dados locais para exercitar o painel de suporte sem depender do portal nem
-- dos apps. O script usa somente a RPC pública que essas superfícies chamarão.

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select *
from public.open_support_ticket(
  'Agenda não abre no celular',
  'Ao tocar em Agenda, o aplicativo volta para a tela inicial. Acontece desde ontem.',
  'technical',
  '0a000000-0000-4000-8000-000000000001'
)
where not exists (
  select 1 from public.support_tickets where subject = 'Agenda não abre no celular'
);
select *
from public.open_support_ticket(
  'Dúvida sobre o plano',
  'Quero entender quando a troca do plano atual passa a valer para a barbearia.',
  'billing',
  '0a000000-0000-4000-8000-000000000001'
)
where not exists (
  select 1 from public.support_tickets where subject = 'Dúvida sobre o plano'
);
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select *
from public.open_support_ticket(
  'Reserva sumiu da agenda',
  'A cliente confirmou o horário, mas eu não encontro a reserva na agenda de hoje.',
  'booking',
  '0a000000-0000-4000-8000-000000000001'
)
where not exists (
  select 1 from public.support_tickets where subject = 'Reserva sumiu da agenda'
);
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"0d000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select *
from public.open_support_ticket(
  'Pagamento duplicado',
  'Meu cartão mostra duas cobranças da reserva feita na Barbearia Meia-Nove.',
  'payment',
  '0a000000-0000-4000-8000-000000000001'
)
where not exists (
  select 1 from public.support_tickets where subject = 'Pagamento duplicado'
);
select *
from public.open_support_ticket(
  'Não consigo entrar na conta',
  'O código de acesso expirou e o aplicativo não envia um novo código.',
  'account',
  null
)
where not exists (
  select 1 from public.support_tickets where subject = 'Não consigo entrar na conta'
);
commit;
