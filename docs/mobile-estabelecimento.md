# App do estabelecimento — implementação do design

`apps/mobile-staff` implementa o canvas `Vez Estabelecimento.dc.html` do projeto
Claude Design `d8a7d25e-1aef-46f5-adcc-e5d4063c6a62`: 18 telas, cinco abas.

É o outro lado do [app do cliente](mobile-cliente.md). O cliente compra; esta é
a superfície que **faz o dia acontecer** — sem ela a fila não anda, reserva não
vira atendimento e avaliação nunca existe (era o item 1 de
[proximos-passos.md](proximos-passos.md)).

O canvas foi ponto de partida, não especificação final. O que mudou está em
"[O que o canvas prometia e a tela não entrega](#o-que-o-canvas-prometia-e-a-tela-não-entrega)".

## Navegação

Duas camadas, mesma regra R5 do app do cliente:

- **`app/(tabs)/`** — os cinco destinos da barra: `index` (Hoje), `agenda`,
  `fila`, `loja`, `mais`.
- **`app/`, na raiz** — tudo empilhado: `agendamento/[id]`, `novo-agendamento`,
  `bloquear`, `fila-config`, `servicos`, `servico/[id]`, `profissionais`,
  `horarios`, `regras`, `perfil-publico`, `financeiro`, `assinatura`,
  `ajustes`, `comecar`, e as três telas de conta (`entrar`, `recuperar`,
  `nova-senha`).

O portão fica em `app/(tabs)/_layout.tsx` e não em cada tela: aqui não existe o
"olhe antes de entrar" do app do cliente — não há nada para ver sem conta,
porque tudo é a operação de uma loja específica. E há uma segunda porta depois
do login: ter conta não basta, é preciso ser equipe de alguma loja.

### A aba do meio não tem ícone

As quatro abas laterais usam ícone de traço do `lucide-react-native`, seguindo a
[decisão 0002](decisions/0002-navegacao-e-icones-do-app-cliente.md). A do meio
mostra **quantas pessoas estão esperando agora**.

É o único número do app que muda sem ninguém tocar em nada, e ele precisa estar
visível em qualquer tela: o atendente que está mexendo em preço de serviço tem
que ver a fila crescer sem sair de onde está. O canvas desenhava quadradinhos
vazados nas cinco abas; quadradinho vazado não diz "agenda".

## O que é dado real

**Tudo o que o app mostra vem do banco.** Não existe `fixtures.ts` — a regra R3
vale desde a primeira tela.

| Tela             | Origem                                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| Hoje             | `appointments` do dia, `queue_state`, contagem e soma de concluídos           |
| Detalhe          | `appointments` + serviço + profissional + perfil; seis transições de status   |
| Agenda           | `appointments` no intervalo da visão (dia, 7 dias, mês)                       |
| Novo agendamento | `available_slots` para o horário; insert com `guest_name`                     |
| Bloquear         | `schedule_exceptions`                                                         |
| Fila             | `queue_state` + `queue_entries`, com Realtime                                 |
| Config da fila   | `establishment_settings` + `establishments.booking_mode`                      |
| Serviços         | `services` + `professional_services`, leitura e escrita                       |
| Profissionais    | `professionals` + `establishment_members` + escalas (leitura)                 |
| Horários         | `business_hours`, `professional_schedules` e **`available_slots`** no gráfico |
| Regras           | `establishment_settings` + `deposit_percent`, `min_lead_minutes`, janela      |
| Perfil público   | `establishments`, leitura e escrita                                           |
| Financeiro       | soma de `appointments` concluídos, por período                                |
| Ajustes          | `member_notification_prefs` + `auth.updateUser`                               |
| Começar          | derivado do estado real da loja, sem coluna de progresso                      |
| **Assinatura**   | **nada** — a tela diz por quê (ver abaixo)                                    |

### Nenhum cálculo de horário em TypeScript

Vale aqui com força extra, porque a tentação é maior: o app do estabelecimento
já tem a agenda inteira do dia na mão. `src/ui/SlotPicker.tsx` e o gráfico de
interseção da tela de Horários chamam `available_slots()` e desenham o que
voltou. Se a loja calculasse por conta própria, o balcão ofereceria por telefone
um horário que o app acabou de vender.

O gráfico de "o que o cliente vê como vaga livre" é o caso mais bonito disso:
as três camadas de cima (loja aberta, escala, já agendado) são desenho a partir
das tabelas, e a faixa verde embaixo vem da própria função. Se ela estiver
vazia com tudo aberto, é porque o banco realmente não tem vaga — e a resposta
está nas camadas acima.

## O que mudou no banco por causa deste app

Quatro migrations, cada uma com a sua decisão registrada:

| Migration                            | O que resolve                         | Decisão                                              |
| ------------------------------------ | ------------------------------------- | ---------------------------------------------------- |
| `..._establishment_settings.sql`     | onde gravar as três telas de ajuste   | [0007](decisions/0007-ajustes-da-loja-no-banco.md)   |
| `..._walk_in_customers.sql`          | cliente de balcão na fila e na agenda | [0006](decisions/0006-cliente-sem-conta.md)          |
| `..._queue_arrival_position.sql`     | quem não chegou não segura a fila     | [0007](decisions/0007-ajustes-da-loja-no-banco.md)   |
| `..._establishment_status_guard.sql` | loja não se aprova sozinha            | [0008](decisions/0008-loja-nao-se-aprova-sozinha.md) |

A Edge Function `book-appointment` passou a ler `auto_approve`: com o
interruptor ligado, a reserva nasce `confirmed` em vez de `scheduled`. É o que
faz a pilha "precisa da sua decisão" nascer vazia.

## Os dois estados da vez

`appointment_status` já tinha os seis estados; este app é o primeiro que os usa
todos. A leitura de produto que o app assume:

- **`scheduled`** = pedido feito, esperando o sim da loja.
- **`confirmed`** = aprovado.

Aprovar é `scheduled → confirmed`; recusar é `→ cancelled_by_establishment` com
`cancellation_reason` gravado, porque o motivo sai daqui e chega no app do
cliente. Recusar em silêncio é o que faz a pessoa não voltar.

Na fila, o ciclo é `waiting → called → in_service → done`. O canvas pulava de
"chamar" direto para "atendendo"; o schema tem o passo do meio, e ele é útil:
quem foi chamado e ainda não sentou aparece numa faixa própria, com a opção
"Sentou" e a de marcar ausência.

## Traduções de CSS para React Native

O canvas é HTML e CSS. Quatro coisas não tinham equivalente direto:

**`repeating-linear-gradient(135deg, …)` → `Hatch`.** O React Native não tem
gradiente repetido. `src/ui/primitives.tsx` desenha faixas giradas 45° dentro de
uma caixa que corta o excesso. Aparece no buraco do trilho e no lugar da foto de
capa.

**`linear-gradient` de fade → `expo-linear-gradient`.** Só um uso: a esmaecida
branca acima da ação flutuante da Fila.

**`transition: transform .18s` do interruptor → `Animated`.** O RN tem `Switch`
nativo e ele não serve: usa a cor do sistema e ignora raio e sombra. Como o
interruptor aparece dezesseis vezes em três telas, ele é elemento de marca.

**`@keyframes vezpulse` → `PulseDot`.** O ponto verde do "ao vivo".

**`letter-spacing` em px → em.** `sans()` e `mono()` recebem o valor em `em`;
no código o número aparece como `1.2 / 11`, mantendo visível o valor do canvas.

## Compartilhado com o app do cliente

`packages/mobile-kit` nasceu aqui, pela regra R8 — mover para `packages/` quando
o segundo consumidor existir, e não antes:

| Entry                    | O que tem                                     |
| ------------------------ | --------------------------------------------- |
| `@vez/mobile-kit/theme`  | os oito tokens, raios, sombras e a tipografia |
| `@vez/mobile-kit/format` | dinheiro, data, hora, duração, distância      |
| `@vez/mobile-kit/async`  | `useAsync`                                    |
| `@vez/mobile-kit/auth`   | sessão, erros do Supabase em PT, validação    |

**Os componentes de UI não foram para lá.** Os dois canvases desenham cartão,
cabeçalho e barra de abas de formas diferentes; forçá-los no mesmo componente
trocaria duplicação por um componente cheio de `if`, que é pior. O que subiu é o
que é igual e neutro de design — os dois canvases escrevem os mesmos oito
tokens, valor por valor.

`createSessionContext(supabase)` é função e não componente porque cada app tem o
seu cliente: o dono da barbearia é cliente de outra barbearia, e as duas sessões
convivem no mesmo aparelho sem se derrubar.

## O que o canvas prometia e a tela não entrega

**O alerta de conflito de horário saiu.** O canvas abria a Hoje com "conflito às
17:15". Ele não pode acontecer: a constraint de exclusão
`appointments_no_overlap` impede dois agendamentos ativos do mesmo profissional
se sobreporem. O banco resolve antes de a tela precisar avisar. No lugar
ficaram dois alertas que são verdade: cliente atrasado e loja não publicada.

**"Financeiro" não mostra repasses.** A tabela `payments` existe como esquema e
nunca recebeu uma linha. Faturamento, ticket médio, atendimentos e mais vendidos
são reais — soma do preço congelado de cada atendimento concluído. Repasse,
retenção e contestação não aparecem porque não existem.

**"Assinatura" não tem plano.** O canvas mostrava Vez Pro por R$ 89/mês, quatro
faturas pagas e um cartão terminado em 4417. Nada disso existe: monetização é
decisão em aberto (item 4 de proximos-passos.md). A tela explica os dois modelos
em estudo em vez de inventar números — R7.

**Cadastro de profissional e edição de escala não têm tela.** São leitura aqui;
o cadastro é trabalho do portal web da loja (item 2). A tela de Profissionais e
a de Horários dizem isso.

**Envio de foto não existe.** O Storage do projeto não foi ligado.
`establishment_photos` está lá, vazia.

**"R$ 20 fixo" de sinal não existe.** O canvas oferecia sinal fixo ou
percentual; o schema e a Edge Function calculam percentual. A tela oferece 30% e
50%, que é o que o servidor sabe cobrar.

**Sete interruptores gravam e não atuam ainda.** Estão marcados na tela com uma
etiqueta âmbar. O porquê da marcação está na
[decisão 0007](decisions/0007-ajustes-da-loja-no-banco.md).

**Notificação push não existe.** É a lacuna mais séria do produto para esta
superfície: a fila só se move na tela com o app aberto — que é justamente quando
o atendente não está olhando.

## Contas de teste

`supabase/demo/demo-data.sql` cria a equipe da Barbearia Meia-Nove, o dia de
hoje e uma fila viva. Senha das três: `senha-forte-123`.

| Conta               | Papel                               |
| ------------------- | ----------------------------------- |
| `rafael@vez.local`  | dono — acesso total                 |
| `diego@vez.local`   | equipe — não edita cadastro da loja |
| `cliente@vez.local` | cliente, para ver o outro lado      |

```bash
pnpm db:start && pnpm db:reset && pnpm db:demo
cd apps/mobile-staff && npx expo start
```
