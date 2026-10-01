# Auditoria do backend — 30/09/2026

Escopo: `supabase/` (migrations, Edge Functions, testes) e `packages/supabase/`.
Frente backend da orquestração `run_f16798fb6003`. Este documento tem duas
partes: o **diagnóstico**, escrito antes de qualquer alteração, e a
**resolução**, preenchida ao final com o que foi de fato testado.

## Como a auditoria foi feita

- Leitura das 33 migrations, das 9 Edge Functions e do pacote `@vez/supabase`.
- Consulta ao banco local (sem reset, somente leitura): políticas de RLS,
  privilégios de execução das 120 funções `security definer`, gatilhos de
  guarda, chaves estrangeiras e buckets.
- Linha de base, antes de mexer: `pnpm db:check-rls` passa,
  `supabase db lint --local` sem achados, `pnpm db:test:behavior` passa — mas
  o cenário de cancelamento é **pulado** por depender de uma reserva futura
  na demo.
- Documentação oficial da OpenAI consultada para a parte da integração
  (referência de Chat Completions, página do modelo `gpt-4o-mini` e página de
  descontinuações).

## Diagnóstico (antes da implementação)

Prioridade: **P0** bloqueia lançamento; **P1** deve entrar antes do
lançamento; **P2** é endurecimento barato; **P3** fica registrado.

### Assistente (IA)

| #   | Pri | Lacuna                                                           | Evidência                                                                                                                                                                                                                         |
| --- | --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | P0  | Cota diária contornável apagando conversa                        | A cota conta linhas de `assistant_messages`; a política `assistant_conversations_delete_own` apaga a conversa e, em cascata, as mensagens. Apagar o histórico devolve as 20 perguntas — gasto ilimitado na conta da OpenAI.       |
| A2  | P0  | Cota não é atômica                                               | `assistant/index.ts` conta, chama o modelo e só grava depois da resposta. N requisições paralelas passam todas pela contagem antes de qualquer gravação.                                                                          |
| A3  | P1  | Ferramentas do modelo rodam com a chave secreta                  | `runTool(admin, …)` ignora a RLS. `listar_servicos` recebe o `establishment_id` do modelo e devolve serviços de loja `pending`/`suspended`. Injeção de prompt vira leitura fora da RLS.                                           |
| A4  | P1  | Histórico perde a ordem e o contexto                             | Pergunta e resposta são gravadas no mesmo `insert`, com o mesmo `created_at`: a ordem dentro do par é indefinida. Só o texto volta ao modelo; os IDs de loja e serviço ficam nos cartões, e "e amanhã?" recomeça a busca do zero. |
| A5  | P1  | Falha de gravação é silenciosa                                   | O resultado do `insert` final não é conferido: a resposta é entregue, o histórico some e a cota não é consumida.                                                                                                                  |
| A6  | P1  | Dia da cota diverge do dia do produto                            | A função usa meia-noite UTC (`toDateString` no runtime, `date_trunc('day', now())` no banco) e o prompt usa `America/Sao_Paulo`. A cota vira às 21h de Brasília. O limite 20 está escrito em dois lugares.                        |
| A7  | P1  | Chamada à OpenAI sem prazo                                       | `fetch` sem `AbortSignal`: um upstream travado segura a função até o limite da plataforma.                                                                                                                                        |
| A8  | P2  | Parâmetro descontinuado                                          | `max_tokens` está descontinuado em Chat Completions em favor de `max_completion_tokens` (documentação oficial). `gpt-4o-mini` e o endpoint seguem suportados, sem data de desligamento publicada.                                 |
| A9  | P2  | Entrada sem validação de tipo                                    | `message` numérico derruba a função em `.trim()` (500 sem código). `conversation_id`, `city_id` e os argumentos das ferramentas vão ao Postgres sem validar formato; o erro cru do banco volta ao modelo.                         |
| A10 | P2  | Custo não observável                                             | Nenhum registro de modelo ou tokens por resposta.                                                                                                                                                                                 |
| A11 | P1  | Histórico: contrato para o app                                   | Tabelas e RLS de leitura já existem; falta provar por comportamento (dono lê, terceiro não lê, cliente não escreve, apagar não devolve cota) e publicar o contrato para a tela.                                                   |
| A12 | P3  | Sem moderação de entrada e sem retenção automática das conversas | Decisão de produto; as ferramentas são somente leitura de dado público.                                                                                                                                                           |

### Segurança e autorização

| #   | Pri | Lacuna                                               | Evidência                                                                                                                                                                                                                                                                                            |
| --- | --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | P0  | Dono vincula qualquer conta à equipe sem aceite      | `establishment_members_write_owner` é `FOR ALL`: `insert` direto pelo PostgREST cria o vínculo que o gate de 18/09 dizia só nascer no aceite do convite. Consequências: lê nome e telefone da vítima (`profiles_select_colleagues`) e bloqueia a exclusão LGPD dela (`has_establishment`).           |
| S2  | P0  | Equipe apaga reserva e, com ela, a avaliação         | `appointments_update_establishment` é `FOR ALL` para qualquer membro, e `reviews.appointment_id` é `ON DELETE CASCADE`: apagar a reserva concluída remove a avaliação negativa sem passar pela moderação. O mesmo `FOR ALL` deixa inserir reserva com `customer_id` de terceiros e trocar o cliente. |
| S3  | P0  | Gerência escreve a própria nota                      | `guard_establishment_status` protege situação, plano e desconto, mas não `rating_avg`, `rating_count` nem `city_id`. Um `update` direto põe a loja com nota 5,0 no topo da busca, ou a muda de cidade sem passar pela cota.                                                                          |
| S4  | P2  | `queue_code_matches` é RPC pública para autenticados | Marcada como "interna", só é usada dentro de funções `security definer`. Exposta, é um oráculo sem freio do código do balcão (8 caracteres de 32 símbolos — força bruta inviável, mas a exposição é desnecessária).                                                                                  |
| S5  | P2  | Matriz de segurança pula um cenário                  | `launch-security.sql` depende de reserva futura na demo para testar o cancelamento; sem ela, o caso é pulado em silêncio.                                                                                                                                                                            |

O que foi conferido e **está correto**: todas as tabelas de `public` com RLS e
política; todas as funções `security definer` com `search_path` fixo; nenhuma
função administrativa executável por `anon`; `available_slots` só responde
para loja ativa; `book-appointment` congela preço e valida o horário no
Postgres; `delete-account` exige login recente; `notifications-dispatch`
compara o segredo em tempo constante; buckets com limite de tamanho e tipos.

### Persistência e histórico

- `assistant_conversations`/`assistant_messages` persistem tudo, mas com os
  defeitos A1, A4 e A5.
- A exclusão de conta (LGPD) já apaga conversas e mensagens; precisa apagar
  também o novo registro de uso.

### Fora do código (configuração externa)

Chave e saldo da OpenAI, SMTP, Expo/EAS, `supabase db push` e deploy das
funções, provedor de cobrança. Nada disso é alterado nesta frente; cobrança
continua sem implementação até a escolha do provedor.

## Plano

1. Migration do assistente: registro de uso diário próprio (independente das
   mensagens), reserva atômica da cota no Postgres, dia em
   `America/Sao_Paulo`, limite em um lugar só, turnos gravados em duas etapas
   e colunas de modelo/tokens.
2. Edge Function: núcleo testável fora do Deno, ferramentas sob a RLS do
   usuário, validação de entrada, prazo na chamada, contexto dos cartões no
   histórico, `max_completion_tokens`.
3. Migration de autorização: S1 a S4.
4. Testes: `node --test` para o núcleo, as ferramentas e o cliente OpenAI
   (servidor falso, sem custo); SQL comportamental para cota, histórico e
   autorização; cenário de cancelamento determinístico.

## Resolução

Tudo o que está abaixo foi implementado e verificado no ambiente local nesta
execução. Nada foi aplicado em produção, nada foi commitado e nenhuma chamada
paga foi feita à OpenAI.

### O que mudou

**Migrations novas** (aplicadas no banco local com `supabase migration up`,
sem reset):

- `20260930120000_assistant_launch.sql` — tabela `assistant_usage_daily` (uso
  por usuário e por dia, com RLS de leitura própria), `assistant_day_limit()`
  e `assistant_local_day()`, `assistant_usage_today()` reescrita sobre o
  registro, RPCs `assistant_begin_turn` / `assistant_finish_turn` /
  `assistant_abort_turn` (só `service_role`), colunas `model`,
  `prompt_tokens` e `completion_tokens` em `assistant_messages`, e
  `customer_delete_account` apagando também o registro de uso.
- `20260930121000_authorization_hardening.sql` — políticas `FOR ALL` de
  `establishment_members` e `appointments` trocadas por políticas do tamanho
  do que os apps fazem, gatilhos de identidade imutável, guarda da loja
  estendida a nota e cidade, `queue_code_matches` fora do alcance de
  `authenticated`.

**Edge Function `assistant`**, dividida para ser testável fora do Deno:

- `core.ts` — o turno: validação do pedido, laço de ferramentas, devolução da
  reserva, contexto dos cartões no histórico. Sem dependência de runtime.
- `store.ts` — cota e histórico pelas RPCs.
- `openai.ts` — Chat Completions com `max_completion_tokens`, prazo de 20 s
  por chamada e os três tipos de falha (configuração, sem crédito,
  indisponível).
- `tools.ts` — ferramentas com validação de argumentos, rodando com o cliente
  **do usuário**.
- `index.ts` — só liga as pontas.

### Achado por achado

| #   | Estado    | Como foi resolvido                                                                                                        | Prova                                                                                        |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A1  | Resolvido | Cota em `assistant_usage_daily`, independente das mensagens.                                                              | `assistant.sql` §6; integração "apagar o histórico inteiro não devolve a cota"               |
| A2  | Resolvido | Reserva em uma instrução (`insert … on conflict do update … where used < limite`) antes do modelo.                        | Integração "30 perguntas em paralelo": passam exatamente as que cabem, 20 perguntas gravadas |
| A3  | Resolvido | `runTool` recebe o cliente do usuário; a chave secreta só grava cota e histórico.                                         | `assistant.sql` §8 (loja suspensa invisível); integração "ferramentas sob RLS"               |
| A4  | Resolvido | Pergunta e resposta em etapas separadas com `clock_timestamp()`; cartões antigos voltam ao modelo como referência de IDs. | `assistant.sql` §2 (ordem `user,assistant,user`); unitário "histórico leva ao modelo os ids" |
| A5  | Resolvido | Erros de gravação são conferidos e logados; falha do modelo devolve a reserva (`abort`), idempotente.                     | `assistant.sql` §3; unitários de falha; integração "modelo sem crédito"                      |
| A6  | Resolvido | Dia em `America/Sao_Paulo`; limite só em `assistant_day_limit()`; a função lê o `remaining` que o banco devolve.          | `assistant.sql` §7                                                                           |
| A7  | Resolvido | `AbortSignal.timeout` por chamada.                                                                                        | Unitário "upstream travado é cortado pelo prazo"                                             |
| A8  | Resolvido | `max_completion_tokens`.                                                                                                  | Unitário "pedido à OpenAI"                                                                   |
| A9  | Resolvido | `parseRequest` e validação de UUID, categoria e data nas ferramentas; erro do banco não vai ao modelo.                    | Unitários de corpo e de ferramentas; fumaça no runtime (400 `invalid_body`)                  |
| A10 | Resolvido | Modelo e tokens somados por resposta gravados em `assistant_messages`.                                                    | `assistant.sql` §2; integração (200/20 tokens em 4 chamadas)                                 |
| A11 | Resolvido | Contrato provado por comportamento e enviado aos workers mobile e web.                                                    | `assistant.sql` §1, §5, §6                                                                   |
| A12 | Aberto    | Decisão de produto (moderação, retenção).                                                                                 | —                                                                                            |
| S1  | Resolvido | Sem `INSERT` direto em `establishment_members`; `UPDATE` não troca pessoa nem loja.                                       | `launch-security.sql`; falha reproduzida no estado anterior (dono leu perfil alheio)         |
| S2  | Resolvido | Equipe sem `DELETE` em `appointments`; `INSERT` direto só de balcão; cliente e loja da reserva imutáveis.                 | `launch-security.sql` (avaliação sobrevive; balcão e mudança de situação seguem funcionando) |
| S3  | Resolvido | `guard_establishment_status` recusa `rating_avg`, `rating_count` e `city_id` fora de caminho privilegiado.                | `launch-security.sql` (perfil público continua editável)                                     |
| S4  | Resolvido | `revoke execute … from authenticated`.                                                                                    | `launch-security.sql` (`queue_join` ainda recusa código errado por dentro)                   |
| S5  | Resolvido | O teste cria a própria reserva futura; o cenário não é mais pulado.                                                       | `launch-security.sql` sem `NOTICE` de caso pulado                                            |

Antes de apertar S1–S3, conferi nos apps (`apps/portal`, `apps/mobile-staff`)
que nenhum usa os caminhos fechados: não há `insert`/`delete` em
`establishment_members`, nem `delete` em `appointments`, e o único `insert`
direto de reserva é o de balcão (`customer_id: null`).

### O que foi executado

| Verificação                                                      | Resultado                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| `bash scripts/run-db-sql.sh supabase/tests/launch-security.sql`  | `launch-security: OK`                                |
| `bash scripts/run-db-sql.sh supabase/tests/assistant.sql`        | `assistant: OK`                                      |
| `pnpm db:check-rls`                                              | todas as tabelas com RLS e política                  |
| `supabase db lint --local --level warning`                       | sem achados                                          |
| `pnpm db:types`                                                  | regenerado (+70 linhas), versionado junto            |
| `pnpm --filter @vez/supabase test`                               | 31 passam, 5 pulados (integração, sem variáveis)     |
| Mesmo comando com `API_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY` locais | os 5 de integração passam contra o banco local       |
| `pnpm typecheck` / `pnpm lint`                                   | 7 pacotes, sem erro                                  |
| `pnpm -r test`                                                   | 114 passam, 0 falham                                 |
| Fumaça no Edge Runtime local (Deno)                              | 401 sem login; 400 corpo inválido; 429 cota esgotada |

A fumaça no runtime usou só caminhos que param antes da OpenAI. O laço
completo com o modelo foi exercitado pelos testes com roteiro, não com a API
real.

### O que não foi verificado

- **Resposta real do modelo.** Nenhuma chamada foi feita à OpenAI: o formato
  do pedido segue a referência oficial e o laço foi testado contra roteiro,
  mas a primeira pergunta de verdade só acontece com saldo na conta.
- **Aplicação das migrations do zero.** Foram aplicadas por cima do banco
  local existente (`migration up`); o `db reset` ficou proibido nesta frente.
  O job `database` do CI aplica do zero.
- **`deno check`.** Não há Deno instalado nesta máquina; a função carregou e
  respondeu no Edge Runtime local, e os módulos passam no `tsc` do pacote.
- **`temperature` com outros modelos.** O pedido envia `temperature: 0.3`,
  aceito por `gpt-4o-mini`. Modelos de raciocínio recusam o parâmetro: trocar
  `OPENAI_MODEL` para um deles exige tirar essa linha de `openai.ts`.

### Pendências

Com o coordenador (arquivos fora desta frente):

- [ ] Incluir `supabase/tests/assistant.sql` em `db:test:behavior`.
- [ ] Opcional: ligar os testes de integração no job `database` do CI.
- [ ] Atualizar `docs/assistente.md` e `docs/decisions/0005`: limite em um
      lugar só, cota no dia de Brasília, `max_completion_tokens`, prazo de
      20 s, histórico e custo gravados, ferramentas sob RLS.

Configuração externa, sem código a escrever:

- [ ] Saldo na conta da OpenAI e `supabase secrets set OPENAI_API_KEY` no
      projeto hospedado; conferir `OPENAI_MODEL` na conta.
- [ ] `supabase db push` (33 migrations antigas + 2 novas) e deploy das
      Edge Functions.
- [ ] SMTP, Expo/EAS, provedor de e-mail transacional.
- [ ] Provedor de cobrança: nenhuma cobrança foi implementada ou simulada.

Decisões de produto em aberto:

- Moderação do que o usuário escreve e retenção automática das conversas
  (hoje ficam até a pessoa apagar ou excluir a conta).
- `queue_entries_manage_establishment` continua `FOR ALL` para a equipe
  (inclui apagar entrada da fila). Não tem o efeito colateral de S2 e o app
  reordena a fila por `update`; fica registrado, não alterado.
- Três arquivos de `supabase/functions` já estavam fora do padrão do Prettier
  antes desta frente (`cancel-appointment`, `delete-account`,
  `establishment-invite`); não foram tocados.
