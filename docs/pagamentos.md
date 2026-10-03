# Pagamentos: como funciona e como operar

A decisão (provedor, quem recebe, Apple/Google) está em
[decisions/0009](decisions/0009-pagamentos.md). O que você precisa fazer fora do
repositório para ligar a cobrança — Mercado Pago, Supabase, lojas de apps,
contador — está em
[pagamentos-plataformas-externas.md](pagamentos-plataformas-externas.md). Aqui
está como as peças se encaixam e o que olhar quando algo não bate.

**Sem os secrets do provedor nada é cobrado.** As funções respondem 503
`payment_unavailable`, o app do cliente continua dizendo "pagamento direto no
estabelecimento" e o portal avisa que a conexão não está disponível. Não existe
modo "finge que cobrou".

## As peças

| Peça                       | Papel                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `payment-connect`          | Liga a conta da loja ao Vez (OAuth). O dono inicia pelo portal.                        |
| `payment-create`           | Cobra uma reserva (sinal ou valor inteiro, Pix ou cartão), ou confere a que já existe. |
| `billing-invoice-pay`      | Gera o Pix de uma mensalidade, ou confere o que já existe.                             |
| `payment-webhook`          | Recebe o aviso do provedor e consulta a cobrança.                                      |
| `payment-reconcile`        | A cada minuto: estorna o devido, encerra cobrança vencida, confere pendente.           |
| `payments`                 | Pagamento de reserva pelo app. Uma cobrança viva por reserva.                          |
| `billing_invoices`         | Mensalidade. Nasce por `billing_generate_invoices()`.                                  |
| `payment_accounts` + Vault | Conta da loja no provedor; tokens cifrados no Vault.                                   |
| `payment_webhook_events`   | Registro de todo aviso recebido, com erro quando houve.                                |

Agendamentos (`pg_cron`, horários em UTC):

| Job                         | Quando        | Faz                                              |
| --------------------------- | ------------- | ------------------------------------------------ |
| `payments-reconcile`        | todo minuto   | chama `payment-reconcile`, se houver trabalho    |
| `billing-generate-invoices` | 09:10, diário | cria as faturas do mês que ainda não existem     |
| `billing-enforce`           | 09:40, diário | avisa atraso de 3 e 7 dias; suspende na carência |

## O caminho de um pagamento de reserva

1. O cliente confirma a reserva (`book-appointment`) — ela existe antes de
   qualquer pagamento, e continua existindo se ele não pagar.
2. Na tela de pagamento ele escolhe Pix ou cartão. `payment-create` grava a
   linha em `payments` e só então fala com o provedor, usando o token **da
   loja**, com a taxa da Vez como split.
   - **Pix:** a cobrança nasce na hora; o app mostra o copia e cola.
   - **Cartão:** nasce uma página do provedor. A cobrança só existe quando o
     cliente paga nela; até lá a linha tem `provider_checkout_id` e não tem
     `provider_charge_id`.
3. O provedor avisa (`payment-webhook`). A função consulta a cobrança com a
   credencial da loja e aplica o estado. No cartão, é nesse momento que a linha
   ganha o `provider_charge_id`.
4. Se o aviso não chegar, `payment-reconcile` confere em até dois minutos.
5. A cobrança vale 30 minutos. Vencida, é encerrada no provedor e o app oferece
   gerar outra.

## O caminho de um estorno

Ninguém "pede estorno" no código. O gatilho de cancelamento da reserva
(`payments_mark_refund_due`) escreve em `refund_requested_cents` quanto deve
voltar; `payment-reconcile` vê a diferença para `refunded_cents` e devolve.

| Quem cancelou                            | Volta                     |
| ---------------------------------------- | ------------------------- |
| A loja                                   | tudo                      |
| O cliente, no prazo, sinal reembolsável  | tudo                      |
| O cliente, fora do prazo ou sinal retido | o que pagou além do sinal |

A taxa da Vez acompanha: devolveu metade, retém metade.

## O caminho da mensalidade

1. Dia 1º (ou no primeiro dia em que o cron rodar no mês) nasce a fatura de cada
   loja ativa em plano de mensalidade, numa cidade com preço, que já estava
   ativa antes do mês começar. O dono é avisado por push e e-mail.
2. O dono paga por Pix no portal, em Plano e assinatura. O Pix é criado na hora
   em que ele abre a fatura para pagar, na conta **da Vez**, sem split.
3. Não pagou: avisos com 3 e 7 dias de atraso; ao fim da carência
   (`platform_settings.delinquency_grace_days`, padrão 15) a loja é suspensa.
4. Pagou depois: a loja volta sozinha — desde que a suspensão tenha sido da
   cobrança (não de moderação) e a vaga de mensalidade da cidade ainda exista.
   Sem vaga, o motivo da suspensão passa a dizer isso e o time reativa à mão.

Loja em plano de comissão não tem fatura: a parte da Vez sai no split.

## Onde cada um vê o dinheiro

| Quem           | Onde                        | O quê                                            |
| -------------- | --------------------------- | ------------------------------------------------ |
| Cliente        | app, detalhe da reserva     | o que pagou, e se voltou                         |
| Dono e gerente | portal → Financeiro         | cada pagamento: bruto, taxa Vez, tarifa, líquido |
| Dono           | portal → Plano e assinatura | faturas, atraso e prazo até a suspensão          |
| Dono e gerente | app da loja → Financeiro    | total recebido pelo app no período               |
| Admin          | Financeiro → Receita        | mensalidade paga e taxa retida, por mês          |
| Admin          | Financeiro → Cobranças      | faturas, vencidas, reenvio do aviso              |
| Admin          | Financeiro → Repasses       | recebido pelo app e taxa retida, por loja e mês  |

## Testes que rodam sem provedor

- `pnpm --filter @vez/supabase test` — taxa, transições de estado, assinatura do
  webhook, OAuth e o adaptador inteiro (Pix, cartão, busca por referência,
  estorno) contra um `fetch` roteirizado;
- `pnpm db:test:behavior` — quem escreve em quê, tokens no Vault, estorno por
  tipo de cancelamento, fila de conciliação, fatura do mês, régua de
  inadimplência, reativação e o financeiro do admin.

O que só um teste com conta de teste do provedor cobre está no roteiro de
[pagamentos-plataformas-externas.md](pagamentos-plataformas-externas.md#3-mercado-pago--roteiro-de-teste).

## Quando algo não bate

| Sintoma                                       | Onde olhar                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Cliente pagou e o app não mudou               | `payment_webhook_events.error`; a conciliação corrige em até 2 minutos                                    |
| Webhook respondendo 401                       | `MERCADOPAGO_WEBHOOK_SECRET` diferente da assinatura secreta do painel                                    |
| Webhook respondendo 409 `unknown_charge`      | aviso de cobrança que não é nossa, ou que chegou antes da nossa gravação; o provedor reentrega            |
| Cartão pago e linha ainda `pending`           | `provider_charge_id` nulo: o webhook não chegou; a conciliação busca pela referência `pay_<id>`           |
| Estorno marcado e não executado               | `refund_requested_cents > refunded_cents`; log de `payment-reconcile`; saldo da loja no provedor          |
| `payment_reconcile_kick()` = `unconfigured`   | faltam os dois secrets do Vault                                                                           |
| Loja conectada e app diz "no estabelecimento" | `select establishment_accepts_app_payment('<id>')`: loja inativa, interruptor desligado ou conta revogada |
| Fatura não nasceu                             | plano não é mensalidade, cidade sem preço, loja ativa só depois do dia 1º, ou desconto de 100%            |
| Loja pagou e não voltou                       | `establishments.status_reason`: suspensão de moderação, ou vaga da cidade ocupada                         |
| Token da loja vencido                         | renova sozinho a 7 dias do vencimento; se falhar, o dono reconecta                                        |

Estorno que falha (por exemplo, loja sem saldo no provedor) é tentado de novo a
cada dois minutos, indefinidamente, e aparece no log. Não há alerta ainda.

Limite conhecido: se o cliente troca de método e paga a cobrança anterior no
instante exato em que ela é encerrada, o aviso do provedor fica com erro em
`payment_webhook_events` (a reserva já tem outra cobrança viva). O dinheiro está
na conta da loja; o estorno, nesse caso raro, é manual pelo painel do provedor.
