# Funcionalidades do sistema

Inventário do que cada superfície do Vez faz hoje — os dois apps, os dois
painéis web e a landing — e de onde cada tela tira o dado. Serve de base para
decidir backend, banco e tecnologias.

Este documento descreve **o que existe**, não o que deveria existir. Onde a tela
promete algo que o banco não tem, isso está marcado.

## Panorama

Cinco superfícies sobre um backend Supabase único.

| Superfície       | Stack | Porta | Linhas | Estado                                            |
| ---------------- | ----- | ----: | -----: | ------------------------------------------------- |
| `mobile-cliente` | Expo  |  8081 |  5.475 | **Funcional** — tudo vem do banco                 |
| `mobile-staff`   | Expo  |  8082 |  9.631 | **Funcional** — tudo vem do banco                 |
| `portal`         | Next  |  3001 |  8.071 | **Protótipo** — dado fixo, não fala com o banco   |
| `admin`          | Next  |  3002 |      — | **Funcional** — Auth, leitura e ações no Supabase |
| `landing`        | Next  |  3000 |  3.229 | **Protótipo** — dado fixo, formulário não envia   |

`packages/mobile-kit` (471 linhas) é o que os dois apps Expo compartilham:
tokens, tipografia, formatação, `useAsync` e sessão.

O banco tem **29 tabelas**, **17 enums**, **55 funções** e **73 políticas de
RLS**. Três Edge Functions: `book-appointment`, `cancel-appointment`,
`assistant`.

---

## Modelo de domínio

O vocabulário que todas as superfícies compartilham. Nomes reais das tabelas.

**Cadastro e identidade**

- `cities` — cidade atendida. Nome, UF, slug, código IBGE, ativa ou não.
- `establishments` — a loja. Cidade, categoria (barbearia, salão, estética,
  dermatologia, petshop, unhas, odontologia e massagem), situação (`pending` →
  `active` → `suspended`), modo de agendamento (`scheduled`, `queue`, `both`),
  endereço, coordenadas, cor de destaque, nota média e contagem de avaliações.
- `profiles` — pessoa. Espelha `auth.users`, nasce por gatilho. Neutra quanto a
  papel: a mesma pessoa é cliente numa loja e equipe em outra.
- `establishment_members` — vínculo N:N entre pessoa e loja, com papel
  (`owner`, `manager`, `staff`).
- `platform_admins` — equipe da plataforma, com papel (`admin`, `operations`,
  `finance`, `support`) e última atividade.
- `plans` / `establishment_decisions` — modelos de cobrança e histórico da
  decisão sobre cada cadastro.
- `platform_settings` / `admin_audit_log` / `admin_access_sessions` — parâmetros,
  auditoria transacional e acesso temporário a uma conta.

**Catálogo**

- `services` — serviço **da loja**: nome, descrição, duração, preço, ativo,
  ordem. A duração é o que fatia a agenda.
- `catalog_items` / `search_events` — catálogo curado da plataforma, sinônimos e
  buscas sem resultado; `services.catalog_item_id` liga o nome da loja ao item.
- `professionals` — profissional da loja, opcionalmente ligado a um `profile`.
- `professional_services` — quem faz o quê.
- `establishment_photos` — fotos da loja (tabela existe, upload não).

**Agenda**

- `business_hours` — funcionamento por dia da semana.
- `professional_schedules` — jornada de cada profissional por dia da semana.
- `schedule_exceptions` — feriado da loja ou folga de uma pessoa; dia inteiro ou
  faixa de horas.
- `appointments` — a reserva. Preço **congelado no ato**, sinal, situação
  (`scheduled`, `confirmed`, `completed`, `cancelled_by_customer`,
  `cancelled_by_establishment`, `no_show`), motivo do cancelamento, e campos de
  cliente de balcão (`guest_name`, `guest_phone`).

**Fila**

- `queue_entries` — lugar na fila. Situação (`waiting`, `called`, `in_service`,
  `done`, `left`, `no_show`), origem (`app`, `qr`, `counter`), confirmação de
  chegada, e os quatro carimbos de tempo do ciclo.

**Depois do atendimento**

- `reviews` — avaliação. **Amarrada a um `appointment_id` único**: sem
  atendimento não existe avaliação. Nota, comentário e marcadores.
- `review_reports` — denúncia, esclarecimento e decisão de moderação.
- `customer_blocks` — impede novos agendamentos sem apagar o histórico; a Edge
  Function também bloqueia ao atingir o limite de faltas em 30 dias.
- `payments` — esquema pronto, **nenhuma linha e nenhuma política de escrita**.

**Configuração e assistente**

- `establishment_settings` — 17 interruptores: como a fila funciona, se a
  reserva nasce confirmada, se o sinal volta, se aceita pagamento no app.
- `member_notification_prefs` — quais avisos cada pessoa da equipe recebe.
- `assistant_conversations` / `assistant_messages` — histórico do assistente,
  com cartões em JSON para o app desenhar nativo.

**Funções que a agenda usa** (regra R1: cálculo de horário só no Postgres)

- `available_slots(loja, serviço, data, profissional?)` — os horários livres.
- `availability_summary(loja, serviço, de, dias, profissional?)` — resumo de N dias.
- `queue_state(loja)` — o estado da fila num objeto só.
- `refresh_establishment_rating()` — recalcula nota média ao gravar avaliação.
- Helpers de política: `is_platform_admin`, `is_establishment_member`,
  `has_establishment_role`, `current_establishment_ids`, `shares_establishment_with`.

**A trava contra venda dupla** é do banco, não do app: a constraint de exclusão
`appointments_no_overlap` impede dois agendamentos ativos do mesmo profissional
se sobreporem. O segundo recebe erro `23P01`.

---

## App do cliente — `mobile-cliente`

Expo Router, 18 rotas. **Tudo vem do banco.**

| Tela                                       | Faz                                                                                | Origem                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Home                                       | Cidade atual, categorias com contagem, lojas em destaque, atalho para a fila ativa | `cities`, `establishments`, `queue_entries`                 |
| Explorar                                   | Busca por nome e navegação por categoria                                           | contagem real, `ilike` no nome                              |
| Resultados                                 | Busca loja, serviço curado e sinônimos por cidade/categoria                        | RPC `search_establishments`                                 |
| Loja                                       | Ficha: serviços, profissionais, avaliações, modo de agendamento                    | `establishments` + `services` + `professionals` + `reviews` |
| Horário                                    | Grade de horários livres, por dia e por profissional                               | RPC `available_slots` / `availability_summary`              |
| Confirmar                                  | Resumo da reserva, preço e política de sinal                                       | Edge Function `book-appointment`                            |
| Pagamento                                  | Escolha entre pagar no app ou no balcão                                            | política da loja                                            |
| Agenda                                     | Reservas em três abas; cancelar e avaliar                                          | `appointments`                                              |
| Fila                                       | Posição, estimativa e confirmação de chegada, ao vivo                              | RPC `queue_state` + Realtime                                |
| Avaliação                                  | Nota, comentário e marcadores                                                      | grava em `reviews`                                          |
| Perfil                                     | Dados da conta                                                                     | `auth.users` + `profiles`                                   |
| Assistente                                 | Conversa em linguagem natural que devolve cartões de loja e horário                | Edge Function `assistant` (OpenAI)                          |
| Entrar / Cadastro / Recuperar / Nova senha | Conta por e-mail, senha e código de 6 dígitos                                      | Supabase Auth                                               |

**O que o cliente consegue fazer ponta a ponta:** achar loja, ver horário livre
de verdade, reservar, entrar na fila, acompanhar a posição ao vivo, cancelar
dentro da janela, e avaliar depois de atendido.

**Lacunas conhecidas:** não existe tela de detalhe/remarcação de reserva (só
cancelar pelo cartão), nem edição de perfil, nem upload de foto, nem busca por
proximidade (coordenadas são guardadas, a ordenação não usa). O histórico do
assistente é gravado mas a tela abre vazia.

---

## App do estabelecimento — `mobile-staff`

Expo Router, 18 telas, cinco abas. **Tudo vem do banco.** Duas portas: ter conta
não basta, é preciso ser equipe de alguma loja.

| Tela                            | Faz                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Hoje                            | Agenda do dia, estado da fila, concluídos e soma do dia, alertas reais                             |
| Agenda                          | Visão de dia, 7 dias e mês                                                                         |
| Detalhe da reserva              | Seis transições de status: aprovar, recusar com motivo, remarcar, concluir, marcar falta, cancelar |
| Novo agendamento                | Reserva feita pelo balcão, inclusive para cliente sem app (`guest_name`)                           |
| Bloquear                        | Feriado da loja ou folga de uma pessoa                                                             |
| Fila                            | Chamar, sentar, concluir, marcar ausência, reordenar — com Realtime                                |
| Config. da fila                 | Entrada remota, confirmação de chegada, QR, fila por profissional, fechamento automático, avisos   |
| Serviços                        | Leitura e escrita de `services` e de quem faz o quê                                                |
| Profissionais                   | Leitura (o cadastro é trabalho do portal)                                                          |
| Horários                        | Funcionamento, jornadas e o gráfico de interseção com `available_slots`                            |
| Regras                          | Aprovação automática, sinal percentual, janela de cancelamento, antecedência mínima                |
| Perfil público                  | O que o cliente vê: descrição, endereço, cor                                                       |
| Financeiro                      | Faturamento, ticket médio, atendimentos e mais vendidos — soma do preço congelado                  |
| Assinatura                      | **Sem plano.** A tela explica os dois modelos em estudo em vez de inventar número                  |
| Ajustes                         | Preferências de aviso da pessoa                                                                    |
| Começar                         | Checklist derivado do estado real da loja                                                          |
| Entrar / Recuperar / Nova senha | Conta                                                                                              |

**A aba do meio mostra quantas pessoas estão esperando agora** — o único número
do app que muda sem ninguém tocar em nada.

**Lacunas conhecidas:** cadastro de profissional e edição de escala não têm tela
(é o portal). Upload de foto depende do Storage, que não foi ligado. Sete
interruptores gravam e ainda não atuam — esperam a peça que vai lê-los.
Notificação push não existe, e é a lacuna mais séria: a fila só se move na tela
com o app aberto.

---

## Portal do estabelecimento — `portal`

Next.js, 12 seções. Implementa o canvas `Portal Vez.dc.html`.
**Protótipo: o dado está em `components/data.ts` e `section-data.ts`.**

| Seção              | Faz                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Visão geral        | Cinco indicadores do dia, alertas acionáveis, reservas pendentes                            |
| Agenda             | Três visões — dia, semana e equipe — com painel de detalhe                                  |
| Fila de espera     | Fila ao vivo com origem de cada pessoa (app, QR, balcão) e prazo de confirmação             |
| Clientes           | Base de clientes                                                                            |
| Serviços           | Catálogo da loja por categoria                                                              |
| Equipe             | Profissionais e convites                                                                    |
| Horários           | Funcionamento, intervalo entre atendimentos, escala da semana, o que o cliente vê como vaga |
| Financeiro         | Faturamento dia a dia, desempenho por profissional, mais vendidos, recebimentos do app      |
| Perfil público     | Dados da loja, fotos, cor da marca                                                          |
| Configurações      | Regras de agendamento, de pagamento, de fila e avisos da equipe                             |
| Plano e assinatura | Cobrança recusada, histórico de pagamentos                                                  |
| Primeiros passos   | Checklist de publicação em quatro itens                                                     |

**Novo agendamento** é um painel completo, aberto por botão ou pela tecla `N`:
busca de cliente por nome ou telefone, escolha de serviço e profissional,
detecção de conflito, sinal de 30% e escolha entre cobrar pelo app ou no balcão.
Cria com toast e desfazer em 5 segundos.

O resto das seções é montado por um renderizador genérico de blocos — `kpis`,
`table`, `list`, `chips`, `cards`, `chart`, `checklist`, `layers`, `profile`,
`schedule`.

---

## Painel administrativo — `admin`

Next.js, 11 telas e 3 modais. Implementa o canvas `Vez Portal Admin.dc.html`.
**Funcional: exige Supabase Auth, lê por RPCs protegidas e grava ações com
auditoria transacional.** Detalhes e limites em [admin.md](admin.md).

| Tela                     | Faz                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Visão geral              | Fila de trabalho (aprovações, chamados, denúncias, cobranças vencidas), receita recorrente, ativos, agendamentos, vagas por cidade      |
| Aprovações               | Fila por tempo de espera, ficha do solicitante, escolha do plano inicial conforme a cota da cidade, aprovar / recusar / pedir correção  |
| Estabelecimentos         | Tabela com filtros, sinalização de risco, seleção em massa, exportação                                                                  |
| Ficha do estabelecimento | Indicadores, uso, dados cadastrais e autorização auditada para suporte; console de leitura ainda pendente                               |
| Cidades                  | Situação, vagas, preço local e categorias; abrir, ativar ou retirar cidade da busca                                                     |
| Cotas e planos           | Dois modelos operacionais, cota por cidade, intervalo entre trocas e impacto imediato das edições                                       |
| Financeiro               | Estimativa de receita; cobranças, repasses e automações aguardam o provedor                                                             |
| Serviços                 | **Catálogo global curado**, com nomes alternativos para a busca, sugestões das lojas e buscas sem resultado                             |
| Avaliações               | Fila de denúncias com decisão fundamentada (manter ou remover, com motivo obrigatório e impacto na nota), e panorama das notas por loja |
| Clientes finais          | Base, taxa de não comparecimento, bloqueio de novos agendamentos                                                                        |
| Configurações            | Equipe e níveis de acesso, parâmetros da plataforma, registro de auditoria                                                              |
| Suporte / Vitrine        | Fora do escopo desta rodada do canvas                                                                                                   |

---

## Landing — `landing`

Implementa o canvas `Vez Landing.dc.html` do projeto Claude Design
`fe25ed41-2e78-475f-b0e0-1b4cb32c37f5`. Página única, estática no build, que
fala com o dono do estabelecimento — o cliente final só ganha um link para o app.

Seções: problema, como funciona (três passos), recursos, o lado do cliente,
planos com a tabela "qual sai mais barato", dúvidas e cadastro. As maquetes
(agenda da semana, busca, fila, financeiro) são desenho, não telas ligadas.

**Sem localidade e sem vagas.** O canvas vendia vagas de mensalidade limitadas
por cidade, com seletor de cidade, contador e "ainda dá tempo". A venda não vai
começar por cidades, então tudo isso saiu: a página não nomeia cidade nem conta
vagas. Os dois planos aparecem como escolha da loja, cada um com a faixa em que
compensa (o ponto de virada da tabela).

| Dado                     | Origem                                                |
| ------------------------ | ----------------------------------------------------- |
| Mensalidade e comissão   | `components/data.ts` — R$ 189 e 6%, props do canvas   |
| Tabela e ponto de virada | Calculados de mensalidade, comissão e ticket de R$ 60 |

O que a página promete e não entrega:

- **O formulário não envia.** Não existe tabela de interessados nem a Edge
  Function de cadastro que validaria a cota (ver "Cadastro de loja" abaixo).
- **"Entrar" aponta para `#entrar`**, âncora que não existe — o portal ainda não
  tem login.
- Termos, privacidade, o telefone e o CNPJ do rodapé são texto do canvas.

---

## Fluxos que atravessam superfícies

**Reserva.** Cliente escolhe horário (`available_slots`) → `book-appointment`
congela o preço e aplica a política de sinal → loja aprova ou a reserva já nasce
confirmada (`auto_approve`) → loja conclui → cliente avalia. A avaliação só
existe porque alguém marca `completed`.

**Fila.** Cliente entra pelo app, por QR ou pelo balcão → aparece nas duas telas
com Realtime → a loja chama, senta e conclui → o cliente vê a posição mudar.

**Cancelamento.** `cancel-appointment` aplica a janela da loja
(`cancellation_window_minutes`) e decide se o sinal volta
(`deposit_refundable`).

**Cadastro de loja.** _Ainda não fecha._ Não existe política de INSERT em
`establishments` para `authenticated`, nem a Edge Function que validaria a cota
da cidade. E nenhuma loja sai de `pending` sozinha — o gatilho
`guard_establishment_status` fechou esse buraco de propósito. Quando a loja já
existe como `pending`, o admin conectado aprova, recusa ou pede correção.

---

## As superfícies conversam entre si?

**Os dois apps, sim — completamente.** Escrevem e leem as mesmas tabelas, com
Realtime dos dois lados. O ciclo cliente↔loja fecha hoje.

**O admin, sim. O portal do estabelecimento, ainda não.** O admin autentica a
equipe, lê o snapshot por RPCs e persiste todas as ações já modeladas. O portal
continua como protótipo fiel ao design, com dado fixo.

Três observações que importam antes de escrever o backend:

**1. Portal e app da equipe cobrem quase a mesma coisa.** Agenda, fila,
serviços, horários, financeiro, perfil público e configurações existem nas duas
superfícies. Hoje o app é o que funciona. O que o portal tem de exclusivo é
cadastro de profissional, edição de escala e ligação serviço↔pessoa — que o app
deliberadamente deixou de fora. **Decisão pendente:** o portal é a superfície de
cadastro e planejamento (e o app, a de operação do dia), ou os dois fazem tudo?
A resposta muda o quanto de backend novo o portal exige.

**2. Planos e cotas já têm modelo; cobrança e repasse ainda não.** Mensalidade e
comissão coexistem, com cota e preço por cidade. O provedor, faturas, webhook e
repasse continuam sendo decisão de negócio antes da implementação financeira.

**3. Catálogo global e serviço da loja agora são conceitos separados.**
`catalog_items` guarda o item curado e os sinônimos; cada `services` continua
pertencendo a uma loja e pode apontar para o item global.

---

## O que o banco ainda não tem

Levantado a partir do que os dois protótipos mostram. Nada aqui existe hoje.

| Precisa para              | O que falta no banco                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Loja se cadastrar         | Política de INSERT em `establishments` + Edge Function `create-establishment`               |
| Assinatura                | `subscriptions`, ciclo e histórico de cobrança                                              |
| Cobranças e inadimplência | Faturas, vencimento, carência, suspensão automática                                         |
| Repasses                  | Conciliação de `payments` → valor a repassar → envio                                        |
| Pagamento de verdade      | `payments` existe **sem nenhuma política de escrita**; falta provedor e definir quem recebe |
| Suporte                   | Chamados                                                                                    |
| Vitrine                   | Banners da Home                                                                             |
| Notificação push          | Tokens de dispositivo e envio                                                               |
| Foto de loja              | `establishment_photos` existe; Storage não foi ligado                                       |
| Excluir conta (LGPD)      | Edge Function — RLS não apaga `auth.users`                                                  |

---

## Regras que qualquer trabalho novo respeita

Do [roadmap](roadmap-mobile-cliente.md) e de
[proximos-passos.md](proximos-passos.md):

- **R1** — disponibilidade só no Postgres. Nem o assistente é exceção.
- **R2** — toda tabela nasce com RLS e política, na mesma migration.
- **R3** — fixture morre quando a tabela nasce. Nada de fallback silencioso.
- **R4** — escrita privilegiada é Edge Function. Chave secreta nunca no cliente.
- **R7** — nada de número inventado. Zero verdadeiro vence estimativa bonita.
- **R8** — `packages/` só quando o segundo consumidor existir.
- **R9** — mudança de agenda não invalida venda em silêncio.
