# Próximos passos

Documento de continuidade. O [roadmap do app do cliente](roadmap-mobile-cliente.md)
cobria uma superfície só e está quase todo riscado; este cobre o produto.

> **Admin concluído em 2026-09-11** (equipe, suporte, vitrine, console de
> leitura da conta e MFA), feito por agentes em paralelo coordenados pelo Orca.
> A próxima leva — começando por **tirar a cidade do app cliente** — está em
> [orquestracao-admin.md](orquestracao-admin.md#depois-do-admin--a-próxima-leva).
> Ela está em execução: quadro em [orquestracao-produto.md](orquestracao-produto.md).

## O diagnóstico, sem otimismo

O cliente sabe comprar, a loja sabe atender e a equipe da plataforma já opera o
admin. **A loja ainda não consegue nascer sozinha e o negócio não cobra nada.**

| Superfície       | Linhas de código | Estado                         |
| ---------------- | ---------------: | ------------------------------ |
| `mobile-cliente` |            5.475 | Funcional ponta a ponta        |
| `mobile-staff`   |            9.568 | Funcional ponta a ponta        |
| `portal`         |            8.071 | Canvas implementado, dado fixo |
| `admin`          |                — | Completo no Supabase           |
| `landing`        |            3.229 | Canvas implementado, dado fixo |

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

- **Nenhum estabelecimento consegue se cadastrar.** `establishments` não tem
  política de INSERT para `authenticated`. A Edge Function que valida a cota da
  cidade foi documentada e nunca escrita.
- **Nenhuma loja consegue nascer como `pending`.** A aprovação pelo admin já
  funciona; falta a Edge Function de onboarding criar loja + vínculo de dono.
- **O negócio ainda não cobra nada.** Planos, cota, preço e comissão já existem;
  faltam assinatura, fatura, webhook e repasse.
- **Notificação push não existe.** É o que mais dói na operação: a fila só se
  move na tela com o app aberto, que é justamente quando ninguém está olhando.
- **As filas do admin só enchem pelo banco.** Aprovações, denúncias e chamados
  esperam o onboarding da loja e os botões no portal e nos apps (N1, N3, N4 em
  [orquestracao-admin.md](orquestracao-admin.md)).
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
editar escala e ligar serviço a pessoa — é trabalho do portal (item 2). Envio de
foto depende do Storage. E os sete interruptores marcados como "ainda não atua"
esperam a peça que vai lê-los.

### 2. Portal do estabelecimento — `portal` ⟵ **fundação entregue**

Login, sessão, escolha da loja, guarda de papel e contrato de dados/ações já
estão ligados ao Supabase. “Primeiros passos” calcula o progresso pelos dados
reais. As seções futuras não mostram mais o fixture do canvas: ficam vazias e
identificam P5/P6 até a integração chegar. Detalhes em [portal.md](portal.md).

Continua faltando o cadastro operacional do que hoje só existe por SQL:
profissionais, quem faz o quê, horário de funcionamento, jornadas e exceções.
Serviços nascem no onboarding, mas a manutenção completa também é P6.

**Cuidado:** mudar duração de serviço ou jornada **muda a grade de horários** e
pode invalidar reserva futura já vendida. Decida o que acontece com quem já
marcou antes de permitir a edição.

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
  saldo. Ver [assistente.md](assistente.md).
- **Notificações push.** A fila só atualiza com o app aberto — que é justamente
  quando o usuário não está olhando. Vale também para lembrete de reserva. Do
  lado da loja, é o que destrava sete interruptores já gravados: aviso na vez,
  canal do aviso e as quatro preferências de `member_notification_prefs`.
- **Excluir conta (LGPD).** Precisa de Edge Function (RLS não apaga
  `auth.users`) e de uma decisão sobre o histórico de reservas.
- **Deep links.** Quando houver domínio, dá para somar o link mágico ao lado do
  código de 6 dígitos, sem tocar nas telas de auth.

### 7. Lacunas do app do cliente

Nenhuma bloqueia o ciclo; todas incomodam.

| Falta                   | Onde                                          |
| ----------------------- | --------------------------------------------- |
| `app/reserva/[id].tsx`  | detalhe e remarcar — hoje só cancelar no card |
| `app/perfil/editar.tsx` | editar nome e telefone                        |
| Fotos da loja           | tabela existe, upload não                     |
| Busca por proximidade   | coordenadas guardadas, ordenação não usa      |
| Histórico do assistente | tabelas guardam, tela abre vazia              |
| `vzrise`                | animação de entrada que o canvas previa       |

### 8. Landing

O canvas está implementado ([funcionalidades.md](funcionalidades.md#landing--landing)).
Falta o que a liga ao resto:

| Falta                           | Depende de                                            |
| ------------------------------- | ----------------------------------------------------- |
| Formulário gravar o interessado | tabela de interessados ou a Edge Function de cadastro |
| "Entrar" levar ao portal        | login no portal                                       |

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
