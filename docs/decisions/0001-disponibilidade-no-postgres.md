# 0001 — O cálculo de disponibilidade vive no Postgres

**Status:** aceito
**Data:** 2026-09-01

## Contexto

Três superfícies precisam saber quais horários estão livres: o portal web do
estabelecimento, o app do cliente final e o app do estabelecimento.

O cálculo não é trivial. Ele combina jornada de trabalho, duração do serviço,
intervalos, bloqueios pontuais, folgas, agendamentos já confirmados e a fila por
ordem de chegada. Vai mudar com frequência conforme o produto amadurece.

## Decisão

O cálculo é **uma função no Postgres**, chamada via RPC pelas cinco superfícies.
Não é reimplementado em TypeScript em lugar nenhum.

## Por quê

Se cada superfície calculasse por conta própria, bastaria uma divergência de uma
linha para o portal oferecer um horário que o app acabou de vender. O sintoma
chega como cliente na porta sem vaga — e o diagnóstico é caro, porque as duas
implementações parecem certas quando lidas separadamente.

Há três razões concretas para o banco ser o lugar:

1. **Uma resposta só.** Todo mundo chama a mesma função. Divergência entre
   superfícies deixa de ser uma classe de bug possível.
2. **Proximidade do dado.** O cálculo varre agendamentos e bloqueios. Fazer isso
   onde os dados estão evita puxar a agenda inteira pela rede para filtrar no
   cliente.
3. **Atomicidade.** A checagem de disponibilidade e a gravação do agendamento
   precisam acontecer sob a mesma transação e sob a mesma constraint de
   exclusão. Só o banco oferece isso.

## Consequências

- A função é o contrato. Mudança na assinatura é migration, e quebra as cinco
  superfícies ao mesmo tempo — o que é justamente o comportamento desejado.
- A garantia final contra overbooking não é a função de disponibilidade, e sim
  uma constraint de exclusão (`btree_gist`) sobre o intervalo de tempo do
  agendamento. A função evita oferecer; a constraint impede gravar. As duas
  coisas são necessárias: sem a constraint, duas requisições simultâneas passam
  as duas pela verificação.
- Teste de disponibilidade é teste de SQL, rodado contra o banco local.
- `btree_gist` ainda não está habilitada — entra junto com a tabela de
  agendamentos.

## Alternativa descartada

Calcular em TypeScript num pacote compartilhado (`packages/availability`)
consumido pelas cinco superfícies. Resolveria a divergência entre clientes, mas
não a atomicidade: continuaria sendo _ler, decidir, gravar_ em três passos, com
janela para corrida entre a leitura e a escrita. E os apps mobile só receberiam
a correção de uma regra depois de passar pela loja.
