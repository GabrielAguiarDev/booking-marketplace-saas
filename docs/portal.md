# Portal do estabelecimento

O portal web roda em `apps/portal`, na porta 3001. A fundação ligada ao
Supabase e o onboarding entraram em 12 de setembro de 2026; as telas de
operação e cadastro continuam separadas nas tarefas P5 e P6.

## Autenticação e acesso

- E-mail e senha usam Supabase Auth. Cadastro e recuperação aceitam o código de
  seis dígitos enviado pelo template atual; a sessão é renovada por `proxy.ts`.
- O Server Component de `app/page.tsx` valida a sessão com `getUser()` e só
  então carrega os vínculos de `establishment_members` sob RLS.
- Uma conta com mais de uma loja recebe um seletor; `?establishment=<uuid>` só
  é aceito quando o vínculo aparece na leitura autorizada. Sem vínculo, a tela
  oferece o cadastro da primeira loja.
- O papel vem do banco: `owner` vê tudo, `manager` não entra em assinatura, e
  `staff` fica nas áreas operacionais e em Primeiros passos. RLS/RPC continua
  sendo a barreira definitiva, não a condição da interface.

## Onboarding da loja

O fluxo é:

1. criar e confirmar a conta;
2. informar nome, categoria, CNPJ, razão social, responsável, contato,
   endereço, bairro e ao menos um serviço;
3. `create-establishment` valida o JWT e chama, com service role,
   `create_establishment_application`;
4. a transação cria a loja como `pending`, o vínculo `owner` e os serviços;
5. o admin aprova, recusa ou pede correção.

A loja nunca se aprova sozinha (decisão 0008). No MVP a localidade não aparece
no portal: `resolve_signup_city()` usa a praça ativa. Quando houver mais de uma
praça comercial, essa função deve ser substituída por resolução por CEP,
geolocalização ou pergunta explícita.

Uma correção grava mensagem em `establishment_decisions`. Enquanto essa decisão
for posterior ao último `submitted_at`, o dono vê a mensagem e o formulário
preenchido; `resubmit_establishment_application` valida propriedade, status e
serviços, atualiza os dados e carimba um novo `submitted_at`. Isso devolve a
loja à fila do admin e troca a tela por “cadastro em análise”. Recusa mostra o
motivo; aprovação abre o portal normal.

Fotos não entram no onboarding atual. Não há upload seguro/UX de corte nessa
etapa; elas ficam para Perfil público na P6.

## Contrato de dados e ações para P5/P6

O contrato está dividido assim:

- `components/model.ts`: tipos serializáveis de sessão, loja, vínculo,
  aplicação e passos;
- `components/portal-data.ts`: toda leitura do Server Component, sempre com a
  sessão do usuário e RLS;
- `components/store.tsx`: entrega `{ data, actions }` às seções;
- `components/supabase-actions.ts`: escritas do navegador e `router.refresh()`.

P5 deve acrescentar ao `PortalData` e ao loader os dados de Visão geral,
Agenda, Fila e Clientes, reaproveitando regras/RPCs do `mobile-staff`. P6 faz o
mesmo para Serviços, Equipe, Horários, Financeiro, Perfil público,
Configurações e Plano. Cada escrita nova entra em `PortalActions`; componentes
de seção não criam clientes Supabase próprios.

Os fixtures de `components/data.ts` e `section-data.ts` ficam apenas como
referência visual do canvas e não são renderizados. Até P5/P6, cada seção mostra
um estado vazio explícito. Não há fallback silencioso, contagem, cobrança,
receita ou fila inventada (R3 e R7).

## Primeiros passos

Segue a mesma regra de `mobile-staff/src/data/onboarding.ts`: progresso não é
uma coluna. O portal pergunta ao estado real se existe serviço ativo, se há
horário da loja junto de profissional/jornada, e se descrição/endereço estão
preenchidos. Assim o check não fica verde quando o dado necessário desaparece.

## Verificação local

```bash
docker exec -i supabase_db_vez-saas psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/migrations/20260912110000_onboarding.sql
pnpm exec supabase db lint --local --level warning
./scripts/check-rls.sh
pnpm --filter @vez/portal typecheck
pnpm --filter @vez/portal lint
pnpm --filter @vez/portal build
pnpm exec supabase functions serve create-establishment \
  --env-file supabase/functions/.env
```
