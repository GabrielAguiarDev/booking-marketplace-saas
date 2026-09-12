# Orquestração — as outras partes do produto

Segundo Run coordenado pelo Orca, depois do [admin](orquestracao-admin.md). O
admin está completo; este quadro cuida do que faz as filas dele encherem e do
que o usuário final vê. Qualquer agente que assumir começa por aqui.

Atualizado em 2026-09-11.

## Como retomar

```bash
orca status --json
orca orchestration run-list --json                   # Run abaixo
orca orchestration run-use --id <run_id> --json      # só para assumir a coordenação
orca orchestration task-list --brief --json
orca orchestration dispatch-show --task <task_id> --json
orca orchestration worker-read --dispatch <dispatch_id> --limit 50 --json
```

Coordenador: laço `check --run <run_id> --wait --types worker_done,escalation,question`.
Worker que caiu sem `worker_done`: anote na seção **Retomada** o que está feito
e redespache (`worker-start --task <id> --worktree current --agent <claude|codex>`;
use `--retry-of <dispatch>` só se o Orca aceitar). Lições do Run do admin:

- **Limite de uso.** Três workers Claude juntos esgotam a sessão da conta em
  minutos, e todos param ao mesmo tempo. No máximo dois Claude em paralelo;
  distribua com Codex quando ele estiver disponível.
- **Terminal reaproveitado** (mesmo agente para a tarefa seguinte) não é fechado
  pelo `worker-stop`; se o agente travar, `worker-abandon` e redespache.

## Run

| Campo    | Valor                                    |
| -------- | ---------------------------------------- |
| Run      | `run_546168ec84de`                       |
| Objetivo | Outras partes do produto (próxima leva)  |
| Worktree | `main` do repositório, sem worktree novo |

## Tarefas

| #   | Task no Orca        | Parte                                    | Depende de | Migration (se precisar)                    | Situação |
| --- | ------------------- | ---------------------------------------- | ---------- | ------------------------------------------ | -------- |
| P1  | `task_a7592b2dc31d` | App cliente: sem cidade, vitrine, ajuda  | —          | `20260912100000_cliente_ajuda.sql`         | ✅ feita |
| P2  | `task_6c4e6b63662d` | Portal: fundação + onboarding da loja    | —          | `20260912110000_onboarding.sql`            | feito    |
| P3  | `task_fb49665360d3` | App da loja: denúncia e chamados         | —          | `20260912120000_loja_denuncia_suporte.sql` | a fazer  |
| P4  | `task_f98b48238b58` | Landing: interessado e "Entrar"          | P2         | `20260912130000_leads.sql`                 | a fazer  |
| P5  | `task_aaafa1c1e37e` | Portal: operação com dado real           | P2         | `20260912140000_portal_operacao.sql`       | a fazer  |
| P6  | `task_926518f005e5` | Portal: cadastro e negócio com dado real | P2         | `20260912150000_portal_cadastro.sql`       | a fazer  |

Fora deste Run, **dependem de decisão sua**:

- **Notificações (N6).** E-mail transacional precisa de provedor (Resend, SES,
  Postmark…) e push precisa das credenciais do Expo (EAS). Sem isso, as
  mensagens ficam gravadas e as telas dizem que o envio ainda não existe.
- **Cobrança e repasse (N7).** Precisa do provedor de pagamento.

Resumo das tarefas (o texto completo é o `spec` no Orca):

**P1 — App cliente.** (a) Tirar toda localidade visível: seletor de cidade da
home, "nesta cidade" no Explorar, "sua cidade" no Assistente e onde mais houver.
A cidade continua existindo nos dados e é resolvida sem interface (hoje só há uma
ativa). (b) Mostrar a vitrine (`showcase_banners()`) na home. (c) "Ajuda": abrir
e acompanhar chamado pela RPC do suporte (`open_support_ticket` e afins).

**P2 — Portal: fundação e onboarding.** O portal (`apps/portal`, porta 3001) é
canvas com dado fixo. Fundação: login pelo Supabase Auth, escolha da loja do
membro, carga por RPC/consulta com RLS e o padrão de ações do admin. Onboarding:
criar conta → cadastrar a loja (Edge Function `create-establishment`, que cria a
loja `pending` e o vínculo `owner`) → tela "em análise" → se o admin pedir
correção, ver a mensagem, corrigir e reenviar (atualiza `submitted_at`, que
devolve a loja à fila de Aprovações). Liga a seção "Primeiros passos".

**P3 — App da loja (`mobile-staff`).** Denunciar avaliação (a política
`review_reports_insert_manager` já existe) e responder ao pedido de
esclarecimento da equipe da plataforma, com a resposta aparecendo na tela de
denúncias do admin. Abrir e acompanhar chamados da loja.

**P4 — Landing.** O formulário grava o interessado (tabela com RLS, escrita por
RPC com limite contra abuso); "Entrar" e "Cadastrar minha loja" levam ao portal.

**P5 — Portal, operação.** Visão geral, Agenda, Fila, Clientes e Novo
agendamento com dado real, reusando as regras que o `mobile-staff` já aplica
(ver `apps/mobile-staff/src/data`).

**P6 — Portal, cadastro e negócio.** Serviços, Equipe, Horários, Perfil público,
Configurações, Plano e assinatura e Financeiro com dado real. Atenção à regra
R9 de [proximos-passos.md](proximos-passos.md): mudar duração ou jornada não
pode invalidar reserva já vendida em silêncio.

## Regras para quem trabalha em paralelo

As do Run do admin continuam valendo — leia a seção
[Regras para quem trabalha em paralelo](orquestracao-admin.md#regras-para-quem-trabalha-em-paralelo)
e os [Padrões do projeto](orquestracao-admin.md#padrões-do-projeto-que-valem-para-toda-tarefa).
Em resumo: banco local compartilhado (nunca `db:reset`/`db:demo`; só a sua
migration, aplicada por `psql`), não editar migration alheia, edições pequenas
em arquivo compartilhado, sem `prettier --write` em arquivo alheio, sem commit e
sem mexer no índice do Git. Acréscimos deste Run:

- **Apps Expo:** `pnpm --filter @vez/mobile-cliente typecheck`/`lint` (idem
  `@vez/mobile-staff`). Para ver a tela, prefira o Expo web
  (`pnpm --filter <app> exec expo start --web --port <porta livre>`) numa aba
  sua; não pare o que outro worker iniciou.
- **Portal:** porta 3001; landing: 3000; admin: 3002 (já rodando). Suba o
  servidor de que precisar numa aba própria.
- **Contas da demo:** `rafael@vez.local` (dono, loja `0a..01`),
  `diego@vez.local` (equipe), `cliente@vez.local`, `admin@vez.local`; senha
  `senha-forte-123`.
- **MVP sem localidade:** o que o usuário final vê (app cliente, landing,
  portal) não nomeia cidade, não oferece seletor de cidade e não mostra vagas.
- **Filas do admin:** quando a sua parte alimentar uma fila do admin
  (Aprovações, Denúncias, Suporte), confira no admin (`localhost:3002`) que o
  item chega e que a resposta volta.

## Checklist de aceite

- [ ] Migration (se houver) aplica limpa; `supabase db lint` e `check-rls` sem erro.
- [ ] Autorização testada por SQL/HTTP: quem pode passa, quem não pode é barrado.
- [ ] `typecheck` e `lint` do app sem erro nos seus arquivos.
- [ ] Fluxo exercitado de verdade (navegador ou Expo web), incluindo erro de validação.
- [ ] Doc do app atualizada (`docs/mobile-cliente.md`, `docs/mobile-estabelecimento.md`, `docs/funcionalidades.md` ou seção nova para o portal).
- [ ] Linha no Registro abaixo e `worker_done` com arquivos, testes e o que ficou de fora.

## Retomada

### 2026-09-11, 19:40 — reinício da máquina

P1 e P2 pararam no meio (terminais perdidos no reinício; nada a ver com limite
de uso desta vez). **Continue do que está em disco.**

- **P1 — App cliente.** ✅ **Concluída em 2026-09-12** (`ctx_5ea16965f373`).
  Cidade fora da interface, vitrine na home e Ajuda ponta a ponta; migration
  `20260912100000_cliente_ajuda.sql` aplicada. Detalhe no Registro.
- **P2 — Portal.** ✅ **Concluída em 2026-09-12** (`ctx_fc1f80348132`).
  Fundação autenticada, seleção/papéis, onboarding e correção ponta a ponta;
  migration `20260912110000_onboarding.sql` aplicada e validada. A cidade é
  resolvida por `resolve_signup_city()`, sem localidade visível para o dono.
  Detalhe no Registro e em [portal.md](portal.md).

## Registro

| Quando           | Quem                          | O quê                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-11 15:45 | coordenador (`term_d6433adb`) | Run criado com P1–P6 (P4–P6 dependem da P2). P1 (`ctx_de01c2c8f089`) e P2 (`ctx_ad4e873134d1`) despachadas para workers Claude. P3 espera vaga: Codex volta às 19:05; no máximo dois Claude em paralelo.                                                                                                                                                                                                                                                                                                                           |
| 2026-09-11 19:45 | coordenador (`term_f88d552a`) | Máquina reiniciou e derrubou P1/P2. Docker, Supabase e admin religados (banco preservado; migration da P1 já aplicada). Redespacho com as duas contas de volta: P1 Claude (`ctx_5ea16965f373`), P2 **Codex** (`ctx_fc1f80348132`), P3 Claude (`ctx_14f5a1bb0d18`).                                                                                                                                                                                                                                                                 |
| 2026-09-12 00:30 | P1 (`term_b533ae36`)          | App cliente entregue: localidade fora da interface (seletor, "nesta cidade", "sua cidade"; `CityPicker` apagado e `useCityId()` resolve a cidade sem tela), vitrine `showcase_banners()` na home entre a fila e as categorias, e Ajuda em `app/ajuda/` (abrir, acompanhar, responder) com atalho na Agenda. Migration aplicada. Dois consertos de caminho: `reviews` é um-para-um e derrubava a aba Histórico, e o `secureStorage` cai em `localStorage` na web (sem isso o app nem abre no Expo web).                             |
| 2026-09-12 00:35 | P2 (`term_aa59934a`)          | Portal ligado ao Supabase: auth por senha/código, seleção e papéis da loja, onboarding por Edge Function, correção/reenvio e estados pendente/recusado/ativo; Primeiros passos usa dados reais e as seções P5/P6 não renderizam fixtures. Migration aplicada; RLS/lint/HTTP/build e fluxo portal → admin → portal validados.                                                                                                                                                                                                       |
| 2026-09-12       | coordenador                   | P1 e P2 concluídas. P5 (portal/operação) despachada no mesmo terminal Codex da P2 (`ctx_...`), P6 (portal/cadastro) para worker Claude. P4 (landing) espera vaga: P3 ainda roda.                                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-12 00:50 | P3 (`term_7ddaaff3`)          | App da loja fecha o ciclo de moderação e o de suporte: `Sua loja › Avaliações` (denúncia por `report_review`, resposta ao esclarecimento por `answer_review_clarification`, decisão da equipe visível, removida marcada em vez de sumida) e `Mais › Ajuda e suporte` (abrir, acompanhar, responder, citando uma reserva). Migration `20260912120000` aplicada; `admin_review_reports()` recriada com o esclarecimento e a resposta, que a tela de Denúncias agora mostra. Ciclo completo exercitado com o admin nos dois sentidos. |
| 2026-09-12       | coordenador                   | P3 concluída. P4 (landing) despachada no terminal Claude liberado pela P3 (`ctx_0d65947380a4`). Restam P4, P5 e P6 rodando.                                                                                                                                                                                                                                                                                                                                                                                                        |
