# `@vez/mobile-kit`

O que os dois apps Expo — `mobile-cliente` e `mobile-staff` — usam igual.

Existe pela regra **R8** de [`docs/proximos-passos.md`](../../docs/proximos-passos.md):
mover para `packages/` quando o segundo consumidor existir, e não antes. O
segundo consumidor passou a existir quando o app do estabelecimento nasceu.

| Entry                    | O que tem                                                     |
| ------------------------ | ------------------------------------------------------------- |
| `@vez/mobile-kit/theme`  | Os oito tokens do design, raios, sombras e a tipografia       |
| `@vez/mobile-kit/format` | Dinheiro, data, hora, duração, distância                      |
| `@vez/mobile-kit/async`  | `useAsync` — busca com carregando, erro e recarga             |
| `@vez/mobile-kit/auth`   | Sessão, tradução de erro do Supabase, validação de formulário |

**O que deliberadamente não está aqui:** os componentes de UI. Os dois apps
saem de canvases diferentes e desenham cartão, cabeçalho e barra de abas de
formas distintas; forçá-los no mesmo componente trocaria duplicação por um
componente cheio de `if (app === …)`, que é pior.

O que está aqui é o que é **igual e neutro de design**: os tokens que os dois
canvases repetem valor por valor, e a lógica que não desenha nada.
