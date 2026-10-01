# Auditoria web — portal, admin e landing (30/09/2026)

Frente web da finalização descrita em
[finalizacao-2026-09-30.md](finalizacao-2026-09-30.md). Cobre `apps/portal`,
`apps/admin` e `apps/landing`. Este arquivo tem duas partes: a **análise**,
escrita antes de qualquer alteração, e a **resolução**, preenchida ao final com
o que foi de fato mudado e verificado.

## Como a auditoria foi feita

- Leitura do código das três superfícies (casca, autenticação, onboarding,
  operação, cadastro, diálogos, folhas de estilo) e dos documentos
  [portal.md](portal.md), [admin.md](admin.md) e [conventions.md](conventions.md).
- Leitura dos guias locais do Next 16 em `node_modules/next/dist/docs/` antes de
  editar (`error.js` recebe `retry`, não `reset`; `history.pushState` integra
  com o roteador).
- Navegador embutido do Orca contra os servidores locais (3000, 3001, 3002) e
  o Supabase local, com as contas de [contas-de-teste.md](contas-de-teste.md),
  em 982 px e 390 px de largura. Nada foi acessado em produção.

## Análise (antes de implementar)

Prioridade: **Alta** impede uso ou acesso; **Média** atrapalha um fluxo
principal ou quebra a coesão; **Baixa** é acabamento.

### Portal do estabelecimento

| ID  | Prioridade | Lacuna                                                | Evidência                                                                                                                                                                                                                                  |
| --- | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | Alta       | Em telas até 860 px o menu some e não há como abri-lo | `globals.css` esconde `.sidebar` e estiliza `.nav-open-button`/`.nav-backdrop`/`.shell.nav-open`, mas nenhum componente renderiza o botão nem aplica a classe. Medido em 390 px: `visibility: hidden`, `left: -72px`, zero botões de menu. |
| P2  | Alta       | A seção aberta não está na URL                        | `portal.tsx` guarda a seção em `useState`. Recarregar volta para Visão geral, o botão Voltar do navegador sai do portal e não existe link para "Agenda" ou "Equipe".                                                                       |
| P3  | Alta       | Diálogos e gavetas sem teclado                        | Quatro implementações (`Dialog` do cadastro e três gavetas em `overview`, `agenda`, `new-appointment`): nenhuma fecha com Esc, prende o foco ou devolve o foco ao fechar; o botão de fundo das gavetas não tem nome acessível.             |
| P4  | Média      | Sem tela de erro nem de página inexistente            | Não há `app/error.tsx` nem `app/not-found.tsx`. Falha em `loadPortalData` cai na tela padrão do Next, em inglês e sem saída.                                                                                                               |
| P5  | Média      | Telas de operação fora da tipografia do produto       | `operation.module.css` usa `var(--font-sans)`/`var(--font-mono)`; o portal define `--sans`/`--mono`. Estilo computado de um indicador: `-apple-system, system-ui…` em vez de Plus Jakarta Sans. Vale para botões, números e gavetas.       |
| P6  | Média      | Cadastro da loja: campos difíceis de preencher        | Preço é `type="number"` controlado por `toFixed(2)` (reescreve o valor a cada tecla); CNPJ e telefone sem máscara nem validação local, então o erro só aparece depois de enviar.                                                           |
| P7  | Média      | Autenticação devolve mensagens cruas do Supabase      | `friendlyAuthError` traduz três casos; o resto ("Email not confirmed", limite de envio, código expirado, rede) chega em inglês. Senha sem opção de mostrar.                                                                                |
| P8  | Média      | Texto de desenvolvedor na interface                   | "vem de available_slots() no Postgres", "Posição e espera vêm de queue_state()", "linha em `establishment_settings`", "A integração entra na P5", "o banco recusa". Rodapé de Configurações sem acentos ("ate", "nao sao").                |
| P9  | Baixa      | Estados e anúncios                                    | Erros de operação sem `role="alert"`; aviso do cadastro nunca some sozinho e usa `role="status"` também para falha; item ativo do menu sem `aria-current`; barra da Agenda não quebra linha em tela estreita.                              |
| P10 | Baixa      | Gavetas em celular                                    | `.overlay` vira `0 1fr` em 720 px, mas a gaveta usa `min-height: 100vh`; suspeita de rodapé escondido pela barra do celular (revista na resolução).                                                                                        |

### Admin da plataforma

| ID  | Prioridade | Lacuna                                     | Evidência                                                                                                                                                                                           |
| --- | ---------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Alta       | Nenhuma adaptação a tela estreita          | Só dois `@media` em 4.467 linhas. Em 390 px o menu ocupa 238 px e sobram 142 px de conteúdo; a página rola 856 px na horizontal. Grades de 2–6 colunas fixas não recolhem.                          |
| A2  | Alta       | Foco de teclado invisível nos campos       | `input, select, textarea { outline: none }` global, sem `:focus` substituto fora do login. Quem navega por Tab não vê onde está em nenhum formulário, filtro ou diálogo.                            |
| A3  | Média      | Diálogos: Esc depende de onde está o foco  | `Modal` escuta `keydown` no próprio overlay; sem foco dentro, Esc não fecha. Não prende nem devolve o foco.                                                                                         |
| A4  | Média      | Tela aberta não está na URL                | Mesmo padrão do P2: `useState` em `admin.tsx`; recarregar volta para Visão geral e o Voltar sai do painel.                                                                                          |
| A5  | Média      | Sem tela de erro nem de página inexistente | `page.tsx` relança falhas de `admin_mfa_policy` e `loadAdminData`; não há `error.tsx`/`not-found.tsx`.                                                                                              |
| A6  | Baixa      | Login e avisos                             | "Esta conta não faz parte da equipe" continua na tela enquanto se digita outra conta (visto no navegador); erros do Auth em inglês; aviso de erro mostra ícone de sucesso; menu sem `aria-current`. |

### Landing

| ID  | Prioridade | Lacuna                                       | Evidência                                                                                                                                             |
| --- | ---------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Média      | Até 800 px os links de seção somem           | `.header__nav { display: none }` sem menu alternativo; no celular só restam "Entrar" e "Cadastrar minha loja".                                        |
| L2  | Média      | Sem JavaScript a página fica em branco       | `[data-reveal]` nasce com `opacity: 0` e só `Reveal` (cliente) revela. Hero, planos e formulário dependem disso.                                      |
| L3  | Baixa      | Metadados de compartilhamento                | Sem `metadataBase`, Open Graph, `robots` nem `sitemap`; título de `/cliente` foge do padrão "… — Vez".                                                |
| L4  | Externa    | Promessas comerciais sem decisão de cobrança | "A primeira cobrança é só 14 dias depois", preço e comissão na seção de planos. Dependem da decisão de cobrança listada como pendência do lançamento. |

O que **não** é lacuna: a landing já tem link de pular conteúdo, foco visível,
`prefers-reduced-motion`, formulário com rótulos, `aria-busy` e foco movido ao
aviso de envio; em 390 px não há rolagem horizontal. Portal e admin já usam
dados reais, sem fallback para os fixtures do canvas.

### Plano de implementação

1. Navegação: gaveta de menu no portal (P1) e no admin (A1), seção na URL (P2,
   A4), `aria-current`.
2. Diálogos: um gancho de teclado/foco por app, aplicado a todas as
   implementações (P3, A3, P10).
3. Estados: `error.tsx` e `not-found.tsx` nos dois apps (P4, A5); anúncios de
   erro e avisos (P9, A6).
4. Formulários: foco visível no admin (A2), cadastro da loja (P6), mensagens de
   autenticação (P7, A6).
5. Coesão: fontes da operação (P5), texto de interface (P8).
6. Landing: menu compacto (L1), revelação sem JavaScript (L2), metadados (L3).

Fora do escopo desta frente: L4 (decisão do responsável), cobrança, SMTP,
domínio e publicação.

## Resolução

Estado ao final da execução. Nada foi commitado nem publicado.

### O que mudou

**Portal**

| ID  | Situação  | O que foi feito                                                                                                                                                                                                                                            |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Resolvido | Botão de menu no cabeçalho, fundo clicável e classe `nav-open` em `portal.tsx`; a gaveta fecha ao escolher a seção ou com Esc. A regra antiga de 760 px que transformava o menu em trilho de ícones saiu, porque brigava com a gaveta.                     |
| P2  | Resolvido | A seção vem de `?section=` (`useSearchParams` + `history.pushState`). Recarregar mantém a tela e o Voltar do navegador volta de seção. Trocar de loja continua limpando a seção.                                                                           |
| P3  | Resolvido | `use-dialog.ts` (Esc, Tab preso no painel, foco inicial no primeiro campo, foco devolvido a quem abriu). As três gavetas passaram a usar uma casca só, `drawer.tsx`, com título ligado por `aria-labelledby`; o `Dialog` do cadastro usa o mesmo gancho.   |
| P4  | Resolvido | `app/error.tsx` (com "Tentar de novo" e o código do erro) e `app/not-found.tsx`, no visual do login.                                                                                                                                                       |
| P5  | Resolvido | `--font-sans`/`--font-mono` definidos em `:root` apontando para as fontes do portal.                                                                                                                                                                       |
| P6  | Parcial   | Preço virou texto com vírgula (`45,90`), validado no envio; máscara de CNPJ (inclusive alfanumérico) e de telefone; `autocomplete` nos campos. O dígito verificador do CNPJ continua sendo conferido só no servidor, que já responde em português.         |
| P7  | Resolvido | Erros do Auth traduzidos pelo código (credencial, e-mail não confirmado, código expirado, limite de envio, rede) com frase genérica para o resto; "Mostrar/Ocultar" senha; "Reenviar código" nas telas de confirmação; trocar de tela limpa o erro antigo. |
| P8  | Resolvido | Removidas as menções a funções, tabelas e fases internas; rodapé de Configurações reescrito com acentos; "da Vez" unificado para "do Vez", como na landing. A seção morta "ainda não está ligada ao banco" saiu, porque nenhuma seção cai mais nela.       |
| P9  | Resolvido | `role="alert"` nos erros; aviso de sucesso do cadastro some em 5 s e o de falha fica; `aria-current` no menu; barra da Agenda e rodapé das gavetas quebram linha; linhas de lista empilham no celular (Horários ficava com uma palavra por linha).         |
| P10 | Revisto   | O rodapé não ficava escondido; o defeito real era o corpo da gaveta esticar os campos para preencher a altura. Corrigido com `align-content: start`. Diálogo alto agora rola por dentro.                                                                   |

Além da lista: o menu esconde as seções que o papel não abre (equipe via quatro
itens que levavam a "Acesso restrito"); a tela de Clientes rolava a página
inteira na horizontal em 390 px (868 px) e agora rola só a tabela; o botão
"Novo agendamento" duplicado na barra da Agenda saiu (fica o do cabeçalho); o
rótulo "Ativo — aparece para o cliente" dos diálogos saía em caixa alta.

**Admin**

| ID  | Situação  | O que foi feito                                                                                                                                                                                            |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Resolvido | Abaixo de 900 px o menu vira gaveta; grades de várias colunas empilham em 1100 px e 560 px; tabelas rolam dentro do cartão; cabeçalho de ficha e abas quebram ou rolam; diálogo limitado à altura da tela. |
| A2  | Resolvido | Borda e halo coral em `:focus-visible` para campos, contorno para botões e links; a busca do cabeçalho mostra o foco na caixa.                                                                             |
| A3  | Resolvido | `Modal` usa o mesmo gancho do portal: Esc de qualquer lugar, Tab preso, foco devolvido.                                                                                                                    |
| A4  | Resolvido | `?screen=` e, na ficha, `&id=`; Voltar/avançar fecham diálogo e console. O console de leitura não vai para a URL: recarregar cai na ficha. Saiu o padrão `establishments[4]` herdado do canvas.            |
| A5  | Resolvido | `app/error.tsx` e `app/not-found.tsx`.                                                                                                                                                                     |
| A6  | Resolvido | O aviso de conta sem acesso some ao digitar outro e-mail; erros de login e de segundo fator em português; aviso de erro com ícone próprio e `role="alert"`; `aria-current` no menu.                        |

**Landing**

| ID  | Situação  | O que foi feito                                                                                                                                                   |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Resolvido | `mobile-nav.tsx`: botão de menu até 800 px com os cinco links; até 420 px o "Entrar" passa para dentro do menu (em 340 px o cabeçalho media 382 px e agora cabe). |
| L2  | Resolvido | `<noscript>` no layout revela tudo que tem `data-reveal`.                                                                                                         |
| L3  | Parcial   | Open Graph (título, descrição, `pt_BR`). `metadataBase`, `robots` e `sitemap` dependem do domínio definitivo.                                                     |
| L4  | Aberto    | Decisão do responsável; nenhum texto comercial foi alterado.                                                                                                      |

### Verificação

Comandos, todos passando ao final:

```bash
pnpm --filter @vez/portal typecheck && pnpm --filter @vez/portal lint && pnpm --filter @vez/portal build
pnpm --filter @vez/admin typecheck && pnpm --filter @vez/admin lint && pnpm --filter @vez/admin build
pnpm --filter @vez/landing typecheck && pnpm --filter @vez/landing lint && pnpm --filter @vez/landing build
pnpm --filter @vez/landing test   # 7 de 7
```

No navegador do Orca, contra o Supabase local:

| Fluxo                       | O que foi conferido                                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal, login               | Senha errada devolve "E-mail ou senha inválidos."; login do dono abre na seção da URL.                                                                                              |
| Portal, conta nova          | Criar conta, código de seis dígitos lido no Inbucket, chegada ao cadastro da loja. Máscaras (`12.345.678/0001-90`, `(47) 99999-0000`) e preço (`45,9x0` vira `45,90`). Não enviado. |
| Portal, navegação em 390 px | Menu abre e fecha, `?section=team`, Voltar retorna a `?section=agenda`. Oito seções medidas sem rolagem horizontal da página.                                                       |
| Portal, gaveta e diálogo    | Foco no primeiro campo, fonte Plus Jakarta Sans, Esc fecha e o foco volta ao botão que abriu ("Novo agendamento", "Novo serviço").                                                  |
| Portal, papel equipe        | `diego@vez.local` vê só Operação e Primeiros passos; link direto para `?section=billing` mostra "Acesso restrito".                                                                  |
| Admin, navegação            | 390 px sem rolagem horizontal em Visão geral, Estabelecimentos, ficha, Suporte; `?screen=support` sobrevive ao recarregar; Voltar retorna da tela seguinte.                         |
| Admin, diálogo              | "Suspender" abre com foco no motivo, Esc fecha, foco volta ao botão. Nenhuma ação foi confirmada.                                                                                   |
| Admin e portal, 404         | `/nao-existe` responde 404 com a tela nova.                                                                                                                                         |
| Landing                     | 340, 390, 420, 430, 800 e 801 px sem estouro do cabeçalho; menu abre e fecha ao escolher; HTML servido contém o `<noscript>` e as cinco propriedades `og:`.                         |

### O que não foi verificado

- **Escritas reais.** Aprovar, recusar, remarcar, chamar na fila, salvar serviço,
  suspender loja e enviar o cadastro não foram executados, para não alterar a
  demo. Os formulários foram abertos e preenchidos, não confirmados.
- **Tela de erro.** `error.tsx` compila e entra na build, mas não foi provocada
  ao vivo (exigiria derrubar o banco usado pelas outras frentes).
- **Tab preso no diálogo.** Conferido por leitura do código; no navegador só
  foram exercitados foco inicial, Esc e devolução do foco. Na gaveta do portal o
  Esc foi enviado como evento sintético, porque a tecla do Orca não chegou à
  página com a largura emulada; no admin a tecla real funcionou.
- **Rolagem por âncora na landing.** A rolagem suave não avança na aba
  automatizada (nem um `scrollTo` simples), então só foi conferido que o
  endereço muda para `#planos` e o menu fecha.
- **Segundo fator do admin.** A política local está desligada; a tela não
  apareceu. As mensagens novas foram conferidas só no código.
- **Telas do admin em celular.** Aprovações, Cidades, Cotas, Financeiro,
  Serviços, Avaliações, Clientes, Configurações e Vitrine receberam as regras
  de empilhamento, mas não foram abertas uma a uma em 390 px.
- **Leitor de tela e contraste.** Não medidos.

### Pendências e observações

- A URL guarda a seção, não o estado dentro dela (dia da Agenda, filtros, aba da
  ficha). Recarregar volta ao padrão da seção.
- No admin em celular, tabelas rolam na horizontal; não há versão em cartões.
- `use-dialog.ts` existe em duas cópias idênticas (portal e admin), porque não há
  pacote de interface compartilhado entre os apps web.
- `onboarding.tsx` e `sidebar.tsx` do portal foram reformatados pelo Prettier do
  repositório ao serem editados; o diff é maior que a mudança de comportamento.
- [portal.md](portal.md) e [admin.md](admin.md) ainda não citam `drawer.tsx`,
  `use-dialog.ts` nem os parâmetros `?section=` e `?screen=`. Esses documentos
  são da coordenação.
- Efeito colateral local: ficou no Auth do Supabase local a conta de teste
  `auditoria-web-1790820042@vez.local`, confirmada e sem loja. As sessões de
  teste do navegador foram encerradas.
- Externas: L4 (textos de cobrança), domínio para `metadataBase`/`sitemap`, e as
  pendências de lançamento de [finalizacao-2026-09-30.md](finalizacao-2026-09-30.md).
