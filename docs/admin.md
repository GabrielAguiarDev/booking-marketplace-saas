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

| Arquivo                          | O que é                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `components/admin.tsx`           | Casca: menu, cabeçalho, troca de tela, modais                                                                                      |
| `components/sidebar.tsx`         | Menu lateral com os quatro grupos e os distintivos                                                                                 |
| `components/admin-data.ts`       | Carga inicial pelas RPCs protegidas do Supabase                                                                                    |
| `components/store.tsx`           | Contrato único de leitura e ações usado por todas as telas                                                                         |
| `components/supabase-actions.ts` | Escritas transacionais e recarga do snapshot                                                                                       |
| `components/data.ts`             | Navegação, etiquetas e opções fechadas dos formulários                                                                             |
| `components/tokens.ts`           | As cores do canvas que também precisam existir em JS                                                                               |
| `components/blocks.tsx`          | Peças repetidas: etiqueta, grade de vagas, nota, abas                                                                              |
| uma tela por arquivo             | `overview`, `approvals`, `establishments`, `cities`, `quotas`, `finance`, `services`, `reviews`, `customers`, `settings`, `modals` |

## Ligação com o Supabase

O painel exige uma sessão do Supabase Auth e uma linha em `platform_admins`.
Sem sessão, mostra o login; com uma conta autenticada que não pertence à equipe,
nega o acesso. A secret key nunca entra no app: o navegador usa somente a chave
publicável e todas as operações passam por RLS e por funções `admin_*`.

A migration `20260910121000_admin_platform.sql` acrescenta planos, cota e preço
por cidade, decisões de cadastro, catálogo global, denúncia de avaliação,
bloqueio de cliente, parâmetros, acesso auditado e log administrativo. São 39
funções do admin. As funções de escrita conferem a função da pessoa (`admin`,
`operations`, `finance` ou `support`), validam a regra de negócio e gravam a
auditoria na mesma transação. O papel `admin` pode operar todas as áreas; os
demais ficam limitados ao escopo exibido em Equipe e acessos.

A página carrega um snapshot no Server Component. Depois de cada escrita o
navegador pede `router.refresh()`, recebe um novo snapshot e mantém a navegação
atual. Não há fallback silencioso para a fixture do canvas.

## Ações persistidas

As ações destas áreas já gravam no banco:

- aprovar, recusar ou pedir correção no cadastro;
- suspender, reativar, trocar plano, aplicar desconto e registrar contato;
- abrir cidade, mudar cotas, preços, planos e regras;
- criar e editar catálogo, mesclar/aprovar/recusar sugestões;
- manter/remover avaliação denunciada e pedir esclarecimento;
- bloquear cliente e registrar atendimento;
- editar parâmetros e registrar uma autorização de suporte auditada;
- publicar ou retirar uma cidade da busca.

O bloqueio de cliente também é aplicado pela Edge Function
`book-appointment`: uma conta bloqueada não cria novas reservas mesmo tentando
chamar o backend fora da interface. A mesma função cria o bloqueio automático
quando o limite de faltas dos últimos 30 dias é atingido. O limite da fila é
aplicado por trigger para entradas do app e do balcão.

Catálogo, serviços e sinônimos alimentam a RPC pública de busca; a quantidade
de resultados gravada em `search_events` é calculada no servidor. Alterações de
plano são aplicadas imediatamente enquanto não existe ciclo de cobrança, e o
intervalo mínimo configurado é validado no banco.

O parâmetro de cancelamento é o valor com que uma loja nova nasce
(`default_cancellation_window_minutes()` é o default da coluna); a janela
continua sendo da loja, e mudar o parâmetro não altera lojas existentes.

Situação, plano e desconto da loja, vínculo de serviço ao catálogo e remoção de
avaliação são protegidos por gatilhos `security invoker`. Precisa ser invoker:
num `security definer`, `current_user` é sempre `postgres` e a checagem passava
para qualquer dono de loja. Assim, a escrita direta chega como `authenticated`
e é barrada; a feita por dentro de uma RPC `admin_*` chega como `postgres`.

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

## Limites atuais

- **Suporte e Vitrine** já aparecem no menu, mas o próprio canvas as deixa como
  aviso de "fora do escopo desta rodada". Ficaram assim.
- **Abas de Chamados, Avaliações e Uso da plataforma** na ficha do
  estabelecimento: o canvas as desenha como placeholder, dizendo que reusam os
  componentes de lista já definidos. Idem.
- **Os controles do editor do canvas** (`startScreen`, `queueFirst`,
  `showRiskFlags`) eram botões do Claude Design, não da tela. Viraram o
  comportamento padrão: começa na visão geral, fila de trabalho no topo,
  sinalização de risco ligada.
- **Cobranças e repasses** aguardam a escolha do provedor de pagamento. A tela
  mostra o estado vazio real e não inventa faturas. A receita operacional é uma
  estimativa derivada do plano atual, descontos vigentes e atendimentos
  concluídos; não é histórico contábil.
- **Acesso a conta** registra a janela autorizada, o motivo e snapshots de quem
  pediu e da loja. O console de leitura/impersonação ainda não existe, portanto
  o painel não afirma abrir a conta nem rastrear páginas visitadas.
- **Mensagens de correção, decisão e moderação** ficam persistidas, mas e-mail,
  push e a caixa de resposta do portal dependem do onboarding/notificações.
- **MFA administrativo** ainda precisa ser exigido antes de produção; hoje o
  acesso usa e-mail e senha do Supabase Auth.

No banco local, `pnpm db:demo` cria `admin@vez.local` com a mesma senha das
outras contas de demonstração.
