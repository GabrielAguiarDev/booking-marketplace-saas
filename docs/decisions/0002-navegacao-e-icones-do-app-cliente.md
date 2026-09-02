# 0002 — Navegação, ícones e entradas da Home no app do cliente

Data: 2026-09-02 · Status: aceito · Afeta: `apps/mobile-cliente`

## Contexto

O app do cliente foi implementado a partir do canvas `Vez.dc.html`. O canvas é
um protótipo em HTML: todas as telas viviam lado a lado no mesmo documento, sem
pilha de navegação, sem teclado e sem gesto de voltar. Quatro coisas que
funcionavam no protótipo não sobreviveram ao aparelho.

## Decisões

### 1. Telas de reserva não têm barra inferior

O canvas desenhava a barra em todas as telas. Loja, horário, pagamento, fila e
avaliação têm rodapé fixo próprio — preço e botão de continuar. Duas faixas
fixas empilhadas no rodapé disputam a mesma área do polegar e roubam altura útil
de telas que já são densas.

`app/(tabs)/` passou a conter só os cinco destinos da barra. `resultados`,
`loja/[id]`, `horario`, `pagamento`, `fila` e `avaliacao` foram para a raiz de
`app/` e são empilhados por cima.

**Consequência:** sair de uma tela empilhada para uma aba precisa desempilhar
antes, senão o fluxo concluído continua vivo por baixo e o gesto de voltar do
iOS o traz de volta. `useGoToTab()` (`src/navigation.ts`) faz isso.

### 2. Escolher cidade é folha inferior, não bloco em fluxo

A lista de cidades era renderizada abaixo do cabeçalho e empurrava a Home
inteira para baixo. O conteúdo saltava sob o dedo do usuário no instante do
toque.

Virou `Modal` transparente deslizando de baixo (`src/ui/CityPicker.tsx`).

**Regra derivada:** escolha curta sobre a tela atual é folha inferior. Nada que
abre pode deslocar o que já estava na tela.

### 3. A Home não tem campo de busca

O campo de busca da Home não era um campo: tocá-lo navegava para Explorar. Um
input que não aceita texto e teleporta mente sobre o que faz.

O bloco inteiro — título, campo e botão de IA — foi removido. A busca vive em
Explorar, que está a um toque na barra, e a IA tem a aba central.

**Alternativa descartada:** transformá-lo em `TextInput` de verdade na Home.
Isso duplicaria a busca em dois lugares antes de existir backend de busca. Volta
à mesa quando a busca real for construída — ver o roadmap.

### 4. Ícones de traço em vez de formas abstratas

O canvas usava losango, círculo e pétala para categorias e para a barra. Não
comunicavam: nada no losango diz "barbearia", e ninguém aprende um alfabeto novo
para marcar horário no cabeleireiro.

Adotado `lucide-react-native`, sempre em traço, nunca preenchido. O pastel de
fundo e a cor de traço de cada categoria continuam sendo os do canvas — mudou o
desenho dentro do quadrado, não a paleta. O mapeamento está em
[mobile-cliente.md](../mobile-cliente.md#ícones).

## O que isso custa

O app deixou de ser uma transcrição fiel do canvas. Quem comparar tela a tela
vai achar diferenças, e elas são deliberadas: o canvas continua sendo a fonte da
identidade visual (cor, tipografia, espaçamento, o anel de vez), não da
navegação nem da interação.
