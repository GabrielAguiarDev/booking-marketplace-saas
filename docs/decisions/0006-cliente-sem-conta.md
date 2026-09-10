# 0006 — Cliente sem conta entra na fila e na agenda

**Data:** 3 de setembro de 2026
**Status:** aceita
**Migrations:** `20260903130000_walk_in_customers.sql`

## O problema

`queue_entries.customer_id` e `appointments.customer_id` eram `not null` e
apontavam para `profiles`. Na prática isso dizia: **para ser atendido, baixe o
app**.

Não é assim que uma barbearia funciona. O sujeito entra, pergunta se demora,
senta e espera. Quem digita o nome dele é o atendente, num caderno.

Enquanto o caderno existir em paralelo, o número que o app mostra é mentira.
O cliente que entrou pelo celular lê "você é o segundo" enquanto três pessoas
que o balcão anotou estão na frente dele. E o dono da loja, olhando a mesma
tela, vê uma fila que não é a fila da casa dele — então ele volta para o
caderno, e o produto vira decoração.

O mesmo vale para a agenda: cliente que liga é a maioria dos agendamentos de
uma barbearia de bairro.

## A decisão

`customer_id` passa a ser anulável nas duas tabelas, com o par
`guest_name`/`guest_phone` ao lado e uma constraint exigindo um dos dois:

```sql
check (customer_id is not null or nullif(btrim(guest_name), '') is not null)
```

Não é conta, não vira conta, não vê nada. É o caderno, dentro do banco,
contando posição junto com todo mundo.

### O que não mudou, e por que isso importa

As políticas de cliente comparam `customer_id = auth.uid()`. Com a coluna nula
a comparação dá `NULL`, que a RLS trata como falso — reserva de balcão fica
invisível para todo cliente do app, que é exatamente o desejado. **Nenhuma
política precisou ser reescrita para isso.**

O índice parcial `queue_entries_one_active_per_customer` também segue valendo:
em índice único o Postgres trata NULLs como distintos, então dois convidados
não colidem. Duas linhas para a mesma pessoa sem conta é o comportamento certo
— o balcão não tem como saber que é a mesma pessoa.

## Duas peças que vieram junto

### `queue_entries.source`

Enum `app | qr | counter`. A tela do estabelecimento mostra a origem em cada
linha, e a distinção é operacional: quem entrou pelo balcão está ali na frente
do atendente; quem entrou pelo app pode ainda estar vindo.

Sem a coluna, a tela teria que adivinhar pelo `guest_name` — e adivinharia
errado justamente no caso do cliente com conta que foi cadastrado no balcão.

A política de insert do cliente foi reescrita para aceitar só `app` e `qr`.
`counter` é da equipe. Sem isso a legenda seria decorativa.

### `profiles_select_establishment_customers`

`profiles_select_colleagues` cobre colega de trabalho; cliente não é colega.
Sem uma política nova, o app do estabelecimento mostraria a fila inteira sem
nomes, e "chamar o próximo" viraria chamar um UUID.

O alcance é o mínimo que resolve: só perfil de quem tem (ou teve) reserva ou
entrada de fila numa loja de quem está perguntando. Não é "equipe vê todo
mundo"; é "equipe vê quem procurou a loja dela".

## O que se perde

Reserva de balcão não recebe lembrete, confirmação nem aviso de recusa: não há
para onde mandar. As telas do app do estabelecimento dizem isso na hora de
criar e na hora de recusar — quem avisa é o atendente, pelo telefone.

Também não dá para avaliar: `reviews_insert_own` exige `customer_id =
auth.uid()`. Uma barbearia que atende só no balcão nunca acumula nota. É uma
consequência aceita: nota sem identidade é nota que qualquer um escreve.
