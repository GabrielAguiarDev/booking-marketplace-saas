-- ---------------------------------------------------------------------------
-- Tipos do painel administrativo
-- ---------------------------------------------------------------------------
-- Separado da migration do painel porque `alter type ... add value` não pode
-- ser usado na mesma transação em que foi criado: as funções da próxima
-- migration comparam status com 'rejected', e o valor precisa já existir.

-- Cadastro recusado pela plataforma. Antes só havia pendente, ativa e suspensa,
-- e uma recusa deixava a loja em `pending` para sempre — indistinguível de uma
-- que ainda não foi olhada.
alter type public.establishment_status add value if not exists 'rejected';

-- Os dois modelos de cobrança do brief. Coexistem: mensalidade enquanto houver
-- vaga na cidade, comissão depois.
create type public.plan_kind as enum ('monthly', 'commission');

-- Nível de acesso de quem trabalha na plataforma.
create type public.platform_role as enum ('admin', 'operations', 'finance', 'support');

-- Uma cidade nasce em avaliação, passa por pré-lançamento (aceita cadastro,
-- não aparece na busca) e só então fica ativa.
create type public.city_launch_status as enum ('active', 'pre_launch', 'evaluating');

create type public.application_decision as enum ('approved', 'rejected', 'correction');

create type public.review_report_status as enum ('open', 'awaiting_establishment', 'kept', 'removed');
