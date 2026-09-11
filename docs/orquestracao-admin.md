# Orquestração — finalizar o admin

Quadro de trabalho para fechar o painel administrativo (`apps/admin`) com vários
agentes em paralelo, coordenados pelo Orca. Qualquer agente que assumir começa
por aqui. O estado do produto está em [admin.md](admin.md); o que vem depois do
admin está em [proximos-passos.md](proximos-passos.md).

Atualizado em 2026-09-11. **Situação: as cinco tarefas e a verificação final estão concluídas; o Run pode ser encerrado.** O próximo trabalho é a seção [Depois do admin](#depois-do-admin--a-próxima-leva).

## Como retomar

```bash
orca status --json                                   # Orca de pé?
orca orchestration run-list --json                   # achar o Run abaixo
orca orchestration run-use --id <run_id> --json      # só se for assumir a coordenação
orca orchestration task-list --brief --json          # situação de cada tarefa
orca orchestration dispatch-show --task <task_id> --json
orca orchestration worker-read --dispatch <dispatch_id> --limit 50 --json
```

Coordenador que assumir: leia a seção **Tarefas**, confira `task-list` e siga o
laço `check --wait --types worker_done,escalation,question`. Tarefa sem worker
vivo e sem `worker_done`: se o Orca já a devolveu para `ready` (dispatch
`failed` na recuperação), use `worker-start --task <id> --worktree current
--agent <claude|codex>` sem `--retry-of` (o retry é recusado nesse caso). Antes,
anote na seção **Retomada** o que já está feito, para o novo worker continuar
em vez de recomeçar.

Limite de uso: três workers Claude na mesma conta esgotam a sessão em minutos.
Distribua entre Claude e Codex.

## Run

| Campo    | Valor                                    |
| -------- | ---------------------------------------- |
| Run      | `run_2d553612360f`                       |
| Objetivo | Finalizar o painel admin do Vez          |
| Worktree | `main` do repositório, sem worktree novo |

## Tarefas

| #   | Task no Orca        | Tarefa                      | Depende de | Migration                                       | Situação  |
| --- | ------------------- | --------------------------- | ---------- | ----------------------------------------------- | --------- |
| T1  | `task_20a0c9800208` | Equipe e acessos            | —          | `20260911100000_admin_team.sql`                 | concluída |
| T2  | `task_fac0aed427c3` | Suporte (chamados)          | —          | `20260911110000_support_tickets.sql`            | concluída |
| T3  | `task_3d57e30f0fb3` | Vitrine (banners da home)   | —          | `20260911120000_showcase.sql`                   | concluída |
| T4  | `task_0cb22e9ceccb` | Console de leitura da conta | T2         | `20260911130000_account_console.sql`            | concluída |
| T5  | `task_aa8f37af34f3` | MFA administrativo          | T1–T4      | `20260911140000_admin_mfa.sql`                  | concluída |
| —   | —                   | Verificação final           | T1–T5      | — (coordenador: reset, tipos, build, varredura) | concluída |

O texto completo de cada tarefa é o `spec` no Orca (`task-list` sem `--brief`).
Resumo e critérios de aceite:

**T1 — Equipe e acessos.** Hoje a aba é só leitura e incluir alguém exige SQL.
Convidar pessoa por e-mail com papel (`admin`, `operations`, `finance`,
`support`), mudar papel e remover. O convite usa a Admin API do Auth, então vive
numa Edge Function (`admin-invite`) com a secret key, que confere que quem chama
é `admin` da plataforma. Mudar papel e remover são RPCs `admin_*`. Regras: só o
papel `admin` gerencia a equipe; ninguém remove ou rebaixa a si mesmo; sempre
sobra ao menos um `admin`. Tudo auditado. Local: o e-mail cai no Inbucket
(`http://127.0.0.1:54324`).

**T2 — Suporte (chamados).** Tela Suporte hoje é aviso. Tabelas de chamado e
mensagens; chamado aberto por loja (membro) ou cliente, com assunto, categoria,
prioridade (`low`/`normal`/`high`) e situação (`open`, `waiting_customer`,
`resolved`). RPC pública `open_support_ticket` para os outros apps usarem
depois. No admin: fila ordenada por prioridade e espera, detalhe com conversa,
responder, mudar prioridade/situação, atribuir a alguém da equipe. Liga a
contagem da visão geral e do menu (hoje fixas em 0) e a aba Chamados da ficha da
loja. Papéis: `support` e `operations`.

**T3 — Vitrine.** "Banners da Home do app" (canvas). CRUD de banner: título,
subtítulo, imagem (bucket público no Storage), destino (loja, categoria ou
link), janela de exibição, ordem, ativo. Leitura pública por RPC
`showcase_banners()` só com os vigentes, para o app cliente consumir depois.
Sem cidade na interface do usuário final (ver regra do MVP abaixo). Papel:
`operations`.

**T4 — Console de leitura da conta.** Hoje "Registrar acesso" só grava a
autorização. Durante uma janela ativa, o admin abre a conta da loja em modo
somente leitura: agenda (hoje e próximos dias), serviços, profissionais,
ajustes e avaliações recentes. Cada tela aberta grava auditoria de acesso a
conta. Janela expirada bloqueia a leitura no banco, não só na tela. Encerrar a
sessão antes do prazo. Se T2 estiver pronta, o motivo pode citar o chamado.
Papéis: `support` e `admin`.

**T5 — MFA administrativo.** TOTP do Supabase Auth: cadastro do fator no
primeiro acesso, desafio no login, e o banco exigindo `aal2` em `admin_require`
quando `platform_settings.admin_mfa_required` estiver ligado (padrão ligado). A
demo (`supabase/demo/demo-data.sql`) desliga, para o login local continuar
simples; documentar como ligar. Por último porque muda a porta de entrada de
todas as RPCs.

## Retomada de 2026-09-11

_Histórico: todas as retomadas abaixo foram concluídas._

A primeira leva (T1–T3) parou às 23:56 de 10/09: os três workers Claude
bateram juntos no limite de sessão da conta, e depois a máquina reiniciou (Docker
e o servidor do admin caíram e foram religados; o banco local foi preservado).
**Não recomece do zero: continue do que está em disco.** As três migrations já
estão aplicadas no banco local.

- **T1 — Equipe e acessos.** Feito: `20260911100000_admin_team.sql` (aplicada;
  `admin_set_team_role`, `admin_remove_team_member`), Edge Function
  `supabase/functions/admin-invite/`, aba da equipe em `settings.tsx`,
  `components/accept-invite.tsx` ligado ao login (`auth.tsx`), CSS da equipe.
  Falta: terminar os testes de autorização por SQL, servir a função e testar o
  convite de ponta a ponta (Inbucket), testar no navegador, `docs/admin.md`,
  `worker_done`.
- **T2 — Suporte.** Feito: `20260911110000_support_tickets.sql` (aplicada),
  `components/support.tsx`, ações em `store.tsx`/`supabase-actions.ts`, CSS, e a
  ligação em `admin.tsx` estava no meio. **O typecheck está quebrado por isso:**
  `admin.tsx` passa `onOpenTicket` para `EstablishmentDetail`, que ainda não
  aceita a prop. Falta: aba Chamados da ficha (`establishments.tsx`), contagem da
  visão geral (`overview.tsx`) e badge do menu (`sidebar.tsx`), busca por número,
  testes SQL e no navegador, `docs/admin.md`, `worker_done`.
- **T3 — Vitrine.** Feito: `20260911120000_showcase.sql` (aplicada, bucket
  `showcase`), `components/showcase.tsx`, ligação em `admin.tsx`, CSS, typecheck
  dos arquivos da tarefa. Falta: testes SQL de autorização, teste no navegador
  com upload real, `docs/admin.md`, `worker_done`.

- **T5 — MFA (retomada de 11/09, 14:50).** O worker Codex (`ctx_fd4753674bbd`)
  bateu no limite de uso no meio do teste no navegador. Feito: TOTP ligado em
  `supabase/config.toml` e Supabase reiniciado; migration
  `20260911140000_admin_mfa.sql` aplicada (`admin_mfa_policy`,
  `admin_set_mfa_required`, `admin_require` com erro `PVMFA` para `aal1`);
  `page.tsx` decide no servidor entre login, cadastro TOTP e desafio;
  `auth.tsx` com as telas de cadastro/desafio (ajustava a renderização do QR
  code quando parou); `demo-data.sql` desliga o flag; typecheck e lint passavam.
  **No banco local o flag está ligado e há 1 fator TOTP cadastrado** (teste do
  Codex). Falta: confirmar o QR code, fechar o teste no navegador (cadastro,
  desafio, RPC com `aal1` recusada, flag desligado volta ao login simples),
  matriz SQL se não estiver completa, `docs/admin.md`, `worker_done`. Ao
  terminar, deixe o flag **desligado** no banco local para a verificação final
  e para quem usa a demo.

Os arquivos já **preparados para commit** (`git add`) foram preparados fora dos
workers. Não mexa no índice do Git (nada de `git add`, `git reset`, `git stash`).

## Regras para quem trabalha em paralelo

Todos os workers usam o mesmo diretório e o mesmo Supabase local. Estas regras
evitam que um desfaça o outro.

1. **Banco compartilhado.** Nunca rode `pnpm db:reset`, `supabase db reset` nem
   `pnpm db:demo` — apagam o trabalho dos outros. Escreva só a sua migration
   (nome na tabela acima) e aplique com
   `docker exec -i supabase_db_vez-saas psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/<sua>.sql`.
   Para iterar, teste dentro de `begin; … rollback;` e aplique de vez só quando
   estiver estável. O reset do zero é da verificação final.
2. **Não edite migration de outra tarefa** nem a
   `20260910121000_admin_platform.sql`. Para mudar função antiga, use
   `create or replace` na sua migration.
3. **Arquivos compartilhados** (`store.tsx`, `supabase-actions.ts`, `model.ts`,
   `admin-data.ts`, `admin.tsx`, `sidebar.tsx`, `data.ts`, `globals.css`,
   `overview.tsx`, `establishments.tsx`, `database.types.ts`): edições pequenas
   e localizadas, relendo o arquivo antes; nada de reescrever o arquivo inteiro.
   Não rode `prettier --write` neles — a verificação final formata. Arquivos
   novos da sua tarefa são seus: formate à vontade.
4. **Typecheck** pode falhar por edição em andamento de outro worker. Resolva os
   erros dos seus arquivos; se o erro é de outra área, registre no
   `worker_done` em vez de consertar o código alheio.
5. **Tipos gerados:** depois de aplicar a sua migration, `pnpm db:types` é
   seguro (gera a partir do banco inteiro).
6. **Não faça commit nem push.** O coordenador cuida do Git.
7. **Servidor do admin** já roda em `http://localhost:3002` (terminal "Codex
   continuidade…"). Não pare nem reinicie. Login local: `admin@vez.local` /
   `senha-forte-123`.

## Padrões do projeto que valem para toda tarefa

- Toda escrita do admin é uma RPC `admin_*`: `security definer`,
  `set search_path = ''`, começa com `perform public.admin_require(array[...])`
  com os papéis certos, e grava `public.admin_write_audit(...)` na mesma
  transação. O `grant` automático só cobriu as funções da migration antiga:
  função nova precisa de `revoke execute … from public, anon` e
  `grant execute … to authenticated, service_role`.
- Gatilho que decide "quem está escrevendo" (`current_user`) é
  `security invoker`. Num `security definer`, `current_user` é sempre `postgres`
  e a checagem passa para qualquer um — esse bug já aconteceu aqui.
- Toda tabela nova em `public` tem RLS e ao menos uma política
  (`./scripts/check-rls.sh` confere). Sem política de escrita direta: escrita
  passa por RPC.
- Texto de auditoria e de interface em português, sem enum cru ("active",
  "petshop").
- A interface não promete o que o backend não faz. Se algo depende de outra
  parte (e-mail, app da loja), diga isso na tela.
- Next.js 16: leia o guia em `node_modules/next/dist/docs/` antes de usar API
  do Next (ver `apps/admin/AGENTS.md`).
- **MVP sem localidade:** nada que o usuário final vê (app cliente, landing,
  portal) nomeia cidade, oferece seletor de cidade ou mostra vagas. O admin é
  interno e pode.

## Checklist de aceite de cada tarefa

- [ ] Migration aplica limpa no banco local; `pnpm exec supabase db lint --local --level warning` sem erro.
- [ ] `./scripts/check-rls.sh` passa.
- [ ] Autorização testada por SQL: papel certo passa, papel errado e conta comum são barrados.
- [ ] `pnpm --filter @vez/admin typecheck` e `lint` sem erro nos seus arquivos.
- [ ] Fluxo exercitado no navegador (login, ação, aviso de sucesso, erro de validação, linha na auditoria).
- [ ] `docs/admin.md` atualizado: o que a tela faz e o limite que sobrou.
- [ ] `worker_done` com arquivos alterados, como testou e o que ficou de fora.

## Depois do admin — a próxima leva

Com T1–T5 fechadas, o admin fica completo do lado dele, mas várias filas só
enchem quando as outras partes existirem. Esta é a ordem proposta para o
próximo Run (detalhes de cada parte em [proximos-passos.md](proximos-passos.md)):

| #   | Parte                       | O que fecha                                                                                                                                                                              | Depende de                    |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| N0  | Tirar cidade do app cliente | A home do `mobile-cliente` tem `CityPicker`; Explorar diz "NESTA CIDADE" e o Assistente "lojas da sua cidade". Contraria a regra do MVP (sem localidade para o usuário). Achado pela T3. | —                             |
| N1  | Onboarding da loja          | Edge Function `create-establishment` + formulário; reenvio depois de "pedir correção". Enche Aprovações.                                                                                 | —                             |
| N2  | Portal com dado real        | `apps/portal` hoje é canvas com dado fixo; passa a ler/gravar no Supabase como o admin.                                                                                                  | N1 (login e loja do dono)     |
| N3  | Denúncia pela loja          | Botão "denunciar avaliação" e resposta ao pedido de esclarecimento (`mobile-staff` e portal). Enche Denúncias.                                                                           | —                             |
| N4  | Chamados pelos apps         | Abrir e acompanhar chamado no portal, `mobile-staff` e `mobile-cliente` pela RPC da T2.                                                                                                  | T2                            |
| N5  | Vitrine no app cliente      | Home do `mobile-cliente` mostra `showcase_banners()` (sem cidade).                                                                                                                       | T3                            |
| N6  | Notificações                | E-mail (SMTP real) e push para decisão de cadastro, moderação, esclarecimento e resposta de chamado.                                                                                     | N1, N3, N4                    |
| N7  | Cobrança e repasse          | Assinatura, fatura, webhook e repasse; liga a tela Financeiro.                                                                                                                           | **decisão do provedor (sua)** |
| N8  | Landing                     | Formulário grava o interessado; "Entrar" leva ao portal.                                                                                                                                 | N1, N2                        |

## Registro

Cada worker e o coordenador acrescentam uma linha ao terminar uma etapa.

| Quando           | Quem                                             | O quê                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-10 23:45 | coordenador (Claude, `term_b9424d29`)            | Run criado; T1 (`ctx_8447ad1787c8`), T2 (`ctx_3a2acb2cb031`) e T3 (`ctx_4cf9163a40dc`) despachados para workers Claude no worktree `main`. Codex fora até 02h12 (limite de uso). Base: correções da varredura do admin ainda não commitadas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-10 23:56 | workers T1–T3                                    | Os três pararam no limite de sessão do Claude; a máquina reiniciou depois. Trabalho parcial preservado em disco e no banco.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-11 14:10 | coordenador (`term_d6433adb`)                    | Docker, Supabase e servidor do admin religados sem reset. Redespacho: T1 Claude (`ctx_d23cf21e77a0`), T2 **Codex** (`ctx_be043c9603a5`), T3 Claude (`ctx_619a8a214175`), com a seção Retomada.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-11 14:16 | T1 (Claude, `term_a3fafd93`, `ctx_d23cf21e77a0`) | Equipe e acessos pronta. Testado: autorização por SQL (admin passa; operations, support, finance e conta comum barrados; auto-alteração e auto-remoção barradas; rebaixamento mútuo concorrente recusado pela trava), HTTP da `admin-invite` (401/403/400/409 e os três casos de convite) e navegador (convidar, erro de validação, e-mail no Inbucket, aceitar e definir senha, mudar papel, remover, auditoria). Contas de teste `t1-*` apagadas do banco local. `functions serve` segue rodando no terminal do T1 (serve todas as funções locais).                                                                                                                                                                                                                                                                      |
| 2026-09-11 14:19 | T2 (Codex, `term_5d12efa1`, `ctx_be043c9603a5`)  | Suporte pronto: migration, fila e conversa, resposta/situação/prioridade/atribuição, contagens, busca por número e aba da loja. Migration reaplicada em transação com rollback; lint, RLS, tipos, typecheck, ESLint, autorização SQL e fluxo no navegador passaram. Cinco chamados demo ficaram no banco local, abertos pela RPC pública; portal e apps ainda precisam ligar o fluxo.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-11 14:21 | T3 (Claude, `term_b08d5e3d`, `ctx_619a8a214175`) | Vitrine pronta. Migration reaplicada do zero em transação com rollback; lint, RLS, tipos, typecheck e ESLint limpos. Autorização por SQL: operations passa; finance, support e conta comum barrados nas escritas e no upload do bucket; anon e conta comum só veem vigentes (pausado, agendado, encerrado e loja suspensa ficam de fora). Navegador (Chromium isolado, sem mexer nas abas dos outros): upload real, erro do formulário e do banco, editar com troca de imagem, reordenar, pausar, remover, auditoria e limpeza do Storage. Ficaram 2 banners de teste no banco local; exibir no app do cliente é o N5.                                                                                                                                                                                                     |
| 2026-09-11       | coordenador                                      | T1, T2 e T3 concluídas (typecheck e lint limpos juntas). T3 achou cidade no app cliente → N0. T4 despachada no mesmo terminal Codex da T2 (`ctx_ebbc86dcfb1f`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-09-11 14:36 | T4 (Codex, `term_5d12efa1`, `ctx_ebbc86dcfb1f`)  | Console de leitura pronto: janela de 15/30/60 min para Suporte/Admin, cinco RPCs gated e auditadas, cliente mascarado na agenda, reabertura pela ficha, encerramento e retorno automático ao expirar. Migration validada com rollback e aplicada; tipos, lint do banco, RLS, typecheck, ESLint e matriz SQL de papéis/sessões passaram. No navegador passaram abertura, cinco seções, contagem regressiva, reabertura, encerramento, expiração e auditoria de cada seção.                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-11       | coordenador                                      | T4 concluída (typecheck, lint, RLS e lint do banco limpos). T5 despachada no terminal Codex (`ctx_fd4753674bbd`); ela reinicia o Supabase para ligar o TOTP.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-11 15:20 | T5 (Claude, `term_87bbd654`, `ctx_4160673d7c58`) | MFA pronto (retomada do Codex). Ajustes: ligar o flag vale em `aal1` e desligar exige `aal2` (senão a demo não liga pela tela); `admin-invite` passa por `admin_require` antes de enviar o convite (sessão só com senha disparava e-mail); ação com `PVMFA` recarrega para o desafio; rótulo "Desligado". Migration reaplicada do zero numa transação; matriz SQL (flag × aal × papéis, `admin_require` direto e anon barrados), HTTP (aal1 recusado, cadastro, desafio, refresh mantém aal2, token aal1 antigo recusado, convite 403/201) e navegador headless (cadastro com QR, código errado, recarregar, sair, desafio, desligar, login simples, religar em aal1, auditoria). Supabase não foi reiniciado de novo. Banco local: flag **desligado**, nenhum fator TOTP, linhas de auditoria e contas de teste apagadas. |
| 2026-09-11 15:05 | coordenador                                      | Codex bateu no limite de uso na T5 (tentar de novo às 19:05). Dispatch `ctx_fd4753674bbd` abandonado (terminal Codex reaproveitado não fecha pelo stop) e T5 redespachada para worker Claude (`ctx_4160673d7c58`) com a retomada anotada.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-11 15:30 | coordenador                                      | T5 concluída (worker Claude `ctx_4160673d7c58`). **Verificação final:** `db:reset` do zero aplica as 6 migrations do admin em ordem + `db:demo` (MFA desligado); `db lint`, `check-rls`, `db:types` sem diferença; `typecheck` e `lint` dos 7 pacotes; build do admin; Prettier (formatada a `admin-invite`); varredura headless em todas as telas e abas: nenhuma tela-aviso, nenhum erro de console ou HTTP. Chamados de demonstração: `supabase/snippets/support-demo.sql` (fora do `db:demo`).                                                                                                                                                                                                                                                                                                                         |
