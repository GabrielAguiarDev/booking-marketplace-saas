# Próximos passos

> **Atualização de 30/09/2026:** este documento conserva o histórico das entregas.
> O estado atual e as evidências de validação estão em
> [Auditoria e finalização](finalizacao-2026-09-30.md). As declarações de conclusão
> abaixo se referem às verificações de setembro, não à prontidão de produção.

Documento de continuidade. O [roadmap do app do cliente](roadmap-mobile-cliente.md)
cobria uma superfície só e está quase todo riscado; este cobre o produto.

> **Gate de lançamento concluído em 2026-09-18.** Tudo fora pagamento pelo app
> e o assistente (IA) está pronto no código: conta/LGPD, reserva com detalhe e remarcação,
> avisos, convites, anexos, recuperação de MFA e a correção dos achados de
> segurança. O que falta é configuração externa — ver
> [Checklist de lançamento](#checklist-de-lançamento).
>
> **Leva das outras partes concluída em 2026-09-12** (app cliente sem cidade +
> vitrine + ajuda, portal inteiro com dado real e onboarding, denúncia e
> chamados no app da loja, landing gravando interessado). Quadro e pendências em
> [orquestracao-produto.md](orquestracao-produto.md).
>
> **Admin concluído em 2026-09-11** (equipe, suporte, vitrine, console de
> leitura da conta e MFA), feito por agentes em paralelo coordenados pelo Orca.
> A próxima leva — começando por **tirar a cidade do app cliente** — está em
> [orquestracao-admin.md](orquestracao-admin.md#depois-do-admin--a-próxima-leva).
> Ela está em execução: quadro em [orquestracao-produto.md](orquestracao-produto.md).

## O diagnóstico, sem otimismo

O cliente sabe comprar, a loja sabe atender e a equipe da plataforma já opera o
admin. **A loja ainda não consegue nascer sozinha e o negócio não cobra nada.**

| Superfície       | Linhas de código | Estado                            |
| ---------------- | ---------------: | --------------------------------- |
| `mobile-cliente` |            5.475 | Funcional ponta a ponta           |
| `mobile-staff`   |            9.568 | Funcional ponta a ponta           |
| `portal`         |                — | Completo no Supabase              |
| `admin`          |                — | Completo no Supabase              |
| `landing`        |            3.229 | Grava interessado; leva ao portal |

`packages/mobile-kit` (460 linhas) é o que os dois apps Expo usam igual.

O que **fechou** com o app do estabelecimento:

- A fila anda: chamar, sentar, concluir, marcar ausência e reordenar são ações
  de verdade, com Realtime dos dois lados.
- Reserva vira atendimento: aprovar, recusar com motivo, remarcar, concluir e
  marcar falta. Isso destravou **avaliar** — a política de `reviews` exigia
  `status = 'completed'`, e agora existe quem marque.
- Quem chega sem app entra na fila e na agenda ([decisão 0006](decisions/0006-cliente-sem-conta.md)).
  Sem isso o caderno do balcão continuaria em paralelo, e o número que o app
  mostra ao cliente seria mentira.

O que **continua sem fechar**:

- ~~**Nenhum estabelecimento consegue se cadastrar**~~ — resolvido em
  2026-09-12: a Edge Function `create-establishment` cria a loja `pending` e o
  vínculo de dono, e o portal faz cadastro, análise, correção e reenvio. Ver
  [portal.md](portal.md).
- ~~**As filas do admin só enchem pelo banco**~~ — resolvido: cadastro pelo
  portal, denúncia e chamado pelo app da loja, chamado pelo app do cliente e
  interessado pela landing.
- **Avisos: infraestrutura pronta, provedores pendentes** (2026-09-17). Os
  eventos (reserva, fila, chamado, cadastro, denúncia, interessado) já enchem a
  caixa de saída e o despacho entrega por Expo Push e Resend/Postmark — mas só
  com os secrets configurados; sem eles os avisos ficam `unconfigured`, não se
  perdem. Os dois apps já registram e removem o token. Ver
  [notificacoes.md](notificacoes.md). **Depende da escolha do provedor de
  e-mail e das credenciais do Expo.**
- **O negócio ainda não cobra nada.** Planos, cota, preço e comissão existem, e
  o portal mostra o plano; faltam assinatura, fatura, webhook e repasse.
  **Depende da escolha do provedor de pagamento.**
- ~~**Oito ajustes da tela Configurações do portal** gravam, mas nenhuma
  superfície lê ainda.~~ — os seis de fila (entrada de longe, QR, fila por
  profissional, fechar quando encher, pular quem não responde, aviso na vez)
  atuam no banco desde 2026-09-17 ([notificacoes.md](notificacoes.md#os-ajustes-da-fila-atuam)).
  Sinal reembolsável e pagamento pelo app saíram das telas até existir o
  provedor de pagamento.
- ~~**O app cliente ainda mostra cidade**~~ — resolvido em 2026-09-12: o
  seletor da home saiu, os textos falam em "perto de você" e a cidade é
  resolvida sem interface. Ver [mobile-cliente.md](mobile-cliente.md#sem-cidade-na-interface).

---

## Ordem sugerida

Ordenada por dependência, não por esforço. Os três primeiros itens fecham o
ciclo; sem eles, o resto melhora um produto que não funciona.

### 1. App da equipe — `mobile-staff` ✅ **entregue**

18 telas, cinco abas, o canvas `Vez Estabelecimento.dc.html` implementado. O que
existe e o que deliberadamente não existe está em
[mobile-estabelecimento.md](mobile-estabelecimento.md).

Quatro migrations vieram junto: `establishment_settings` e
`member_notification_prefs` (0007), cliente de balcão (0006), fila que respeita
confirmação de chegada (0007) e o gatilho que impede a loja de se aprovar (0008).

`packages/mobile-kit` nasceu aqui, cumprindo a R8.

**Ficou de fora, e continua valendo como trabalho:** cadastrar profissional,
editar escala e ligar serviço a pessoa — é trabalho do portal (item 2), e o app
abre o portal nessas telas. Foto do perfil, plano real, situação da aprovação e
deep links entraram em 2026-09-17. E os sete interruptores marcados como "ainda não atua"
esperam a peça que vai lê-los.

### 2. Portal do estabelecimento — `portal` ⟵ **cadastro e negócio entregues**

Login, sessão, escolha da loja, guarda de papel e contrato de dados/ações já
estão ligados ao Supabase. “Primeiros passos” calcula o progresso pelos dados
reais. As seções futuras não mostram mais o fixture do canvas: ficam vazias e
identificam P5/P6 até a integração chegar. Detalhes em [portal.md](portal.md).

~~Continua faltando o cadastro operacional do que hoje só existe por SQL~~ —
entregue em 2026-09-12 (P6): serviços, profissionais, quem faz o quê,
funcionamento, jornadas, exceções, perfil público com foto, regras da loja,
plano (leitura) e financeiro do que existe. Detalhe em
[portal.md](portal.md#cadastro-e-negócio-p6).

**A R9 tem resposta.** `schedule_change_impact()` e `block_impact()` listam, no
Postgres, a reserva viva e futura que a jornada proposta deixaria de fora; o
portal mostra a lista antes de salvar e troca o botão por "Salvar mesmo assim".
Salvar não cancela nada — a reserva continua na agenda, e quem editou foi
avisado. Duração e preço são congelados no ato da reserva.

A operação (Visão geral, Agenda, Fila, Clientes, Novo agendamento) é a P5. O
convite de conta nova usa a Edge Function `establishment-invite`; a tela da
equipe e a rota `/convite` foram ligadas em 2026-09-18.

**Pronto quando:** um dono de barbearia publica a loja inteira sem ajuda.

### 3. Onboarding de estabelecimento + aprovação ✅ **entregue**

Duas pontas do mesmo problema:

- **Edge Function `create-establishment`** cria a loja `pending`, o vínculo
  `owner` e os serviços em uma transação, com cidade resolvida sem seletor.
- **Admin aprova** (`pending` → `active`), recusa com motivo ou pede correção.
  O dono vê a mensagem, corrige e reenvia; o novo `submitted_at` devolve a loja
  à fila de Aprovações.

**Pronto quando:** um cadastro feito do zero aparece na busca do app do cliente.

---

### 4. Monetização ⟵ **modelo básico entregue; cobrança pendente**

Os dois modelos coexistem no banco: mensalidade fixa com cota/preço por cidade
e comissão por atendimento. O admin já troca plano e valida a última vaga.

As duas escolhas produzem esquemas diferentes:

| Modelo      | O que entra no banco                                                     |
| ----------- | ------------------------------------------------------------------------ |
| Mensalidade | `cities.monthly_quota` / `monthly_price_cents`; falta assinatura e ciclo |
| Comissão    | `plans.commission_percent`; falta conciliação e repasse                  |

E mudam a fase 3 acima: a cota da cidade só é verificável se houver o conceito
de cota.

Falta transformar o plano escolhido em assinatura e ciclo financeiro depois da
escolha do provedor.

### 5. Pagamento ⟵ **continua bloqueada**

`payments` existe como esquema, sem nenhuma política de escrita. Falta escolher
provedor e definir **quem recebe** — plataforma repassando ou estabelecimento
direto. Isso muda o modelo tributário inteiro.

Ver [decisions/0004](decisions/0004-catalogo-disponibilidade-fila.md), decisão 5.

---

### 6. O que trava produção

- **SMTP.** Sem provedor real, o Supabase hospedado manda ~3 e-mails por hora e
  ninguém se cadastra. É o item operacional mais urgente.
- **Crédito da OpenAI.** A chave está configurada e válida; a conta está sem
  saldo. Ver [assistente.md](assistente.md). O assistente faz parte do
  lançamento e é a última frente a ser concluída.
- **Notificações push.** Os dois apps pedem permissão, registram e removem o
  token e mostram a entrega dos últimos avisos. Para sair do estado
  “não configurado” ainda faltam as credenciais externas do Expo
  (`PUSH_PROVIDER=expo` e o project id do EAS).
- ~~**Excluir conta (LGPD).**~~ — entregue: `delete-account` exige login
  recente, cancela reservas futuras, anonimiza e limpa os metadados do Auth.
- **Deep links.** Quando houver domínio, dá para somar o link mágico ao lado do
  código de 6 dígitos, sem tocar nas telas de auth.

### 7. Lacunas do app do cliente

Nenhuma bloqueia o ciclo; todas incomodam.

Todas fechadas em 2026-09-17/18, menos a animação:

| Item                    | Estado                                                 |
| ----------------------- | ------------------------------------------------------ |
| Detalhe e remarcação    | ✅ `app/reserva/[id].tsx` e `remarcar.tsx`             |
| Dados, endereços etc.   | ✅ `app/conta/*` (dados, endereços, favoritos, avisos) |
| Fotos da loja           | ✅ upload no app da loja, com RLS no Storage           |
| Busca por proximidade   | ✅ ordenação por distância                             |
| Histórico do assistente | pendente — entra na frente da IA, a última             |
| `vzrise`                | pendente — animação de entrada do canvas               |

### 8. Landing ✅ **entregue**

O canvas está implementado ([funcionalidades.md](funcionalidades.md#landing--landing))
e o que ligava a página ao resto entrou em 12 de setembro de 2026:

- o formulário grava em `public.leads` pela RPC `submit_lead` (`anon`, sem
  política de INSERT, com validação e freio contra abuso por número);
- "Entrar" e "Cadastrar minha loja" vão para o portal, por
  `NEXT_PUBLIC_PORTAL_URL` (padrão `http://localhost:3001`);
- a equipe lê e tria os interessados em `Admin › Interessados`.

O que ficou de fora, e por quê:

| Falta                                   | Depende de                                |
| --------------------------------------- | ----------------------------------------- |
| Aviso à equipe quando chega interessado | provedor de e-mail transacional (N6)      |
| Revisão jurídica de termos/privacidade  | advogado; o texto descreve o produto real |
| Razão social, CNPJ e links das lojas    | preencher `NEXT_PUBLIC_*` no deploy       |

---

## Regras que continuam valendo

Do [roadmap](roadmap-mobile-cliente.md#as-regras), e nenhuma mudou:

- **R1** — disponibilidade só no Postgres. Nem o assistente é exceção.
- **R2** — toda tabela nasce com RLS e política, na mesma migration.
- **R3** — fixture morre quando a tabela nasce. Nada de fallback silencioso.
- **R4** — escrita privilegiada é Edge Function. Chave secreta nunca no cliente.
- **R5** — tela com rodapé fixo ou etapa de fluxo vai na raiz de `app/`.
- **R6** — escolha curta é folha inferior, não bloco que empurra a tela.
- **R7** — nada de número inventado. Zero verdadeiro vence estimativa bonita.

Duas que este documento acrescenta:

- **R8 — `packages/` só quando o segundo consumidor existir.** Cumprida:
  `packages/mobile-kit` nasceu com o app do estabelecimento, com tokens,
  tipografia, formatação, `useAsync` e sessão. **Componente de UI ficou fora** —
  dois canvases diferentes num componente só viram `if (app === …)`.
- **R9 — mudança de agenda não invalida venda em silêncio.** Editar duração,
  jornada ou funcionamento pode derrubar reserva já feita. Quem edita precisa
  ver o que vai quebrar.

## Como uma fase é executada

1. Migration com RLS e política juntas (R2).
2. `pnpm db:reset && pnpm db:demo && pnpm db:types`.
3. Testar a política **por comportamento**: ler e escrever como `anon`, como
   dono, e como alguém de outra loja. Metadado não prova bloqueio.
4. Ligar a tela; apagar a fixture (R3).
5. `pnpm typecheck && pnpm lint && pnpm build && pnpm db:check-rls`.
6. Atualizar este documento e registrar a decisão em `docs/decisions/`.

## Checklist de lançamento

Validado localmente em 2026-09-18, com `db:reset` do zero:

| Verificação                                   | Resultado                   |
| --------------------------------------------- | --------------------------- |
| `pnpm db:reset && pnpm db:demo`               | ✅                          |
| `supabase db lint --local`                    | ✅ sem erros                |
| `pnpm db:check-rls`                           | ✅ todas as tabelas com RLS |
| `pnpm db:test:behavior` (matriz de segurança) | ✅ `launch-security: OK`    |
| `pnpm typecheck` / `pnpm lint`                | ✅ 7 pacotes                |
| Testes (`pnpm -r test`)                       | ✅ 73 testes, 0 falhas      |
| `pnpm build`                                  | ✅ landing, portal, admin   |

A matriz em `supabase/tests/launch-security.sql` cobre os achados da auditoria:
cliente não mexe em `joined_at` nem em colunas da reserva, não remarca reserva
de balcão, não vê IDs alheios em `queue_state` e não assume token de push de
outra conta; `establishment_add_member` não é executável por `authenticated`;
convite só vira vínculo no aceite; aviso vencido não é entregue.

**O que falta, tudo fora do código:**

- [ ] `supabase db push` no projeto hospedado e deploy das Edge Functions.
- [ ] SMTP real no Auth do Supabase (item 6).
- [ ] Secrets dos avisos: `NOTIFICATIONS_DISPATCH_SECRET` (≥ 32 caracteres),
      `PUSH_PROVIDER=expo`, `EMAIL_PROVIDER` e a chave do provedor — ver
      [notificacoes.md](notificacoes.md).
- [ ] Project id do EAS nos dois apps, `expo prebuild` e builds de loja.
- [ ] `NEXT_PUBLIC_*` da landing: razão social, CNPJ, links das lojas.
- [ ] Revisão jurídica de termos e privacidade.
- [ ] Verificação de assinatura/antivírus nos anexos de suporte: o banco
      garante tipo declarado coerente com a extensão, não o conteúdo real.

- [ ] Assistente (IA): concluir a implementação — última frente antes do
      lançamento — e colocar crédito na conta da OpenAI.

Fora do lançamento por decisão: pagamento pelo app.

## Estado para retomar

```bash
pnpm db:start && pnpm db:reset && pnpm db:demo   # 2 lojas, 1 equipe, 1 admin, o dia de hoje
cd apps/mobile-cliente && npx expo start         # cliente, porta 8081
cd apps/mobile-staff   && npx expo start         # estabelecimento, porta 8082
```

Contas de teste, todas com senha `senha-forte-123`:

| Conta               | Papel                                            |
| ------------------- | ------------------------------------------------ |
| `rafael@vez.local`  | dono da Barbearia Meia-Nove — acesso total       |
| `diego@vez.local`   | equipe — vê a agenda, não edita cadastro da loja |
| `cliente@vez.local` | cliente, com reserva pendente e lugar na fila    |
| `admin@vez.local`   | administradora da plataforma                     |

E-mails locais em http://127.0.0.1:54324 · Studio em http://127.0.0.1:54323

**Decisões suas que destravam trabalho:** monetização (item 4), provedor de
pagamento (item 5), e o que fazer com reserva já vendida quando a loja muda a
agenda (R9).
