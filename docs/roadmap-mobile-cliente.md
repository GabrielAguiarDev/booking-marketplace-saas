# Roadmap do app do cliente

> **Quase todo entregue.** Para o que vem a seguir — e para o desequilíbrio
> entre o app do cliente e as outras quatro superfícies — veja
> [proximos-passos.md](proximos-passos.md).

O app hoje é uma casca completa: as 12 telas existem, navegam entre si e estão
corretas visualmente. Quase nada nelas é verdade — os dados vêm de
`src/data/fixtures.ts`. Este documento diz o que falta, em que ordem, e sob que
regras construir.

Leia junto: [mobile-cliente.md](mobile-cliente.md) (o que existe),
[decisions/0001](decisions/0001-disponibilidade-no-postgres.md) (disponibilidade
mora no Postgres) e [decisions/0002](decisions/0002-navegacao-e-icones-do-app-cliente.md)
(navegação e ícones).

## O estado atual, sem otimismo

| Toca o banco                          | É fixture (ou seja, mentira bonita)                                           |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Lista de cidades                      | Lojas, serviços, profissionais, fotos                                         |
| Contagem de estabelecimentos (hoje 0) | Horários livres, dias, blocos de horário                                      |
| Estados de carregando/erro em Busca   | Fila, posição na fila, "chegou"                                               |
| —                                     | Agenda (próximos, fila, histórico), perfil, avaliações, pagamento, chat da IA |

Não há autenticação. Nenhuma tela sabe quem é o usuário. `PROFILE` é um objeto
literal. O banco tem cinco tabelas de fundação (`cities`, `establishments`,
`profiles`, `establishment_members`, `platform_admins`) e nenhuma tabela de
agendamento.

## As regras

Estas valem para toda fase abaixo. Elas são o motivo do roadmap existir: sem
elas, cada fase seria uma decisão nova.

### R1 — Disponibilidade só existe no Postgres

Nenhuma superfície calcula horário livre em TypeScript. Nunca. O app chama uma
função Postgres por RPC e desenha o que voltar. Se o portal e o app calculassem
separado, o portal ofereceria um horário que o app acabou de vender.
Ver [decisions/0001](decisions/0001-disponibilidade-no-postgres.md).

Corolário prático: **nenhuma tela nova de horário nasce com lógica de horário.**
Se a RPC ainda não existe, a fase está fora de ordem — construa a RPC primeiro.

### R2 — Toda tabela nasce com RLS e política

`alter table … enable row level security` na mesma migration que cria a tabela,
e ao menos uma política junto. `pnpm db:check-rls` falha se alguém esquecer.
Tabela sem política é tabela invisível, não tabela aberta — o erro aparece como
"lista vazia", que é o pior sintoma possível.

### R3 — Fixture morre quando a tabela nasce

Ao ligar uma tela ao banco, **apague** a fixture correspondente em
`src/data/fixtures.ts`. Não a deixe como fallback. Fallback silencioso faz
backend quebrado parecer app funcionando, e o bug só aparece em produção.

Uma fase só está pronta quando a fixture que ela substitui não existe mais.

### R4 — Escrita privilegiada é Edge Function

Leitura vai direto pelo cliente Supabase com RLS. Escrita que precisa validar
algo que a RLS não vê — cota de cidade, transição de status de reserva,
concorrência de horário, cobrança — vai em Edge Function com a chave secreta.
A chave secreta nunca entra em `packages/supabase` nem em código de cliente.

### R5 — Onde a tela mora

Tela com rodapé fixo, ou etapa de fluxo que precisa ser terminada ou abandonada:
raiz de `app/`. Destino de navegação livre: `app/(tabs)/`, e só se for uma das
cinco abas. Voltar de tela empilhada para aba usa `useGoToTab()`.

### R6 — Escolha curta é folha inferior

Modal deslizando de baixo, como `src/ui/CityPicker.tsx`. Nada que abre pode
empurrar o conteúdo que o usuário já estava lendo.

### R7 — Nada de número inventado em tela

Se o dado real ainda não existe, mostre o valor verdadeiro (inclusive zero) ou
um estado vazio explícito. Número de protótipo em tela vira número de protótipo
em reunião.

---

## As fases

Cada fase é uma migration + o que ela destrava no app. A ordem não é preferência:
cada fase depende da anterior. ~~A fase 3 é a que trava tudo~~ (feita) — sem ela não há
reserva, e sem reserva agenda, fila, pagamento e avaliação não têm objeto.

### ~~Fase 1 — Autenticação e perfil real~~ ✅ feita em 2026-09-02

Entregue. Detalhes da decisão em
[decisions/0003](decisions/0003-autenticacao-por-codigo.md).

**Banco:** `enable_confirmations = true`, `minimum_password_length = 8` e dois
templates de e-mail em `supabase/templates/` que mandam código de 6 dígitos em
vez de link mágico. Nenhuma tabela nova — `profiles` e o gatilho
`handle_new_user()` já davam conta.

**App:** `entrar`, `cadastro`, `confirmar`, `recuperar`, `nova-senha` (todas na
raiz de `app/`, por R5). `SessionProvider` + `useSession()`, `AuthGate` nas
quatro telas de reserva, estado deslogado nas abas Agenda e Perfil, e o perfil
lendo `public.profiles` de verdade. `PROFILE` virou `PROFILE_MENU` — a parte de
identidade da fixture morreu (R3).

**Verificado ponta a ponta rodando no simulador:** cadastro → código do e-mail →
sessão → linha em `profiles` com o nome → recuperação de senha → senha antiga
rejeitada. A sessão (2288 bytes) é gravada fatiada no Keychain
(`__vez_chunks__:2`) e remontada idêntica.

**Falta antes de produção:** SMTP real. Ver "Pendências operacionais" no fim.

**O que ficou de fora de propósito:** `app/perfil/editar.tsx` (editar nome e
telefone). As linhas do menu do perfil aparecem como EM BREVE em vez de fingir
que são tocáveis.

### ~~Fase 2 — Catálogo real~~ ✅ feita em 2026-09-02

`services`, `professionals`, `professional_services`, `establishment_photos`, e
colunas novas em `establishments` (descrição, endereço, coordenadas,
`booking_mode`, `accent_color`, política de sinal e cancelamento). Três
categorias novas no enum: `nail_salon`, `dentistry`, `massage`.

### ~~Fase 3 — Disponibilidade no Postgres~~ ✅ feita em 2026-09-02

**A fase que destravava o resto.** `business_hours`, `professional_schedules`,
`schedule_exceptions`, `appointments`, e as duas funções:

- `available_slots(estabelecimento, serviço, data, profissional?)` — os horários
  livres. `SECURITY DEFINER` porque precisa ver as reservas de todos, e devolve
  só intervalos livres, nunca dado de reserva alheia.
- `availability_summary(...)` — contagem por dia e `is_open`, para a fita de dias.

**A trava contra venda dupla é `appointments_no_overlap`** (`exclude using gist`),
não a função. Reservar passa pela Edge Function `book-appointment`, que congela o
preço no servidor e traduz o `23P01`.

Verificado: turno partido respeitado, reserva derruba os horários sobrepostos,
cancelar devolve, feriado zera o dia, segunda reserva na mesma faixa recusada,
preço enviado pelo cliente ignorado, insert direto barrado pela RLS (403).

### ~~Fase 4 — Agenda e ciclo de vida da reserva~~ ✅ feita em 2026-09-02

Enum `appointment_status` com seis estados. Cancelamento pela Edge Function
`cancel-appointment`, que aplica `cancellation_window_minutes` e devolve
`within_free_window`. A agenda lê as três abas de verdade.

**Falta:** `app/reserva/[id].tsx` (detalhe e remarcar). Hoje cancelar e avaliar
acontecem no próprio card da agenda.

### ~~Fase 5 — Fila por ordem de chegada~~ ✅ feita em 2026-09-02

`queue_entries` + `queue_state()`. Posição derivada de `joined_at`, nunca coluna.
Índice parcial impede entrada dupla. A tela assina Realtime.

**Falta:** notificação push quando chega a vez — hoje só atualiza com o app aberto.

### Fase 6 — Pagamento ⟵ **bloqueada, precisa de decisão sua**

`payments` existe como esquema, **sem nenhuma política de escrita**. Nenhuma
cobrança acontece e a tela de confirmação não mostra forma de pagamento de
propósito. Ver a pergunta 5 abaixo.

### ~~Fase 7 — Avaliações~~ ✅ feita em 2026-09-02

`reviews` com `unique` em `appointment_id` e política que exige atendimento
`completed` do próprio usuário. Nota agregada por gatilho em `establishments`.

Verificado: avaliar antes do atendimento → 403; depois → 201 e a nota agrega.

### Fase 8 — Busca de verdade

**Banco:** busca por nome já tem índice trigram em `establishments`. Falta busca
por serviço, por proximidade (PostGIS ou cálculo simples por cidade) e os
filtros de `FILTERS`.

**App:** o primeiro `TextInput` real do projeto. `explorar.tsx` ganha campo que
aceita texto. Buscas recentes viram persistência local.

**Aqui volta a questão da Home:** com busca real, faz sentido reconsiderar um
campo na Home — desta vez um campo que aceita texto, não um botão disfarçado.
Ver [decisions/0002](decisions/0002-navegacao-e-icones-do-app-cliente.md#3-a-home-não-tem-campo-de-busca).

### ~~Fase 9 — Assistente (IA)~~ ✅ estruturado em 2026-09-02

Edge Function `assistant` com a API da OpenAI e três ferramentas: buscar loja,
listar serviço, consultar horário. A de horário **chama `available_slots`** — a
decisão 0001 não abre exceção para o assistente.

Cota de 20 perguntas/dia por usuário, no servidor. Cartões nativos: tocar num
horário leva à confirmação já preenchida.

**Falta só a chave da OpenAI** — ver [assistente.md](assistente.md). Sem ela a
tela diz que não está configurado, que é o estado correto.

**Fora de escopo desta rodada:** streaming, lista de conversas anteriores,
moderação de entrada, e registro de tokens consumidos.

## Telas que ainda não existem

Além das fases, estas telas são citadas ou implicadas pelo fluxo e não têm
arquivo:

| Tela                    | Onde entra               | Fase |
| ----------------------- | ------------------------ | ---- |
| `app/entrar.tsx`        | Entrada por OTP/e-mail   | 1    |
| `app/entrar/codigo.tsx` | Confirmação do código    | 1    |
| `app/reserva/[id].tsx`  | Detalhe/cancelar reserva | 4    |
| `app/perfil/editar.tsx` | Editar dados do perfil   | 1    |
| Onboarding / permissões | Notificação e local      | 5    |
| Estado offline          | Transversal              | —    |

## Funções que ainda não existem

| Função                     | Tipo          | Fase |
| -------------------------- | ------------- | ---- |
| `available_slots(...)`     | Postgres RPC  | 3    |
| Criar reserva              | Edge Function | 3    |
| Transição de status        | Edge Function | 4    |
| Entrar/sair da fila        | Edge Function | 5    |
| Estimativa de espera       | Postgres RPC  | 5    |
| Criar cobrança / webhook   | Edge Function | 6    |
| Agregar nota do estabelec. | Gatilho/view  | 7    |

## Perguntas que precisam de decisão sua antes da fase correspondente

1. ~~Entrada por telefone (OTP) ou e-mail?~~ **Respondida:** e-mail e senha,
   com código de 6 dígitos para confirmar. OTP por telefone pode ser somado
   depois, não é troca. Ver [decisions/0003](decisions/0003-autenticacao-por-codigo.md).
2. ~~A cor de accent da loja~~ **Respondida:** herda da categoria, com coluna
   de override para rede com marca própria.
3. ~~Regra de cancelamento~~ **Respondida:** janela por loja (padrão 2 h);
   cancelar sempre é permitido, o que muda é se foi dentro do prazo.
4. ~~Fila e hora marcada convivem?~~ **Respondida:** sim, via `booking_mode`.
   As três respostas estão em [decisions/0004](decisions/0004-catalogo-disponibilidade-fila.md).
5. **Provedor de pagamento** e quem recebe: a plataforma repassando, ou o
   estabelecimento direto. Isso muda o modelo tributário inteiro. (Fase 6)
6. **Monetização:** o app do cliente não expressa nada sobre mensalidade por
   cidade nem comissão. Onde isso aparece — só no portal? (Transversal)

## Como uma fase é executada

1. Escreva a migration. RLS e política na mesma migration (R2).
2. `pnpm db:reset && pnpm db:types` — os tipos são gerados, nunca escritos à mão.
3. Teste a política por comportamento, não por metadado: leia e escreva como
   `anon` e como usuário autenticado e confirme que o bloqueio acontece.
4. Ligue a tela. Apague a fixture (R3).
5. `pnpm typecheck && pnpm lint && pnpm build && pnpm db:check-rls`.
6. Atualize [mobile-cliente.md](mobile-cliente.md) e risque a fase daqui.

## Pendências operacionais

Coisas que não são fase e travam produção:

- **SMTP.** `[auth.email.smtp]` está comentado em `supabase/config.toml`. Sem um
  provedor real, o Supabase hospedado manda no máximo três e-mails por hora e
  ninguém consegue se cadastrar. É o item mais urgente da lista.
- **Deep links.** Quando houver domínio, dá para acrescentar o link mágico ao
  lado do código, sem mexer nas telas de auth.
- **Excluir conta.** LGPD. Precisa de Edge Function (a RLS não apaga
  `auth.users`) e de uma decisão sobre o que fazer com o histórico de reservas.
