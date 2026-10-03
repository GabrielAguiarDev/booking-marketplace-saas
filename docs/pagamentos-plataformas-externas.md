# Pagamentos: o que fazer fora do repositório

O código está pronto e testado sem provedor. Para cobrar de verdade faltam
tarefas que só você pode fazer, em plataformas de fora. Esta página é a lista,
na ordem em que destravam umas às outras.

A decisão está em [decisions/0009](decisions/0009-pagamentos.md); a operação do
dia a dia, em [pagamentos.md](pagamentos.md).

> Os nomes de menu dos painéis mudam com o tempo. Onde esta página diz "em
> Webhooks", procure a seção com esse sentido; o que importa é o valor a copiar
> e para onde ele vai.

## Visão geral

| #   | Onde                    | O quê                                          | Sem isso                                |
| --- | ----------------------- | ---------------------------------------------- | --------------------------------------- |
| 1   | Mercado Pago            | Conta da Vez, aplicação, credenciais, webhook  | nada é cobrado                          |
| 2   | Supabase (produção)     | Migrations, secrets, Vault, deploy das funções | nada é cobrado                          |
| 3   | Mercado Pago (teste)    | Roteiro com usuários de teste                  | você descobre os erros com cliente real |
| 4   | Provedor de e-mail      | Avisos de fatura e de atraso                   | a loja é suspensa sem ter sido avisada  |
| 5   | Painel admin do Vez     | Preço da mensalidade, cota, carência           | nenhuma fatura nasce                    |
| 6   | Expo / EAS              | Build nova dos dois apps                       | o app publicado não tem a tela de pagar |
| 7   | App Store e Google Play | Notas de revisão e formulários de dados        | risco de rejeição                       |
| 8   | Contador                | Nota fiscal e enquadramento                    | risco fiscal                            |
| 9   | Jurídico                | Revisão de termos e privacidade                | texto escrito por engenheiro            |
| 10  | Cada loja               | Conectar a conta de recebimento                | aquela loja segue recebendo no balcão   |

Os itens 1 a 3 são o caminho crítico. O resto pode andar em paralelo.

---

## 1. Mercado Pago — a conta da Vez

**Conta.** Use uma conta Mercado Pago **da empresa (CNPJ)**, não a sua pessoal.
É nela que caem a mensalidade das lojas e a taxa retida em cada pagamento. Conta
de pessoa física funciona para testar, mas mistura o dinheiro da Vez com o seu e
complica a nota fiscal.

**Aplicação.** No painel de desenvolvedores do Mercado Pago, crie uma aplicação:

- tipo de solução: **pagamentos online**, com **Checkout Transparente** (API de
  pagamentos) e **Checkout Pro**; modelo **marketplace** — é o que libera o
  split (`application_fee` / `marketplace_fee`) e o OAuth das lojas;
- anote, da aplicação, os valores de **produção** e os de **teste**:

| Valor no painel                    | Vai para o secret            |
| ---------------------------------- | ---------------------------- |
| Access Token                       | `MERCADOPAGO_ACCESS_TOKEN`   |
| Client ID                          | `MERCADOPAGO_CLIENT_ID`      |
| Client Secret                      | `MERCADOPAGO_CLIENT_SECRET`  |
| Assinatura secreta (tela Webhooks) | `MERCADOPAGO_WEBHOOK_SECRET` |

**URL de redirecionamento (OAuth).** Na aplicação, cadastre:

```
https://<ref-do-projeto>.supabase.co/functions/v1/payment-connect
```

Tem que ser idêntica, caractere por caractere. É para onde o Mercado Pago
devolve o dono da loja depois de autorizar a conexão.

**Webhook.** Na aplicação, em Webhooks, modo produção:

```
https://<ref-do-projeto>.supabase.co/functions/v1/payment-webhook?provider=mercadopago
```

Evento: **Pagamentos**. Copie a assinatura secreta que a tela gera.

**Conferir na conta, antes de produção:**

- [ ] A tarifa de **Pix** para pagamentos online da sua conta. O ADR assumiu
      0,99%; contas novas e antigas às vezes têm condições diferentes.
- [ ] A tarifa de **cartão** e o **prazo de liberação** escolhido (receber na
      hora custa mais do que em 14 ou 30 dias). Essa escolha é de **cada loja**,
      na conta dela — vale avisar no onboarding.
- [ ] Que a aplicação aceita `application_fee` em pagamento criado com o token
      de outra conta. Se o painel pedir aprovação para marketplace, peça agora:
      pode levar dias.

---

## 2. Supabase — produção

Na ordem:

```bash
# 1. banco
supabase db push

# 2. secrets das funções
supabase secrets set \
  PAYMENT_PROVIDER=mercadopago \
  MERCADOPAGO_ACCESS_TOKEN=... \
  MERCADOPAGO_CLIENT_ID=... \
  MERCADOPAGO_CLIENT_SECRET=... \
  MERCADOPAGO_WEBHOOK_SECRET=... \
  PAYMENTS_STATE_SECRET=$(openssl rand -hex 32) \
  PAYMENTS_RECONCILE_SECRET=<gere com openssl rand -hex 32 e guarde> \
  PORTAL_URL=https://<domínio do portal> \
  CUSTOMER_APP_RETURN_URL=vezcliente://reserva/

# 3. funções
supabase functions deploy payment-create payment-webhook payment-reconcile \
  payment-connect billing-invoice-pay
```

**4. Vault** (SQL Editor do projeto). Sem estes dois, estorno e conciliação não
rodam — fica marcado no banco e não sai:

```sql
select vault.create_secret(
  'https://<ref-do-projeto>.supabase.co/functions/v1/payment-reconcile',
  'payments_reconcile_url');
select vault.create_secret('<o mesmo PAYMENTS_RECONCILE_SECRET>', 'payments_reconcile_secret');
```

**5. Conferir:**

```sql
-- deve dizer 'idle' (ou 'kicked'); 'unconfigured' = faltou o passo 4
select public.payment_reconcile_kick();

-- os três agendamentos novos
select jobname, schedule from cron.job
where jobname in ('payments-reconcile', 'billing-generate-invoices', 'billing-enforce');
```

- [ ] `PORTAL_URL` é o domínio real do portal (é para lá que o dono volta depois
      de conectar a conta).
- [ ] As três funções com `verify_jwt = false` (`payment-webhook`,
      `payment-reconcile`, `payment-connect`) foram publicadas assim — o deploy
      lê do `config.toml`.

---

## 3. Mercado Pago — roteiro de teste

Nenhuma chamada real ao Mercado Pago foi feita ainda: os testes do repositório
usam um provedor roteirizado. Antes de produção, rode o roteiro abaixo com
**credenciais de teste** e **usuários de teste** (crie dois no painel: um
vendedor e um comprador — o comprador não pode ser a mesma conta do vendedor).

Num projeto Supabase de homologação (ou no local, com um túnel para o webhook):

- [ ] **Conectar.** Portal → Plano e assinatura → Conectar conta, logando no
      Mercado Pago com o **vendedor de teste**. Volta para o portal com "Conta
      Mercado Pago conectada".
- [ ] **Pix do sinal.** No app do cliente, reservar numa loja com sinal e gerar
      o Pix. Pagar com o comprador de teste. A tela muda para "Pagamento
      confirmado" sozinha.
- [ ] **Split.** Na conta do vendedor de teste, o pagamento aparece com a
      comissão da aplicação descontada; na conta da Vez, a taxa aparece.
- [ ] **Cartão.** Mesma reserva em outra loja, escolhendo Cartão. A página do
      Mercado Pago abre, paga com cartão de teste, e o app volta para a reserva
      mostrando pago. **Teste em aparelho de verdade, iOS e Android** — o
      retorno da página para o app é o ponto mais frágil.
- [ ] **Cartão recusado.** Com o cartão de teste de recusa: a página deixa
      tentar outro, e a reserva não fica "falhou".
- [ ] **Estorno.** Cancelar pela loja uma reserva paga. Em até 2 minutos o
      pagamento aparece como devolvido, e o dinheiro volta ao comprador.
- [ ] **Pix vencido.** Gerar um Pix e não pagar; depois de 30 minutos o app
      oferece gerar outro.
- [ ] **Mensalidade.** No SQL Editor, `select public.billing_generate_invoices();`
      com uma loja em plano de mensalidade ativa desde o mês anterior. A fatura
      aparece no portal; pagar com Pix; fica "paga".
- [ ] **Webhook.** Nenhum aviso com erro: a consulta abaixo não traz `error`.

```sql
select provider, error, processed_at from payment_webhook_events
order by received_at desc limit 10;
```

Só depois troque os secrets para as credenciais de produção.

---

## 4. Provedor de e-mail e push

Os avisos de fatura (nova, 3 dias de atraso, 7 dias, suspensão, reativação) saem
pela mesma caixa de saída das outras notificações. Se o e-mail transacional
ainda não estiver configurado (`EMAIL_PROVIDER`, `EMAIL_FROM`, chave do Resend ou
Postmark — ver [notificacoes.md](notificacoes.md)), **a régua de cobrança roda
muda**: a loja é suspensa sem nunca ter recebido um aviso.

- [ ] E-mail transacional configurado e com domínio verificado **antes** de a
      primeira fatura vencer.

---

## 5. Painel admin do Vez

A fatura só nasce para loja **ativa**, em **plano de mensalidade**, numa cidade
com **preço definido**.

- [ ] Em Cidades: preço da mensalidade e cota de cada cidade.
- [ ] Em Configurações: carência da inadimplência (padrão 15 dias). É o prazo
      entre o vencimento e a suspensão automática.
- [ ] Em Planos: percentual da comissão. É o que vira taxa retida em cada
      pagamento pelo app das lojas no plano de comissão.
- [ ] Decidir se as lojas que já estão no ar entram cobrando no próximo dia 1º
      ou se ganham desconto de 100% por um período (o admin aplica desconto por
      loja; desconto de 100% não gera fatura).

---

## 6. Expo / EAS — builds novas

O app do cliente ganhou duas dependências nativas (`expo-clipboard`,
`expo-web-browser`). **A versão publicada hoje não tem a tela de pagamento**, e
atualização over-the-air não resolve: precisa de build.

- [ ] `eas build` do app do cliente (iOS e Android) e nova submissão.
- [ ] O app do estabelecimento só mudou texto e uma leitura a mais; pode ir por
      atualização OTA ou junto na próxima build.
- [ ] Conferir que o esquema `vezcliente://` continua registrado na build (é por
      ele que a página de cartão devolve o cliente ao app).

---

## 7. App Store e Google Play

**Não há compra dentro do app (IAP) — e isso é o correto.** O que o cliente paga
é um serviço físico prestado fora do app, e as duas lojas mandam usar outro meio
de pagamento nesse caso (App Store, regra 3.1.3(e); Google Play, política de
Pagamentos). Para evitar idas e vindas na revisão:

- [ ] **Notas para o revisor (as duas lojas), app do cliente:** "O app agenda
      serviços presenciais (barbearia, salão, clínica). O pagamento é de um
      serviço físico consumido fora do app, feito por Pix ou cartão via Mercado
      Pago, conforme a regra 3.1.3(e). Não há conteúdo ou recurso digital à
      venda." Inclua uma conta de teste e uma loja de demonstração.
- [ ] **App do estabelecimento:** ele não vende nada. A tela de assinatura só
      informa que a mensalidade é administrada no portal web — sem botão, sem
      link e sem preço. Não acrescente nenhum dos três sem rever a decisão 0009:
      vender a assinatura dentro do app obriga a usar a compra da loja, com 15%
      a 30% de comissão.
- [ ] **Privacidade (App Store Connect):** declarar que dados de pagamento são
      coletados por terceiro (Mercado Pago) e que o app coleta histórico de
      compras ligado à conta.
- [ ] **Segurança dos dados (Google Play Console):** o mesmo — "informações
      financeiras: histórico de compras", processadas por terceiro; número de
      cartão não é coletado pelo app.

---

## 8. Contador

O código não emite nota fiscal, de propósito: isso depende de enquadramento. O
que levar para a conversa:

- **Receita da Vez são duas coisas:** a mensalidade (fatura mensal, paga por Pix
  na conta da Vez) e a taxa retida em cada pagamento pelo app (cai na conta da
  Vez no Mercado Pago). O valor do serviço **não** passa pela Vez: vai direto
  para a conta da loja.
- [ ] Qual o código de serviço e o município para a **NFS-e** de cada uma, e se
      a da comissão pode ser **uma nota mensal por loja** (o painel admin já
      soma a taxa retida por loja e por mês, em Financeiro → Repasses, com
      exportação CSV).
- [ ] Se o split feito pelo provedor sustenta a tese de que só a taxa é receita
      da Vez (é a premissa da decisão 0009).
- [ ] Como tratar estorno: a taxa retida é devolvida proporcionalmente.
- [ ] Automatizar a nota depois: quando houver volume, um emissor por API entra
      como um passo a mais no pagamento da fatura.

---

## 9. Jurídico

Os Termos (seção 4) e a Política de Privacidade (seção 2) do site foram
atualizados para dizer que o Mercado Pago processa os pagamentos, que o Vez não
guarda cartão, e que fatura em atraso suspende a loja. **Foi escrito para ser
verdadeiro, não para ser definitivo.**

- [ ] Revisão por advogado, principalmente: política de reembolso do sinal,
      suspensão por inadimplência e responsabilidade por chargeback (no modelo
      atual, a contestação recai sobre a loja, que é quem recebe).
- [ ] Contrato ou termo de adesão das lojas mencionando a mensalidade, a
      carência e a taxa do plano de comissão.

---

## 10. Cada loja — onboarding

O que pedir ao dono, em três passos (dá para mandar assim):

1. **Tenha uma conta Mercado Pago da loja.** Se já recebe por Mercado Pago, é
   essa. Confira nela o prazo de liberação do cartão: receber na hora custa
   mais do que em 14 ou 30 dias.
2. **No portal do Vez**, em Plano e assinatura, toque em **Conectar conta** e
   autorize. Leva um minuto.
3. **Em Configurações**, decida: exigir sinal (e quanto), e se o sinal volta
   quando o cliente cancela no prazo.

A partir daí o cliente paga pelo app, por Pix ou cartão, e o dinheiro cai na
conta da loja. A conexão vale por cerca de seis meses e se renova sozinha.

---

## Checklist de entrada em produção

- [ ] Itens 1 e 2 feitos com credenciais de **produção**.
- [ ] Roteiro do item 3 passou inteiro em homologação.
- [ ] `select public.payment_reconcile_kick();` não diz `unconfigured`.
- [ ] E-mail transacional funcionando (item 4).
- [ ] Preço por cidade e carência definidos (item 5).
- [ ] Build nova do app do cliente aprovada nas duas lojas (itens 6 e 7).
- [ ] Um pagamento real de valor baixo, feito por você numa loja de verdade,
      conferido nas duas contas do Mercado Pago e estornado.

## Se um dia quiser Apple Pay e Google Pay

Não entraram, pelos motivos do item 4 da [decisão 0009](decisions/0009-pagamentos.md).
Quando o volume de cartão justificar, o que seria preciso, fora do código:

- trocar ou acrescentar um provedor que aceite as carteiras (Pagar.me ou
  Stripe), com a conta da Vez e a reconexão de **cada loja** nele;
- **Apple:** Merchant ID e certificado de processamento de pagamento no Apple
  Developer, e a capacidade Apple Pay na build;
- **Google:** cadastro no Google Pay & Wallet Console e aprovação do app;
- build nova com o SDK nativo do provedor.

No código, é um adaptador (`_shared/payments/<provedor>.ts`) e o método `wallet`
na tela de pagamento; o resto — webhook, conciliação, estorno, extrato — não
muda.
