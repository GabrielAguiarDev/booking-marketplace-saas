# App do cliente — implementação do design

`apps/mobile-cliente` implementa o canvas `Vez.dc.html` do projeto Claude Design
`5201d935-8006-4549-9dc5-d385f5b6d816`: 12 telas, cinco abas.

O canvas foi o ponto de partida, não a especificação final. Quatro decisões
tomadas depois dele estão registradas em [decisions/0002](decisions/0002-navegacao-e-icones-do-app-cliente.md)
e a autenticação em [decisions/0003](decisions/0003-autenticacao-por-codigo.md);
o que ainda falta construir está em [roadmap-mobile-cliente.md](roadmap-mobile-cliente.md).

## O que é dado real e o que é protótipo

**Tudo o que o app mostra vem do banco.** `src/data/fixtures.ts` não existe mais
— foi apagado quando as tabelas nasceram, seguindo a regra R3 do roadmap.

| Tela           | Origem                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| Home           | vitrine (`showcase_banners()`), `establishments`, contagem, fila ativa |
| Explorar       | contagem real por categoria; busca por nome (`ilike`)                  |
| Resultados     | `establishments` filtrado por cidade, categoria e termo                |
| Loja           | `establishments` + `services` + `professionals` + `reviews`            |
| Horário        | RPC `available_slots` e `availability_summary`                         |
| Confirmar      | preço do serviço e política de sinal da loja; Edge Function reserva    |
| Agenda         | `appointments` nas três abas, cancelar e avaliar                       |
| Fila           | RPC `queue_state` + Realtime                                           |
| Avaliação      | grava em `reviews`                                                     |
| Perfil         | `auth.users` + `profiles`                                              |
| Ajuda          | chamados e conversa do próprio usuário, pelas RPCs de suporte          |
| **Assistente** | **nada** — a tela diz que não existe ainda (fase 9)                    |

O único conteúdo não vindo do banco é o texto do próprio app e o mapeamento de
categoria → rótulo/ícone/pastel em `src/data/catalog.ts`, que é design, não dado.

### Dados de demonstração

`supabase/seed.sql` guarda só cidades — dado de referência, roda em todo reset.
As duas lojas de teste ficam em `supabase/demo/demo-data.sql` e entram com
`pnpm db:demo`. Separado de propósito: seed não deve inventar estabelecimento.

## Camada de dados

| Arquivo                      | O que resolve                                                                |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `src/data/use-async.ts`      | busca com carregando/erro/recarga; o resultado guarda de qual consulta ele é |
| `src/data/establishments.ts` | lojas, contagem por categoria, detalhe, avaliações                           |
| `src/data/availability.ts`   | as duas RPCs de disponibilidade                                              |
| `src/data/appointments.ts`   | agenda, reservar e cancelar (Edge Functions)                                 |
| `src/data/queue.ts`          | fila com Realtime                                                            |
| `src/data/catalog.ts`        | enum do banco → rótulo, ícone e cor                                          |
| `src/data/use-cities.ts`     | a cidade em uso, resolvida sem interface                                     |
| `src/data/showcase.ts`       | banners vigentes da vitrine e o destino de cada um                           |
| `src/data/support.ts`        | abrir, listar e responder chamado de ajuda                                   |
| `src/format.ts`              | dinheiro, data, duração, distância                                           |

**Nenhum cálculo de horário em TypeScript.** `src/data/availability.ts` só chama
RPC e devolve o que voltou. Ver [decisions/0001](decisions/0001-disponibilidade-no-postgres.md).

## Escrita privilegiada

Duas Edge Functions em `supabase/functions/`:

- **`book-appointment`** — valida que o horário está em `available_slots`,
  congela o preço lido do servidor e calcula o sinal. Traduz o `23P01` da
  constraint de exclusão em "alguém acabou de reservar esse horário".
- **`cancel-appointment`** — aplica `cancellation_window_minutes` e devolve
  `within_free_window`, para o app avisar quando foi fora do prazo.

- **`assistant`** — conversa com a OpenAI. Existe como função pelo motivo mais
  duro de todos: a chave. Bundle de app se abre com um zip. Ver
  [assistente.md](assistente.md) para ligar, e
  [decisions/0005](decisions/0005-assistente-openai.md) para o porquê.

Entrar na fila e avaliar vão direto pela RLS: não há preço a congelar, e as
políticas já expressam a regra inteira.

## Traduções de CSS para React Native

O canvas é HTML e CSS; o React Native não tem nenhum dos dois. Quatro coisas não
tinham equivalente direto:

**`conic-gradient` → SVG.** O anel de vez é a assinatura do design e aparece em
oito lugares. `src/ui/Ring.tsx` desenha o arco como traço de SVG com
`strokeDasharray`, girado -90° para começar às 12 horas como o CSS.

**`linear-gradient(150deg, …)` → `expo-linear-gradient`.** O RN só aceita
start/end normalizados. `gradientAxis()` em `src/ui/Photo.tsx` converte o ângulo
CSS. A conversão ignora a razão de aspecto (o CSS ajusta o ângulo pela caixa),
então gradientes em caixas muito alongadas ficam alguns graus fora.

**`letter-spacing` em `em` → pixel.** `src/theme/type.ts` recebe o valor em `em`
como está no design e multiplica pelo tamanho da fonte. O número no código
continua sendo o do canvas.

**`@keyframes` → `Animated`.** `vzpulse` virou `PulseDot`, `vzshim` virou
`Shimmer`. `vzrise` (a entrada de cada tela) **não foi implementada**.

## Navegação

Duas camadas, e a divisão entre elas é uma regra, não um detalhe:

- **`app/(tabs)/`** — os cinco destinos da barra inferior, e nada mais:
  `index`, `explorar`, `assistente`, `agenda`, `perfil`.
- **`app/`, na raiz** — tudo que é empilhado por cima: `resultados`,
  `loja/[id]`, `horario`, `pagamento`, `fila`, `avaliacao` e as três telas de
  `ajuda/` (lista, `novo`, `[id]`).

O canvas desenhava a barra inferior em todas as telas, inclusive nas de reserva.
Na tela real isso não funciona: loja, horário e pagamento têm rodapé fixo
próprio (preço + botão de continuar), e dois elementos fixos disputando a mesma
faixa da tela competem pelo polegar. As telas empilhadas perderam a barra.

**A regra para telas novas:** se a tela tem rodapé fixo, ou é etapa de um fluxo
que o usuário precisa terminar ou abandonar conscientemente, ela vai na raiz de
`app/`. Só entra em `(tabs)/` o que é destino de navegação livre.

Sair de uma tela empilhada direto para uma aba deixaria o fluxo vivo por baixo,
e o gesto de voltar do iOS o traria de volta já concluído. `useGoToTab()` em
`src/navigation.ts` desempilha antes de navegar; use-o sempre que uma tela
empilhada mandar o usuário para uma aba.

`src/ui/TabBar.tsx` acende a aba pelo caminho. Como as telas empilhadas não têm
barra, o mapeamento é direto — não há mais o remendo do canvas de acender
EXPLORAR na tela da loja.

### `typedRoutes` está desligado

O Expo Router só gera `.expo/types/router.d.ts` quando o Metro roda. Com
`typedRoutes` ligado, `turbo run typecheck` passaria a depender de um bundler
ter rodado antes — e falharia em CI, onde `.expo/` não existe. Por isso as
rotas são strings não verificadas. Um erro de digitação em `router.push` só
aparece em runtime.

## Ícones

Os ícones vêm de `lucide-react-native`, com traço, nunca preenchidos.

O canvas usava um vocabulário de formas abstratas — losango, círculo, pétala —
para categoria e para a barra inferior. Era bonito e não comunicava nada: nada
no losango dizia "barbearia", e o usuário não aprende um alfabeto novo para usar
um app de agendamento.

| Aba      | Ícone      |     | Categoria | Ícone                 |
| -------- | ---------- | --- | --------- | --------------------- |
| Início   | `House`    |     | Barbearia | `Scissors`            |
| Explorar | `Search`   |     | Cabelo    | `SprayCan`            |
| IA       | `Sparkles` |     | Unhas     | `Hand`                |
| Agenda   | `Calendar` |     | Estética  | `Sparkles`            |
| Perfil   | `User`     |     | Dermato   | `ScanFace`            |
|          |            |     | Odonto    | `FaceSlightlySmiling` |
|          |            |     | Pet       | `PawPrint`            |
|          |            |     | Massagem  | `HandHeart`           |

As famílias de `FAMILIES` (Explorar) acrescentam `Activity`, `Brain`,
`Stethoscope`, `Droplets`, `Syringe` e `PersonStanding`.

O pastel de fundo e a cor de traço de cada categoria continuam sendo os do
canvas — mudou o desenho dentro do quadrado, não a paleta. `CategoryMark`
renderiza `category.Icon` a `strokeWidth 1.8`; a aba central (IA) mantém o
destaque que o canvas deu a ela: círculo de 40px preenchido em coral quando
ativo.

## Autenticação

Cinco telas empilhadas em `app/`: `entrar`, `cadastro`, `confirmar`,
`recuperar`, `nova-senha`. Entrada por e-mail e senha; confirmação de conta e
recuperação por código de 6 dígitos enviado por e-mail — não por link mágico,
porque não há domínio para universal link e o link abriria o navegador em vez do
app. O porquê completo está em [decisions/0003](decisions/0003-autenticacao-por-codigo.md).

| Peça                       | Onde                     |
| -------------------------- | ------------------------ |
| Sessão e `useSession()`    | `src/auth/session.tsx`   |
| Guarda de tela             | `src/auth/AuthGate.tsx`  |
| Erros do Supabase em PT    | `src/auth/errors.ts`     |
| Validação de formulário    | `src/auth/validation.ts` |
| Moldura das cinco telas    | `src/auth/AuthShell.tsx` |
| Campo de texto e de código | `src/ui/Field.tsx`       |

**O que exige conta:** só `horario`, `pagamento`, `fila` e `avaliacao`. Buscar e
ver loja funcionam deslogado de propósito — é o que faz o app ser útil antes de
pedir cadastro. As abas Agenda e Perfil não redirecionam; trocam o conteúdo por
um convite.

`Field` e `CodeField` são os primeiros `TextInput` de verdade do projeto: no
canvas todo campo era área pressionável com texto fixo. Foco, erro e senha
oculta nascem aí e valem para as telas que vierem.

## Home: o que saiu e o que virou modal

**O bloco de busca foi removido.** O canvas abria a Home com título, campo de
busca e botão de IA. O campo não era um campo: tocá-lo empurrava o usuário para
Explorar. Um input que não aceita texto e teleporta para outra tela mente sobre
o que faz — e a busca já tem lugar próprio, com a aba Explorar a um toque. O
bloco inteiro saiu; a Home começa direto no cabeçalho.

**Regra geral:** escolha curta sobre a tela atual é folha inferior, não bloco em
fluxo. Nada que abre deve empurrar o que o usuário já estava lendo.

## Sem cidade na interface

O MVP não mostra localidade a quem usa o app. Não há seletor de cidade, nome de
cidade nem contagem por cidade em tela alguma; o cabeçalho da Home passou a ser
uma saudação (`Olá, <primeiro nome>`) com a linha `HORÁRIO E FILA PERTO DE VOCÊ`,
e os textos de Explorar, Resultados e Assistente falam em "perto de você" e "por
perto". A regra vale também para o prompt da Edge Function `assistant`, que é
instruída a nunca citar cidade ou estado.

**A cidade continua nos dados.** Busca, contagem por categoria e assistente
seguem recebendo `cityId`: o banco é organizado por cidade e a RPC
`search_establishments` exige uma. Quem resolve isso é `useCityId()` em
`src/data/use-cities.ts`, sem nenhuma interface: lê as cidades ativas e os
estabelecimentos ativos e fica com a primeira cidade, em ordem alfabética, que
tem loja. Hoje só uma tem.

Cair simplesmente na primeira cidade abriria o app numa tela vazia sempre que
ela ainda não tivesse cadastro, e "não tem nada aqui" é a pior primeira
impressão possível para um marketplace. Quando houver loja em mais de uma
cidade, o certo é a geolocalização do aparelho escolher a mais próxima — e o
nome continuar fora da tela.

**O que morreu junto:** `src/ui/CityPicker.tsx` (a folha inferior de escolha),
`cityId`/`setCityId` em `src/state/app-state.tsx`, os hooks `useCities`,
`useCitiesWithShops` e `useCurrentCity`, e a linha "Cidade padrão" do menu do
Perfil — guardar a preferência seria reintroduzir o seletor por outra porta.

## Vitrine na Home

A Home mostra o carrossel de banners que a equipe da plataforma publica na tela
Vitrine do admin. `src/data/showcase.ts` chama a RPC pública
`showcase_banners()`, que já devolve só os vigentes — ativo, dentro da janela de
exibição e, quando o destino é uma loja, com a loja no ar — na ordem do
carrossel. A imagem vem do bucket público `showcase` por
`supabase.storage.from("showcase").getPublicUrl(image_path)`.

`src/ui/Showcase.tsx` desenha o card 2:1 (a arte é 1200 × 600) com título e
subtítulo sobre um degradê na parte de baixo, o mesmo formato da prévia do
admin. O carrossel sangra até a borda da tela e deixa o próximo card assomando,
para dizer que dá para deslizar; com um banner só ele ocupa a largura toda e os
pontos somem. O toque leva a `/loja/[id]`, a `/resultados?category=<valor>` ou
abre o link no navegador, conforme o destino do banner.

Fica **entre o card da fila e as categorias**, e **só existe quando há banner**:
sem nenhum vigente a Home não reserva espaço nem mostra esqueleto — ela começa
nas categorias, exatamente como antes da vitrine existir.

## Ajuda: abrir e acompanhar chamado

Perfil › Ajuda leva a `app/ajuda/`, três telas empilhadas (R5): a lista dos
chamados da pessoa, o formulário de abertura e a conversa.

- **Abrir** é `open_support_ticket`, escolhendo o assunto entre cinco opções
  (Reserva, Pagamento, Minha conta, Problema no app, Outro). "Cobrança" existe
  no banco e fica de fora: é assinatura da loja, não do cliente.
- **Responder** é `reply_support_ticket`. Chamado resolvido não oferece o
  campo — a RPC recusaria, e oferecer seria prometer um envio que não acontece.
- **Ler** são duas funções criadas para isto em
  `20260912100000_cliente_ajuda.sql`: `customer_support_tickets` e
  `customer_support_ticket_messages`. A RLS de `support_tickets` já deixa o
  autor ler o próprio chamado, mas a tabela carrega o que é da operação —
  prioridade, atribuição e o nome de quem da equipe respondeu, que cai no e-mail
  da pessoa quando o perfil não tem nome. As duas funções devolvem só o que o
  cliente precisa ver, com a equipe assinando como **Equipe Vez**.

A Agenda tem um atalho em cada cartão de reserva ("Preciso de ajuda com esta
reserva") que abre o formulário já com a loja, o assunto `Reserva` e o título
preenchidos: problema com reserva é o chamado mais provável, e é ali que a
pessoa está olhando quando ele aparece.

**Não há notificação, e as telas dizem isso.** Nenhum e-mail e nenhum push saem
daqui (ver N6 em [proximos-passos.md](proximos-passos.md)); a resposta da equipe
só aparece quando o app lê de novo, e por isso a lista e a conversa recarregam
ao ganhar foco. O texto em tela promete exatamente isso — "a resposta aparece
nesta tela" — e nada além.

## Cor por estabelecimento

`loja/[id].tsx` atende `wine` e `cyan`. São a mesma tela: o que muda é o par
`accent`/`tint` que a loja injeta, e ele desce até o botão de continuar, a borda
do dia selecionado, o marcador do mapa e o radio de pagamento. Estrutura e
tipografia são idênticas — é isso que prova que a cor é token, não variante de
layout.

O mesmo vale para a política comercial: a clínica cobra sinal de 30% e a
barbearia não cobra nada pelo app. `priceRows()` em `src/data/selection.ts`
troca o bloco inteiro sem trocar de componente.

## O que o design previa e não foi implementado

- **`vzrise`**, a animação de entrada de cada tela.
- **Campo de texto fora da autenticação.** Busca, chat e o comentário da
  avaliação continuam sendo áreas pressionáveis com texto fixo. Os únicos
  `TextInput` reais são os das telas de conta.
- **Galeria da loja.** Os cinco pontos existem; deslizar entre fotos não.
- **Mapa real.** É a malha do design com pinos posicionados por percentual.
- **O painel lateral do canvas** (índice de telas, tokens, notas de design,
  próximos passos) — é andaime de apresentação, não app.
