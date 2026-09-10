-- ---------------------------------------------------------------------------
-- Quem chegou sem app
-- ---------------------------------------------------------------------------
-- O app do estabelecimento tem duas ações que o schema tornava impossíveis:
-- "Adicionar pelo balcão" na fila e "Novo agendamento" para quem ligou. As
-- duas esbarravam na mesma coluna: `customer_id` era `not null` e apontava
-- para `profiles`, ou seja, exigia conta no app.
--
-- Isso invertia a realidade da barbearia. A conta é conveniência do cliente,
-- não pré-requisito do atendimento — e uma fila que só enxerga quem baixou o
-- app é uma fila errada: o balcão continuaria com o caderno, e o número que o
-- app mostrasse ao cliente ("você é o terceiro") seria mentira.
--
-- Por isso o par `guest_name`/`guest_phone`: a linha existe com um nome escrito
-- à mão. Não é conta, não vira conta e não vê nada — é o caderno, dentro do
-- banco, contando posição junto com todo mundo.

-- ── fila ───────────────────────────────────────────────────────────────────

alter table public.queue_entries
  alter column customer_id drop not null,
  add column guest_name text,
  add column guest_phone text,
  -- Uma linha ou tem dono, ou tem nome escrito. Sem isto, entra fantasma na
  -- fila e a posição do cliente do app fica errada sem nada para mostrar.
  add constraint queue_entries_has_someone
    check (customer_id is not null or nullif(btrim(guest_name), '') is not null);

comment on column public.queue_entries.guest_name is
  'Nome escrito no balcão. Preenchido só quando customer_id é nulo — cliente sem conta no app.';

-- De onde a pessoa entrou na fila. O app do estabelecimento mostra isso em
-- cada linha, e a distinção é operacional: quem entrou pelo balcão está ali na
-- frente do atendente, quem entrou pelo app pode ainda estar vindo. Sem a
-- coluna, a tela teria que adivinhar pelo `guest_name` — e adivinharia errado
-- para o cliente com conta que foi cadastrado no balcão.
create type public.queue_source as enum (
  'app',      -- entrou sozinho pelo aplicativo
  'qr',       -- leu o QR do balcão
  'counter'   -- a equipe colocou na fila
);

alter table public.queue_entries
  add column source public.queue_source not null default 'app';

-- O cliente entra como 'app' ou 'qr'; 'counter' é da equipe. Sem esta troca a
-- legenda da tela seria decorativa: qualquer um se declararia balcão.
drop policy queue_entries_insert_own on public.queue_entries;

create policy queue_entries_insert_own
  on public.queue_entries for insert
  to authenticated
  with check (
    customer_id = (select auth.uid())
    and status = 'waiting'
    and source in ('app', 'qr')
    and exists (
      select 1 from public.establishments e
      where e.id = establishment_id
        and e.status = 'active'
        and e.booking_mode in ('queue', 'both')
    )
  );

-- O índice de entrada única por cliente segue valendo para quem tem conta: em
-- índice único o Postgres trata NULLs como distintos, então dois convidados
-- não colidem. Duas linhas para a mesma pessoa sem conta é o comportamento
-- certo — o balcão não tem como saber que é a mesma pessoa.

-- ── agenda ─────────────────────────────────────────────────────────────────

alter table public.appointments
  alter column customer_id drop not null,
  add column guest_name text,
  add column guest_phone text,
  add constraint appointments_has_someone
    check (customer_id is not null or nullif(btrim(guest_name), '') is not null);

comment on column public.appointments.guest_name is
  'Cliente que agendou por telefone ou no balcão, sem conta no app. Não recebe aviso: não há para onde mandar.';

-- As políticas de cliente (`appointments_select_own`, `appointments_cancel_own`,
-- `queue_entries_select_own`, `queue_entries_update_own`) comparam
-- `customer_id = auth.uid()`. Com a coluna nula a comparação dá NULL, que a RLS
-- trata como falso: reserva de balcão fica invisível para todo cliente, que é
-- exatamente o desejado. Nenhuma delas precisa mudar.
--
-- Escrever essas linhas continua sendo da equipe, pelas políticas
-- `appointments_update_establishment` e `queue_entries_manage_establishment`,
-- que são `for all` e portanto já cobrem o insert.

-- ---------------------------------------------------------------------------
-- A equipe precisa ver o nome de quem ela atende
-- ---------------------------------------------------------------------------
-- `profiles_select_colleagues` cobre colega de trabalho; cliente não é colega.
-- Sem a política abaixo o app do estabelecimento mostraria a fila inteira como
-- linhas sem nome — e "chamar o próximo" viraria chamar um UUID.
--
-- O alcance é o mínimo que resolve: só perfil de quem tem (ou teve) reserva ou
-- entrada de fila numa loja de quem está perguntando. Não é "equipe vê todo
-- mundo"; é "equipe vê quem procurou a loja dela".

create policy profiles_select_establishment_customers
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.appointments a
      where a.customer_id = profiles.id
        and public.is_establishment_member(a.establishment_id)
    )
    or exists (
      select 1
      from public.queue_entries q
      where q.customer_id = profiles.id
        and public.is_establishment_member(q.establishment_id)
    )
  );
