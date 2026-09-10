# Portal administrativo — implementação do design

`apps/admin` implementa o canvas `Vez Portal Admin.dc.html` do projeto Claude
Design `35c252c3-c412-4354-805e-2d47d3293228`. O arquivo está versionado em
[`docs/design-page/`](design-page/), ao lado do canvas do
[portal do estabelecimento](../apps/portal). O `support.js` dos dois é o mesmo
runtime, byte a byte — existe uma cópia só.

É a superfície de quem opera a plataforma: aprova cadastro, abre cidade, mexe em
cota e preço, cobra, e decide denúncia de avaliação. Roda na porta 3002.

## Estrutura

Mesma divisão do portal do estabelecimento: markup semântico com classes, CSS
inteiro em `app/globals.css`, nada de estilo inline exceto o que depende de
dado (a cor de um tom, a largura de uma barra).

| Arquivo                    | O que é                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `components/admin.tsx`     | Casca: menu, cabeçalho, troca de tela, modais               |
| `components/sidebar.tsx`   | Menu lateral com os quatro grupos e os distintivos          |
| `components/data.ts`       | Todo o dado do protótipo + formatação (`decimal`, `signed`) |
| `components/tokens.ts`     | As cores do canvas que também precisam existir em JS        |
| `components/blocks.tsx`    | Peças repetidas: etiqueta, grade de vagas, nota, abas       |
| uma tela por arquivo       | `overview`, `approvals`, `establishments`, `cities`, `quotas`, `finance`, `services`, `reviews`, `customers`, `settings`, `modals` |

## Nada aqui fala com o Supabase

Como no portal, o dado é o mesmo do canvas e vive em `components/data.ts`. A
página que confirmava conexão com o banco saiu — a verificação continua
disponível nos outros apps.

Quando a tela virar dado real, o alvo de cada uma já é previsível: aprovações →
`establishments` com `status = 'pending'` (a Edge Function que valida cota já
existe, ver [decisão 0008](decisions/0008-loja-nao-se-aprova-sozinha.md)); cidades
e cotas → `cities`; financeiro → cobranças e repasses; auditoria → o registro de
acesso a conta de estabelecimento, que é o motivo de o modal exigir motivo.

## O que tem estado de verdade

Quase tudo é protótipo, mas três fluxos foram implementados com estado porque a
tela não faz sentido sem eles:

- **Fila de denúncias.** Decidir remove o caso da fila, abre o próximo
  automaticamente e derruba o distintivo do menu. No fim da fila entra o estado
  vazio. Manter e Remover só destravam depois de um motivo escolhido — cada
  botão aceita apenas motivos do seu grupo, como no canvas.
- **Plano inicial na aprovação.** A cota da cidade decide o padrão: cidade
  esgotada já vem em comissão e a opção de mensalidade fica desabilitada.
  Escolher trava o plano naquela solicitação.
- **Seleção em massa de estabelecimentos.** A barra de ações só aparece com algo
  marcado.

O impacto da decisão ("nota hoje → se remover") é calculado, não escrito:
`(média × total − nota) / (total − 1)`.

## Cuidado com nome de classe e Tailwind

`globals.css` importa o Tailwind (pelo _preflight_), e o Tailwind gera
utilitários para qualquer palavra que ele encontre no código-fonte. Uma classe
própria chamada `fixed`, `block`, `inline`, `grow` ou `hidden` recebe também as
propriedades do utilitário de mesmo nome — e como são propriedades diferentes,
especificidade não resolve: `class="fixed"` num campo de formulário virou
`position: fixed`.

Por isso os nomes aqui são `field-fixed`, `field-grow`, `inline-pair` e `full`.
Ao criar classe nova, evite palavra que seja utilitário do Tailwind.

## O que o canvas tem e a tela não entrega

- **Suporte e Vitrine** já aparecem no menu, mas o próprio canvas as deixa como
  aviso de "fora do escopo desta rodada". Ficaram assim.
- **Abas de Chamados, Avaliações e Uso da plataforma** na ficha do
  estabelecimento: o canvas as desenha como placeholder, dizendo que reusam os
  componentes de lista já definidos. Idem.
- **Os controles do editor do canvas** (`startScreen`, `queueFirst`,
  `showRiskFlags`) eram botões do Claude Design, não da tela. Viraram o
  comportamento padrão: começa na visão geral, fila de trabalho no topo,
  sinalização de risco ligada.
- **Filtros, busca e paginação** são de enfeite: os `select` e o campo de busca
  existem com as opções certas, mas não filtram nada enquanto o dado for fixo.
