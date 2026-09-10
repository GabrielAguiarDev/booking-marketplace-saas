# 0007 — Como a loja trabalha vira dado

**Data:** 3 de setembro de 2026
**Status:** aceita
**Migrations:** `20260903120000_establishment_settings.sql`,
`20260903140000_queue_arrival_position.sql`

## O problema

O app do estabelecimento tem três telas de ajuste — fila, regras de
agendamento, avisos — e nenhuma delas tinha onde gravar. Sem tabela, cada
interruptor seria estado de tela: ligado no aparelho de quem tocou, invisível
para o resto da equipe, perdido no próximo lançamento.

## A decisão

Duas tabelas, divididas por quem é dono da preferência:

| Tabela                      | Escopo                | Quem escreve     |
| --------------------------- | --------------------- | ---------------- |
| `establishment_settings`    | regra da casa         | dono ou gerência |
| `member_notification_prefs` | o que toca no celular | a própria pessoa |

A segunda existe separada porque quem atende em duas unidades quer o barulho de
uma e não da outra — e porque o dono da loja não decide o que toca no celular
do barbeiro.

### O que **não** ganhou coluna

Nada que já tinha. `booking_mode` continua sendo quem diz se a loja usa fila;
`deposit_percent`, `min_lead_minutes` e `cancellation_window_minutes` continuam
em `establishments`, porque `available_slots()` e a Edge Function de reserva já
os leem de lá. Duplicar qualquer um criaria duas verdades sobre a mesma
pergunta, e a divergência apareceria como "o app do cliente não obedece o que
eu configurei".

### A linha nasce com a loja

Um gatilho em `establishments` cria a linha de settings no insert, e a migration
preenche as lojas existentes. Sem isso, toda tela de ajuste precisaria tratar
"ainda não existe linha" — e a primeira que esquecesse gravaria nada em
silêncio.

### Leitura pública, de propósito

`establishment_settings` tem `select` para `anon`. Nada ali é segredo: é regra
de atendimento, que a loja quer que o cliente conheça. O app do cliente precisa
saber se dá para entrar na fila de longe antes de mostrar o botão.

## A confirmação de chegada mudou `queue_state()`

`queue_require_arrival` nasceu sem efeito nenhum: a função ordenava por
`joined_at` sem olhar `arrived_at`. Era o pior dos dois mundos — a loja ligava a
confirmação, e quem pegou senha do sofá de casa continuava na frente de quem
estava em pé no balcão.

A correção ficou no Postgres, e não na tela, pela decisão 0001. Se o app do
estabelecimento reordenasse por conta própria, o balcão diria "você é o
segundo" e o celular do cliente diria "primeiro" — os dois lendo o mesmo banco.

Com a confirmação desligada (o padrão) o resultado é byte a byte o de antes.
Ligada, quem não confirmou chegada recebe posição 0 e sai da soma de espera dos
outros — não faz sentido inflar a espera de quem está no balcão com gente que
talvez nem venha.

## O que fica gravado e ainda não atua

Cinco ajustes da fila, dois das regras e os quatro de notificação são gravados e
nenhuma superfície os lê ainda: fila por profissional, fechar quando encher,
pular quem não responde, canal de aviso, QR no balcão, sinal reembolsável e
pagamento pelo app.

Eles aparecem na tela **marcados como "ainda não atua"**, e essa marcação é a
parte importante da decisão. Um interruptor que grava e não faz nada é pior que
interruptor nenhum: o dono liga "fechar a fila quando encher", vai cuidar da
vida, e a fila enche.

A alternativa — escondê-los até funcionarem — foi descartada porque a tela ficaria
mais limpa e menos verdadeira, e porque a preferência declarada hoje é o que
liga a peça certa quando ela chegar.
