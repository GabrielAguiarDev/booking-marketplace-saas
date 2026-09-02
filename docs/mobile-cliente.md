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

| Tela           | Origem                                                              |
| -------------- | ------------------------------------------------------------------- |
| Home           | `cities`, `establishments`, contagem por categoria, fila ativa      |
| Explorar       | contagem real por categoria; busca por nome (`ilike`)               |
| Resultados     | `establishments` filtrado por cidade, categoria e termo             |
| Loja           | `establishments` + `services` + `professionals` + `reviews`         |
| Horário        | RPC `available_slots` e `availability_summary`                      |
| Confirmar      | preço do serviço e política de sinal da loja; Edge Function reserva |
| Agenda         | `appointments` nas três abas, cancelar e avaliar                    |
| Fila           | RPC `queue_state` + Realtime                                        |
| Avaliação      | grava em `reviews`                                                  |
| Perfil         | `auth.users` + `profiles`                                           |
| **Assistente** | **nada** — a tela diz que não existe ainda (fase 9)                 |

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
  `loja/[id]`, `horario`, `pagamento`, `fila`, `avaliacao`.

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
bloco inteiro saiu; a Home começa direto no cabeçalho de cidade.

**A cidade virou folha inferior.** Antes a lista de cidades era renderizada em
fluxo, logo abaixo do cabeçalho: abrir empurrava a Home inteira para baixo e o
conteúdo saltava sob o dedo. `src/ui/CityPicker.tsx` é um `Modal` transparente
com `animationType="slide"`, fundo escurecido, alça de arraste e a cidade atual
marcada com `Check` em coral. A Home fica parada.

**Regra geral:** escolha curta sobre a tela atual é folha inferior, não bloco em
fluxo. Nada que abre deve empurrar o que o usuário já estava lendo.

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
