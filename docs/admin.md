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

| Arquivo                          | O que é                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/admin.tsx`           | Casca: menu, cabeçalho, troca de tela, modais                                                                                                 |
| `components/sidebar.tsx`         | Menu lateral com os quatro grupos e os distintivos                                                                                            |
| `components/admin-data.ts`       | Carga inicial pelas RPCs protegidas do Supabase                                                                                               |
| `components/store.tsx`           | Contrato único de leitura e ações usado por todas as telas                                                                                    |
| `components/supabase-actions.ts` | Escritas transacionais e recarga do snapshot                                                                                                  |
| `components/data.ts`             | Navegação, etiquetas e opções fechadas dos formulários                                                                                        |
| `components/tokens.ts`           | As cores do canvas que também precisam existir em JS                                                                                          |
| `components/blocks.tsx`          | Peças repetidas: etiqueta, grade de vagas, nota, abas                                                                                         |
| `components/accept-invite.tsx`   | Chegada pelo link do convite da equipe: grava a sessão e pede a senha                                                                         |
| `components/showcase.tsx`        | Vitrine: banners da home do app, com upload da imagem e prévia no formato da home                                                             |
| `components/account-console.tsx` | Console temporário e somente leitura da conta, com contagem regressiva e cinco seções auditadas                                               |
| uma tela por arquivo             | `overview`, `approvals`, `establishments`, `support`, `cities`, `quotas`, `finance`, `services`, `reviews`, `customers`, `settings`, `modals` |

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
- editar parâmetros, abrir e encerrar um console de suporte somente leitura;
- publicar ou retirar uma cidade da busca;
- responder, priorizar, atribuir e mudar a situação de chamados;
- convidar pessoa para a equipe, mudar o papel e remover (ver
  [Equipe e acessos](#equipe-e-acessos));
- criar, editar, pausar, reordenar e remover banner da vitrine (ver
  [Vitrine](#vitrine)).

O bloqueio de cliente também é aplicado pela Edge Function
`book-appointment`: uma conta bloqueada não cria novas reservas mesmo tentando
chamar o backend fora da interface. A mesma função cria o bloqueio automático
quando o limite de faltas dos últimos 30 dias é atingido. O limite da fila é
aplicado por trigger para entradas do app e do balcão.

Catálogo, serviços e sinônimos alimentam a RPC pública de busca; a quantidade
de resultados gravada em `search_events` é calculada no servidor. Alterações de
plano são aplicadas imediatamente enquanto não existe ciclo de cobrança, e o
intervalo mínimo configurado é validado no banco.

Cota e preço local de toda cidade são editados na tabela de Cotas e planos
(`admin_save_quotas`; preço exige o papel financeiro). Uma cidade só é ativada
com preço definido. O intervalo mínimo entre trocas de plano conta a partir da
última troca: a primeira atribuição, na aprovação, não conta.

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

## Equipe e acessos

Só o papel `admin` gerencia a equipe, e quem confere é o banco, não a tela
(para os outros papéis, a aba mostra a lista sem os botões). A migration é
`20260911100000_admin_team.sql`.

- **Convidar** (nome, e-mail, papel) chama a Edge Function `admin-invite`. Ela
  valida o JWT, confere em `platform_admins` que quem chama é `admin` antes de
  qualquer e-mail sair e usa a Admin API do Auth (`inviteUserByEmail`, com a
  secret key só no servidor). Papel e auditoria são gravados pela RPC
  `admin_add_team_member`, chamada com o JWT de quem convidou: a linha da
  auditoria sai no nome da pessoa certa, na mesma transação da concessão. Há
  três casos:
  - e-mail novo: o Auth cria a conta e manda o convite, e a pessoa aparece como
    "convite pendente" até aceitar;
  - e-mail de uma conta que já existe (cliente, dono de loja): nenhum e-mail
    sai, a pessoa só ganha o papel e entra com a senha que já usa;
  - convite ainda pendente, convidado de novo: o Auth reenvia o e-mail e o
    papel pedido passa a valer.
- **Aceitar**: o link do e-mail volta ao painel (`ADMIN_SITE_URL` da função,
  padrão `http://localhost:3002/`, que precisa estar em
  `additional_redirect_urls`) com a sessão no fragmento da URL. A tela de
  `accept-invite.tsx` grava a sessão e pede a senha antes de entrar. Um link
  expirado ou já usado mostra o aviso para pedir outro convite.
- **Mudar papel** e **remover** são as RPCs `admin_set_team_role` e
  `admin_remove_team_member`. Ninguém muda o próprio papel nem remove a si
  mesmo, e sempre sobra ao menos um `admin`. As linhas de `admin` são travadas
  antes da checagem: se dois admins rebaixam um ao outro ao mesmo tempo, o
  segundo espera o primeiro e é recusado. Remover tira só o acesso ao painel; a
  conta do Auth continua existindo.

`admin_require` deixa o papel `admin` passar em qualquer lista, então as RPCs da
equipe conferem o papel de novo, explicitamente (`admin_require_team_admin`).

No banco local, o convite precisa da função no ar
(`pnpm exec supabase functions serve admin-invite --env-file supabase/functions/.env`),
e o e-mail cai no Inbucket (`http://127.0.0.1:54324`).

## Suporte

A migration `20260911110000_support_tickets.sql` cria os chamados com número
curto sequencial, prioridade e situação, além da conversa. A leitura segue a
origem do pedido: quem abriu lê o próprio chamado, membros leem os chamados
abertos em nome da loja e a equipe de suporte lê tudo. Não há política de
escrita direta nas duas tabelas.

A tela **Suporte** traz a fila por prioridade e tempo de espera, filtros por
situação, prioridade e responsável, conversa, resposta, atribuição e mudança
de situação/prioridade. Cada escrita usa uma RPC `admin_*`, aceita os papéis
`support` e `operations` (além de `admin`) e grava a auditoria em português na
mesma transação. A visão geral e o menu contam os chamados em andamento; a
busca do cabeçalho aceita o número (`#4401`), e a aba **Chamados** da ficha da
loja abre o atendimento selecionado.

As RPCs autenticadas `open_support_ticket` e `reply_support_ticket` já são o
contrato para lojas e clientes abrirem e continuarem a conversa. Ligar esse
fluxo ao portal, `mobile-staff` e `mobile-cliente` é trabalho das outras partes;
o admin não simula esse envio. Para testar localmente sem elas,
`supabase/snippets/support-demo.sql` abre cinco chamados pela RPC pública.

## Console de leitura da conta

A migration `20260911130000_account_console.sql` transforma **Registrar acesso**
em uma janela real de suporte para os papéis `support` e `admin`. Depois de
informar um motivo (que pode citar o número curto de um chamado) e escolher 15,
30 ou 60 minutos, a pessoa entra no console da loja. A ficha mostra a sessão
ativa e permite reabri-la enquanto durar; **Encerrar** fecha a janela antes do
prazo, e a tela volta sozinha à ficha quando o relógio chega a zero.

O console é somente leitura e separa **Agenda** (hoje e os próximos 7 dias,
com o nome do cliente reduzido ao primeiro nome), **Serviços**,
**Profissionais**, **Ajustes** e **Avaliações** recentes. Cada aba chama uma RPC
própria. Todas validam de novo no banco o id da sessão, o usuário, a loja, o
encerramento e o prazo; uma chamada fora da janela recebe `42501`, mesmo feita
fora da interface. Cada seção consultada e o encerramento antecipado geram uma
linha de auditoria com `account_access = true`, visível também à loja conforme a
política já existente.

## Vitrine

"Banners da Home do app" no canvas. A migration é
`20260911120000_showcase.sql`. O banner é **global**: o app do cliente não tem
cidade, então não existe segmentação por cidade (nem na tabela, nem na tela).

- **Tabela** `showcase_banners`: título (2–60), subtítulo (até 120), caminho da
  imagem no Storage, destino (`establishment` + id da loja, `category` + valor
  do enum, ou `url` https), início e fim opcionais, ordem, ativo, quem criou e
  carimbos. RLS: `anon` e `authenticated` leem só os **vigentes**; não há
  política nem privilégio de escrita direta.
- **Vigente** (`showcase_is_live`) = ativo, dentro da janela e, se o destino é
  uma loja, a loja está `active`. É a mesma regra na política, na RPC pública e
  na situação da tela (`bannerState` em `model.ts`): no ar, agendado,
  encerrado, pausado ou destino indisponível (loja suspensa sai do ar sozinha e
  volta quando a loja volta).
- **Imagem**: bucket público `showcase` (JPG/PNG/WebP, até 5 MB). A URL pública
  serve para qualquer um; listar, subir, trocar e apagar objetos em
  `storage.objects` só com o papel `operations` (ou `admin`), pela mesma porta
  de entrada das RPCs (`showcase_can_manage` → `admin_require`). O navegador
  sobe o arquivo em `banners/<uuid>.<ext>` e só então chama
  `admin_save_banner`, que confere que o arquivo existe. Se o banco recusa, a
  imagem recém-enviada é apagada; ao trocar a imagem, a antiga é apagada; ao
  remover o banner, a RPC devolve o caminho e o navegador apaga o arquivo.
- **RPCs do admin** (papel `operations`; toda a equipe lê):
  `admin_showcase_banners`, `admin_save_banner` (cria sem `p_id`, edita com),
  `admin_set_banner_active`, `admin_reorder_banners(p_ids)` (lista completa na
  ordem nova; lista velha ou incompleta é recusada) e `admin_delete_banner`.
  Validam título, imagem, loja existente e ativa, categoria válida, link
  https, fim depois do início e fim novo no passado. Auditoria em português
  ("Editou o banner … — título: … → … · imagem trocada").
- **Tela**: lista com miniatura, destino, situação e janela; subir/descer
  ordem, pausar/ativar, editar (upload pelo `supabase.storage`, loja escolhida
  entre as ativas ou categoria), remover com confirmação, e ao lado a prévia no
  formato de card da home do app, só com o que está no ar e sem cidade. Papel
  sem permissão vê a lista com os botões desligados.

**RPC pública para o app do cliente:** `showcase_banners()` (`anon` e
`authenticated`) devolve `id, title, subtitle, image_path, target_kind,
target_value` dos vigentes, na ordem do carrossel. Exibir isso na home do
`mobile-cliente` é trabalho das outras partes (N5 em
[orquestracao-admin.md](orquestracao-admin.md)). O encaixe é em
`apps/mobile-cliente/app/(tabs)/index.tsx`, logo acima da seção "Categorias"
(depois do card da fila), com um hook novo em `src/data/` que chama a RPC. A
imagem vem de `supabase.storage.from("showcase").getPublicUrl(image_path)`,
proporção 2:1 com o texto por cima da parte de baixo, como na prévia. O toque
leva a `/loja/[id]` (loja), `/resultados?category=<valor>` (categoria) ou
`Linking.openURL` (link). Sem banner vigente, a home começa nas categorias.

## Segundo fator (MFA)

TOTP do Supabase Auth (`[auth.mfa.totp]` com `enroll_enabled` e
`verify_enabled` ligados em `supabase/config.toml`; mudar isso exige
`pnpm db:stop && pnpm db:start`). A migration é `20260911140000_admin_mfa.sql`.

- **Banco é a barreira.** `platform_settings.admin_mfa_required` (padrão
  ligado). Com ele ligado, `admin_require` recusa todo token sem
  `aal = 'aal2'` com o erro `PVMFA` ("Confirme o segundo fator para acessar o
  painel."), antes de conferir o papel. Vale para qualquer RPC `admin_*`, para
  o Storage da vitrine e para a Edge Function do convite, porque todos passam
  por `admin_require`. Uma chamada direta à API com o token só de senha é
  recusada do mesmo jeito.
- **`admin_mfa_policy()`** é a única leitura da equipe que não passa por
  `admin_require`: devolve o flag para o Server Component decidir a tela antes
  de chamar o resto. Conta fora da equipe recebe `42501`.
- **Porta de entrada** (`app/page.tsx`): sem sessão, login. Com sessão, lê o
  flag e `getAuthenticatorAssuranceLevel()`. Flag ligado e sessão em `aal1`:
  se a conta não tem fator verificado (`nextLevel` ≠ `aal2`), tela de
  **cadastro** (QR code e chave do `mfa.enroll`, confirmação com o código); se
  tem, **desafio** (`challengeAndVerify`). Um fator não verificado deixado por
  cadastro abandonado é removido antes de gerar outro. Se mesmo assim uma RPC
  devolver `PVMFA` (o flag foi ligado no meio da sessão), a carga do servidor
  cai no desafio e as ações do navegador pedem `router.refresh()`, que leva lá.
- **Sessão**: o `proxy.ts` renova o token a cada requisição; o refresh mantém
  `aal2`. "Sair" (no painel e na tela do fator) encerra a sessão.
- **Ligar e desligar**: Configurações → Parâmetros da plataforma → "Segundo
  fator no painel", só o papel `admin`, pela RPC `admin_set_mfa_required`, com
  auditoria ("Ativou/Desativou o segundo fator administrativo"). **Desligar
  exige `aal2`** sempre. Ligar vale com `aal1` (só endurece o acesso): a própria
  sessão cai logo no cadastro ou no desafio. Por SQL:
  `update public.platform_settings set admin_mfa_required = true where id;`
- **Demo local**: `supabase/demo/demo-data.sql` desliga o flag, para
  `admin@vez.local` entrar só com a senha. Para testar o MFA, ligue pela tela ou
  pelo SQL acima e use um app autenticador (ou gere o código com o segredo
  exibido na tela).

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

- **Notificação de chamado** ainda não envia e-mail nem push. A resposta fica
  persistida e aparecerá nos outros apps quando eles adotarem as RPCs públicas.
- **Convite da equipe**: o e-mail usa o modelo padrão do Supabase Auth, em
  inglês ("You've been invited"); o modelo próprio fica para a leva de
  notificações. Em produção o envio precisa de SMTP próprio, porque o SMTP
  embutido do Supabase manda poucos e-mails por hora (quando o limite estoura,
  a função devolve um aviso de limite de e-mails). O link aberto num navegador
  já logado no painel com outra conta mantém a sessão atual, porque o convite
  só é lido na tela de login: nesse caso, use uma janela anônima ou saia antes.
- **Remover ou rebaixar alguém da equipe** vale na próxima ação da pessoa (toda
  RPC confere o papel); a sessão já aberta não é derrubada na hora.
- **Vitrine**: o app do cliente ainda não mostra os banners (a RPC
  `showcase_banners()` já existe; ver [Vitrine](#vitrine)). Não há métrica de
  toque/impressão por banner nem corte de imagem na tela: a arte chega pronta
  em 2:1. Se o navegador fechar entre o upload e a gravação, o arquivo fica
  solto no bucket (sem banner apontando para ele); não há limpeza automática.
- **Denúncias de avaliação** só entram pelo banco: a política
  `review_reports_insert_manager` existe, mas nenhum app de loja tem o botão
  "denunciar". Mesma situação das **solicitações de cadastro**, que esperam o
  onboarding.
- **Os controles do editor do canvas** (`startScreen`, `queueFirst`,
  `showRiskFlags`) eram botões do Claude Design, não da tela. Viraram o
  comportamento padrão: começa na visão geral, fila de trabalho no topo,
  sinalização de risco ligada.
- **Cobranças e repasses** aguardam a escolha do provedor de pagamento. A tela
  mostra o estado vazio real e não inventa faturas. A receita operacional é uma
  estimativa derivada do plano atual, descontos vigentes e atendimentos
  concluídos; não é histórico contábil.
- **Mensagens de correção, decisão e moderação** ficam persistidas, mas e-mail,
  push e a caixa de resposta do portal dependem do onboarding/notificações.
- **Autenticador perdido** não tem recuperação pela tela: não há código de
  recuperação nem "redefinir o fator de alguém" na Equipe. Hoje é apagar o
  fator pelo Studio/Admin API do Auth (ou
  `delete from auth.mfa_factors where user_id = …`), e a pessoa cadastra de
  novo no próximo login. Em produção, confira no projeto hospedado que o TOTP
  está habilitado nas configurações do Auth (o `config.toml` só vale no local).

No banco local, `pnpm db:demo` cria `admin@vez.local` com a mesma senha das
outras contas de demonstração, com o segundo fator desligado.
