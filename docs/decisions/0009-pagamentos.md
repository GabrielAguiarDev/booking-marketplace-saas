# 0009 — Pagamentos: quem recebe, por qual provedor, e como trocar depois

**Data:** 3 de outubro de 2026
**Status:** aceita
**Migrations:** `20261003120000_payment_provider.sql`, `20261004120000_payment_phases.sql`
**Fecha:** a decisão 5 de [0004](0004-catalogo-disponibilidade-fila.md) e a
fase 6 do [roadmap do app do cliente](../roadmap-mobile-cliente.md).

## O que estava em aberto

Duas perguntas travavam a cobrança desde setembro: **qual provedor** e **quem
recebe o dinheiro**. A segunda é a que importa, porque decide o modelo
tributário e o risco da Vez; a primeira é só preço e pode mudar.

Há dois fluxos de dinheiro no produto, e eles não se parecem:

| Fluxo                                 | Quem paga | Quem recebe          | Valor típico |
| ------------------------------------- | --------- | -------------------- | ------------ |
| **Sinal da reserva** (cliente → loja) | cliente   | loja, com taxa à Vez | R$ 10 a 40   |
| **Mensalidade** (loja → Vez)          | loja      | Vez                  | R$ 149 a 189 |

## Decisões

### 1. A loja recebe direto. A Vez nunca segura o dinheiro do cliente

O sinal cai na conta da **loja** no provedor. A parte da Vez é separada na
origem, no mesmo pagamento (split). A alternativa — a Vez receber tudo e
repassar — foi descartada:

- a Vez seria tributada e auditada sobre um fluxo que não é receita dela;
- guardar e repassar dinheiro de terceiros é atividade regulada pelo Banco
  Central; quem faz isso por nós é o provedor, que tem a licença;
- estorno e contestação (chargeback) recairiam sobre a conta da Vez.

Com split, a receita da Vez é só a taxa — e é só sobre ela que se emite nota.

### 2. Provedor de lançamento: Mercado Pago

Tarifas públicas em outubro de 2026 (confirmar na conta antes de produção;
tarifa pública muda e é negociável com volume):

| Provedor     | Pix                  | Cartão à vista   | Custo fixo                     | Split                                  | Apple/Google Pay       |
| ------------ | -------------------- | ---------------- | ------------------------------ | -------------------------------------- | ---------------------- |
| Mercado Pago | 0,99%                | 3,99% a 4,99%¹   | nenhum                         | sim, sem custo, loja conecta por OAuth | não no checkout do BR  |
| Asaas        | R$ 1,99 fixo²        | 2,99% + R$ 0,49² | nenhum; taxa por subconta      | sim, exige subconta por loja           | não na API             |
| Pagar.me     | 0,99%                | 4,19%            | nenhum; exige CNPJ e comercial | sim, o mais completo                   | Google Pay e Apple Pay |
| Stripe       | ~1,19%               | 3,99% + R$ 0,39  | nenhum                         | sim (Connect)                          | sim, o melhor SDK      |
| Woovi        | 0,80% (mín. R$ 0,50) | não tem          | nenhum                         | sim, só Pix                            | não                    |

¹ 4,99% recebendo na hora, 3,99% recebendo em 30 dias. ² Promocional nos três
primeiros meses: Pix R$ 0,99 e cartão 1,99% + R$ 0,49.

O que isso custa nos nossos dois fluxos:

| Cobrança                      | Mercado Pago | Asaas   | Pagar.me | Stripe  | Woovi   |
| ----------------------------- | ------------ | ------- | -------- | ------- | ------- |
| Sinal de R$ 18 por Pix        | R$ 0,18      | R$ 1,99 | R$ 0,18  | R$ 0,21 | R$ 0,50 |
| Mensalidade de R$ 149 por Pix | R$ 1,48      | R$ 1,99 | R$ 1,48  | R$ 1,77 | R$ 1,19 |
| Serviço de R$ 60 no cartão    | R$ 2,39–2,99 | R$ 2,28 | R$ 2,51  | R$ 2,78 | —       |

Por que Mercado Pago, e não o mais barato de cada linha:

- **Sinal é ticket pequeno.** A tarifa fixa do Asaas come 11% de um sinal de
  R$ 18. Percentual sem piso é o que serve aqui, e o Pix do Mercado Pago empata
  com o Pagar.me no menor custo.
- **Custo fixo zero e sem burocracia.** Não tem mensalidade, taxa por loja nem
  negociação comercial. Com poucos clientes, é o que importa. O Pagar.me cobra o
  mesmo no Pix, mas pede CNPJ e contato comercial para abrir.
- **A loja já tem conta.** Barbearia e salão quase sempre já recebem por Mercado
  Pago. Conectar é um OAuth de dois toques, sem cadastro novo nem análise de
  documentos — o Asaas e o Pagar.me exigem abrir subconta/recebedor por loja.
- **Um provedor só para os dois fluxos.** O Woovi é mais barato na mensalidade
  (R$ 0,29 a menos por loja por mês), mas é um segundo contrato, um segundo
  webhook e um segundo adaptador para economizar centavos.

O que o Mercado Pago tem de pior: cartão caro e documentação irregular. Nenhum
dos dois pesa agora — o caminho principal é Pix — e ambos são o motivo de a
arquitetura abaixo não se amarrar a ele.

**Quando rever:** se o cartão virar parte relevante do volume, ou com volume
suficiente para negociar tarifa, o caminho natural é o Pagar.me (split mais
completo, Google Pay e Apple Pay documentados). Trocar custa um arquivo.

### 3. Pix é o caminho principal; cartão existe, por página do provedor

Pix custa 0,99%; cartão, 4% a 5%, e tem chargeback. Por isso Pix é o método que
a tela oferece primeiro, e o único que nasce sem sair do app.

Cartão entra pelo **checkout hospedado** do Mercado Pago (Checkout Pro): o app
abre a página do provedor por cima, o cliente paga lá e volta. O número do
cartão nunca passa pelo Vez — o que nos deixa fora do escopo pesado do PCI — e
não há SDK nativo de pagamento no app. A mesma página aceita crédito, débito e
saldo da conta Mercado Pago; Pix e boleto são excluídos dela (Pix tem o caminho
próprio, boleto não compensa a tempo de uma reserva). Sem parcelamento.

O cliente também pode pagar **o valor inteiro** pelo app, e não só o sinal. Em
loja sem sinal, pagar pelo app é opcional.

### 4. Apple e Google: três coisas diferentes com o mesmo nome

| O quê                                        | Custo                          | Decisão                          |
| -------------------------------------------- | ------------------------------ | -------------------------------- |
| **Apple Pay / Google Pay** (carteira)        | o do cartão (4–5%); zero extra | **não entra agora** (ver abaixo) |
| **Compra pela conta da loja de apps** (IAP)  | 15% a 30%                      | não usar — e nem é permitido     |
| **Assinatura da loja vendida dentro do app** | 15% a 30% (IAP obrigatório)    | não vender no app                |

- **Carteira (Apple Pay, Google Pay).** É um cartão guardado no celular. Apple e
  Google não cobram nada; paga-se a tarifa de cartão do provedor. **Não foi
  implementada, por três motivos somados:**
  1. O checkout hospedado do Mercado Pago no Brasil não lista Apple Pay nem
     Google Pay entre os meios aceitos (cartão, Pix, boleto, saldo e crédito
     Mercado Pago). Não há como ligá-las sem trocar de provedor.
  2. Os provedores que as oferecem de forma documentada (Stripe, Pagar.me)
     exigiriam que **cada loja abrisse e conectasse uma segunda conta** só para
     isso — o oposto de "simples".
  3. Custam o mesmo que cartão: num sinal de R$ 18, R$ 0,90 a R$ 1,10 contra
     R$ 0,18 do Pix. Seria gastar esforço para oferecer o caminho mais caro.

  O que já existe cobre o mesmo desejo ("pagar sem digitar cartão"): Pix copia e
  cola, e saldo ou cartão salvo da conta Mercado Pago na página de cartão. O
  contrato tem o método `wallet`; quando o provedor for o Pagar.me ou o Stripe,
  é um adaptador e uma tela.

- **Compra dentro do app (IAP), "na conta Google/Apple".** Não se aplica: a
  regra 3.1.3(e) da App Store e a política de Pagamentos do Google Play
  **proíbem** usar a cobrança da loja para serviço físico consumido fora do
  app. Corte de cabelo é exatamente isso. Não é opção de custo; é opção que não
  existe.
- **Mensalidade da loja.** É produto digital; vendida dentro do app do
  estabelecimento, cairia na cobrança obrigatória da loja de apps, com 15% a 30%
  de comissão. Por isso a mensalidade é paga **só no portal web**, e o app do
  estabelecimento não tem tela de compra — só informa onde ela é administrada.

### 5. O ciclo é nosso; o provedor só cobra

É isto que torna a troca de provedor barata. O provedor **não** guarda
assinatura, plano, cliente nem regra de estorno. Ele faz quatro coisas, as que
todo provedor faz: criar cobrança, consultar, cancelar/estornar e avisar por
webhook.

| Mora no nosso banco                                      | Mora no provedor          |
| -------------------------------------------------------- | ------------------------- |
| fatura do mês, vencimento, desconto (`billing_invoices`) | o Pix daquela fatura      |
| valor do sinal, taxa da Vez, estorno devido (`payments`) | o Pix daquele sinal       |
| qual conta é de qual loja (`payment_accounts`)           | a conta e o saldo da loja |
| regra de quando o sinal volta (gatilho no cancelamento)  | a execução do estorno     |

## Arquitetura

```
app do cliente ──► payment-create ──┐
portal ──► billing-invoice-pay ─────┤
portal ──► payment-connect ─────────┤        ┌── mercadopago.ts
provedor ──► payment-webhook ───────┼──► PaymentProvider ──┤
pg_cron ──► payment-reconcile ──────┘     (types.ts)       └── (próximo adaptador)
                  │
                  ▼
   payments · billing_invoices · payment_accounts · Vault
```

- **`_shared/payments/types.ts`** — o contrato `PaymentProvider`. Valores em
  centavos inteiros; estados no vocabulário do nosso banco.
- **`_shared/payments/mercadopago.ts`** — o único arquivo que sabe o que é
  `application_fee`, `x-signature` ou reais com vírgula.
- **`_shared/payments/core.ts`** — regras sem provedor e sem banco: taxa da
  plataforma, transição de estado (só para a frente), assinatura do `state`.
- **`_shared/payments/store.ts`** — registro de adaptadores, credencial da loja
  (com renovação de token) e aplicação do estado na linha.

### Para trocar de provedor

1. Escrever `_shared/payments/<novo>.ts` implementando `PaymentProvider`.
2. Registrá-lo em `BUILDERS`, em `store.ts`.
3. Mudar o secret `PAYMENT_PROVIDER`.
4. Cada loja conecta a conta no provedor novo (o botão do portal já usa o
   provedor ativo).

Cobranças antigas não migram e não precisam: cada linha guarda o `provider` que
a criou, e conciliação, webhook e estorno usam o adaptador daquele provedor. Os
dois convivem até a última cobrança antiga se resolver.

### O que sustenta a corretude

- **Nenhuma política de escrita** em `payments`, `billing_invoices` e
  `payment_accounts`. Dinheiro só se move por Edge Function com service role.
- **O webhook nunca é a verdade.** Ele diz _qual_ cobrança mudou; o estado vem
  de uma consulta ao provedor com a nossa credencial. Aviso forjado não declara
  nada como pago.
- **Uma cobrança viva por reserva**, por índice único parcial. Dois toques em
  "pagar" não geram dois Pix.
- **Estado só anda para a frente.** Aviso atrasado ou repetido é inofensivo.
- **Estorno é decidido pelo banco**, no gatilho de cancelamento — qualquer
  caminho que cancele a reserva marca o estorno devido, e a conciliação executa.
- **Conciliação a cada minuto** cobre webhook perdido, Pix vencido e reserva
  cancelada com cobrança em aberto.
- **Tokens das lojas no Vault**, cifrados; saem só por função que apenas o
  service role executa.

## Regras de negócio que entraram junto (e podem mudar)

Foram escolhidas para destravar o lançamento. Estão cada uma em um lugar só:

| Regra                                                                                  | Onde                             |
| -------------------------------------------------------------------------------------- | -------------------------------- |
| Comissão incide sobre **o que passa pelo app** (sinal ou valor inteiro)                | `platformFeeCents`, em `core.ts` |
| Pagamento não feito **não cancela** a reserva; fica pendente                           | `payment-create` / tela `/sinal` |
| Loja cancela → volta tudo. Cliente no prazo → volta tudo, se a loja permitir           | `payments_mark_refund_due`       |
| Cliente fora do prazo → perde **só o sinal**; o que pagou além dele volta              | `payments_mark_refund_due`       |
| Mensalidade: fatura no dia 1º, vence no dia 10; o mês de entrada é grátis              | `billing_generate_invoices`      |
| Atraso: avisos com 3 e 7 dias; suspensão ao fim da carência (padrão 15 dias)           | `billing_enforce`                |
| Fatura paga reativa a loja sozinha — se foi a cobrança que a suspendeu e ainda há vaga | `billing_invoice_paid`           |

Sobre a primeira: o desenho do admin já dizia "12% sobre agendamentos pagos no
app", e é isso que o código faz. Reserva paga no balcão não gera comissão — no
plano de comissão, o incentivo para a loja receber pelo app é comercial, não
técnico. O financeiro do admin deixou de estimar comissão sobre atendimento
concluído e passou a somar o que foi de fato retido.

## Consequências

- Pagamento pelo app só existe para loja que conectou a conta. As demais seguem
  como antes: o app mostra o valor e o cliente paga no balcão.
- O app do cliente ganhou duas dependências nativas (`expo-clipboard` e
  `expo-web-browser`): é preciso gerar build nova antes de publicar.
- A receita mostrada no admin é a **recebida** (fatura paga, taxa retida), não
  mais uma projeção. Meses anteriores à cobrança aparecem zerados, e é verdade.
- Ficou de fora, de propósito: Apple Pay e Google Pay (item 4), parcelamento, e
  nota fiscal da mensalidade e da comissão — esta última é conversa com contador
  antes de ser código.
- O que só você faz, fora do repositório, está em
  [pagamentos-plataformas-externas.md](../pagamentos-plataformas-externas.md).

## Fontes das tarifas

- [Asaas — preços e taxas](https://www.asaas.com/precos-e-taxas)
- [Mercado Pago — quanto custa receber por Pix](https://www.mercadopago.com.br/blog/quanto-custa-receber-pagamentos-via-pix-e-codigo-qr)
- [Mercado Pago — split de pagamentos](https://www.mercadopago.com.br/developers/en/docs/split-payments/integration-configuration/integrate-marketplace)
- [Pagar.me — ofertas](https://www.pagar.me/ofertas) e [Google Pay](https://docs.pagar.me/docs/google-pay-tm-guide)
- [Stripe — preços](https://stripe.com/pricing)
- [Woovi — planos e preços](https://woovi.com/planos-e-precos/)
- [App Store Review Guidelines, 3.1.3(e)](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play — política de Pagamentos](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [Mercado Pago — Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/overview)
