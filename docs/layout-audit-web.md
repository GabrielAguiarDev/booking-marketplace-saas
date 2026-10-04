# Auditoria de layout — web (admin e portal)

Data: 2026-10-03 · Escopo: `apps/admin/**` e `apps/portal/**` · Método: **análise estática** de CSS e TSX.
Nenhuma verificação visual/renderizada foi feita por este agente (a validação no navegador ficou com o coordenador).

## Resumo

Os dois apps já tinham um passe responsivo amplo (menu em gaveta, grades que empilham, tabelas com rolagem
horizontal, diálogos com `max-height` em `dvh`). As lacunas encontradas são pontuais e foram corrigidas só em
CSS, em `app/globals.css` de cada app. Nenhum componente, comportamento ou chamada de backend foi alterado.

## Problemas mapeados e correções

### Admin (`apps/admin/app/globals.css`)

| #   | Problema                                                                                                                                                         | Onde aparece                                          | Correção                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| A1  | `.row-fields` é flex sem quebra, com campos fixos de 180px/92px; em diálogo estreito o campo flexível fica com ~90px                                             | diálogos de desconto, acesso, cidade, serviço, banner | ≤560px: `flex-wrap`, campo flexível ocupa a linha, fixos dividem a linha seguinte |
| A2  | `.steps` com 5 colunas fixas, sem breakpoint                                                                                                                     | financeiro                                            | ≤1100px: 3 colunas; ≤560px: 1 coluna                                              |
| A3  | `100vh` em `.shell`, `.sidebar`, `.auth-shell` e `.showcase-form .modal-body` (o `.modal` já usava `dvh`) — conteúdo fica atrás da barra do navegador no celular | esqueleto, login, diálogo de banner                   | declaração `100dvh` adicionada depois do `100vh` (fallback preservado)            |
| A4  | `.search-results` com `min-width: 300px` preso à largura do campo; na topbar estreita sai pela direita da tela                                                   | busca global                                          | ≤560px: lista fixa às margens da tela (16px), `min-width: 0`                      |
| A5  | `.search.light` com largura fixa de 250px                                                                                                                        | filtro de estabelecimentos                            | `max-width: 100%`                                                                 |

### Portal (`apps/portal/app/globals.css`)

| #   | Problema                                                                                                                                                             | Onde aparece                         | Correção                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------- |
| P1  | `100vh` em `.shell`, `.drawer` e `.auth-shell`/`.onboarding-shell` (a `.sidebar` já tinha fallback `dvh`) — rodapé da gaveta com ações pode ficar cortado no celular | esqueleto, gavetas, login/onboarding | `100dvh` adicionado depois do `100vh`   |
| P2  | `select` do seletor de estabelecimento com `min-width: 180px` disputa a topbar com título e botão principal                                                          | topbar                               | ≤760px: `min-width: 0; max-width: 42vw` |
| P3  | `.gallery` usa `repeat(4, 1fr)`; imagens podem alargar a trilha além da grade                                                                                        | perfil                               | `repeat(4, minmax(0, 1fr))`             |

## Revisado sem alteração

- Admin: grades de duas colunas (`approvals`, `reports`, `cities`, `customers`, `quotas`, `services`, `showcase`),
  KPIs, tabelas (`.table-wrap`, `.card.clip`), abas, cabeçalhos de ficha, `Modal` (largura inline + `max-width: 100%`),
  toast — já cobertos pelos breakpoints de 1280/1100/900/560px.
- Admin: `.inspector`, `.showcase-aside` e `.account-console-bar` continuam `sticky` quando a grade empilha; é inofensivo
  (sem sobreposição), deixado como está.
- Portal: KPIs, agenda/detalhe, fila, tabelas com `.table-scroll`/`.calendar-scroll`/`.layers-scroll`, perfil/prévia,
  diálogos (`.dialog`, `.dialog-grid`), formulários (`.form-grid`, `.service-row`), `operation.module.css`
  (`.columns`, `.overlay`, `.customerGrid` em `.tableWrap`) — já cobertos.

## Verificações executadas

| App    | `pnpm typecheck` (`tsc --noEmit`) | `pnpm lint` (`eslint .`) |
| ------ | --------------------------------- | ------------------------ |
| admin  | passou                            | passou                   |
| portal | passou                            | passou                   |

Sem build completo e sem testes (fora do orçamento; mudanças só de CSS).

## Cobertura e limitações

- Cobertura: todas as regras de layout dos dois `globals.css` e de `operation.module.css` (larguras fixas, grades,
  `nowrap`, `overflow`, `sticky`/`fixed`, unidades de viewport, media queries) e os estilos inline de largura nos TSX.
  Os componentes foram lidos por busca dirigida, não tela a tela.
- Os dois apps são de rota única (`app/page.tsx`, mais `/convite` no portal); as telas são trocadas por estado no
  cliente, então a cobertura por rota equivale à cobertura das classes CSS compartilhadas.
- **Nada foi renderizado.** A4 (lista de busca `position: fixed` em 52px, baseada na topbar de 60px) e P2
  (`max-width: 42vw`) são os ajustes que mais merecem conferência visual em ~360px de largura.
- Não foi avaliado: contraste, tipografia, estados de carregamento/vazio, nem conteúdo real muito longo dentro
  das células de tabela.
- Docs do Next instalados (`node_modules/next/dist/docs`) apenas localizados, não consultados em detalhe: nenhuma
  API ou convenção do Next foi tocada.
