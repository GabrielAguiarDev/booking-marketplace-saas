# Auditoria de layout — apps mobile

Escopo: `apps/mobile-cliente`, `apps/mobile-staff`, `packages/mobile-kit`.
Data: 2026-10-03.

**Método: revisão estática do código.** Nada foi renderizado em simulador ou
aparelho. Os itens abaixo saem da leitura de `Screen`, `Sheet`, `primitives`,
`TabBar` e de buscas por padrão (teclado, área segura, linhas flex, alvos de
toque) em todas as telas de `app/`. As telas não foram lidas uma a uma.

## Cobertura

| Área                                                                                                | Como foi coberta                                                            |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Moldura/rolagem (`Screen`, `ScreenScroll`, `StickyFooter`) — usada por todas as telas dos dois apps | lida                                                                        |
| `Sheet` (cliente e staff)                                                                           | lida                                                                        |
| `primitives` (botões, `Segmented`, `SectionHeader`, `KeyRow`, `HubRow`, `ToggleRow`)                | lida nos trechos de linha/texto                                             |
| `TabBar`, cabeçalhos do staff (`PlainHeader`)                                                       | trechos                                                                     |
| Telas em `app/` (cliente: 30+, staff: 30+)                                                          | só busca por padrão                                                         |
| `packages/mobile-kit`                                                                               | sem componentes de layout (tokens, tipografia, push, auth); nada a corrigir |

## Problemas e correções aplicadas

| #   | Problema                                                                                                                | Onde                                                                                                       | Correção                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Teclado cobre campos no iOS: nenhuma tela do staff usa `KeyboardAvoidingView` (só `Sheet` e `AuthShell`)                | staff `ScreenScroll` → `bloquear`, `novo-agendamento`, `servico/[id]`, `chamado/[id]` e demais formulários | `automaticallyAdjustKeyboardInsets` + `keyboardDismissMode="on-drag"`                                                                                             |
| 2   | Mesmo problema no comentário da avaliação                                                                               | cliente `avaliacao`                                                                                        | prop `keyboardInsets` em `ScreenScroll` (opt-in, para não dobrar a folga nas telas que já têm `KeyboardAvoidingView`); `keyboardDismissMode="on-drag"` para todas |
| 3   | Folha sem teto de altura nem rolagem: conteúdo alto ou teclado aberto empurra a folha para fora do topo em tela pequena | staff `Sheet` (fila, agendamento, avaliações, suporte, ajustes, perfil público, hoje, `AccountSheet`)      | `maxHeight: 92%`, `flexShrink` e corpo em `ScrollView`                                                                                                            |
| 4   | Filho rolável da folha não respeitava o `maxHeight: 80%`                                                                | cliente `Sheet`                                                                                            | corpo com `flexShrink: 1`                                                                                                                                         |
| 5   | Valor longo (e-mail, endereço) esmaga o rótulo e sai da tela                                                            | staff `KeyRow`                                                                                             | valor com `flexShrink`, `maxWidth: 62%`, alinhado à direita                                                                                                       |
| 6   | Título longo empurra o "meta" para fora                                                                                 | `SectionHeader` (cliente e staff)                                                                          | lado esquerdo encolhe; `gap` no cliente                                                                                                                           |
| 7   | Rótulo quebra em duas linhas dentro de controle de altura fixa                                                          | `Segmented` (ambos), `OutlineButton` (cliente), ação do `PlainHeader`, rótulos da `TabBar` (staff)         | `numberOfLines={1}`                                                                                                                                               |

## Verificado, sem alteração

- Área segura: `Screen` soma o topo; `StickyFooter` e `Sheet` somam a base nos dois apps.
- `HubRow`, `ToggleRow`, `BackHeader`, título do `PlainHeader`: texto já em `flex: 1`/`flexShrink`.
- Alvos de toque menores que 44pt em `ui/` (voltar 36pt, fechar da folha 32pt) têm `hitSlop` de 12.

## Pendente (não corrigido)

- Android: o item 1 depende do redimensionamento da janela pelo sistema; não confirmado.
- Alvos pequenos dentro das telas (`fila.tsx` 24–30pt, `index.tsx` 22pt, `comecar.tsx` 26pt, `assistente.tsx` 36pt) não foram conferidos quanto a `hitSlop`.
- Linhas `space-between` das telas (`(tabs)/index.tsx`, `horarios.tsx`, `loja/[id].tsx`, `agenda.tsx`) não foram lidas.
- Fonte ampliada do sistema e largura de 320pt: sem verificação.
- Nenhuma correção foi vista renderizada; o item 3 (folha com `ScrollView`) é o que mais pede conferência visual.
