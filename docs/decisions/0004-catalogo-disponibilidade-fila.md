# 0004 — Catálogo, disponibilidade, reservas, fila e avaliações

Data: 2026-09-02 · Status: aceito · Afeta: `supabase/`, `apps/mobile-cliente`

## Contexto

As fases 2 a 7 do [roadmap](../roadmap-mobile-cliente.md) dependiam de quatro
perguntas em aberto. Três tinham resposta técnica defensável; a quarta não.

## Decisões

### 1. Acento da loja: herda da categoria, com override

`establishments.accent_color` é nulo por padrão e a cor vem da categoria
(`src/data/catalog.ts`). Obrigar todo dono de barbearia a escolher um
hexadecimal para publicar troca um problema de design por um de cadastro. A
coluna existe para a rede que tem marca própria — as duas lojas de demonstração
usam override justamente para provar que o caminho funciona.

### 2. Cancelamento: janela configurável por loja, padrão 2 h

`establishments.cancellation_window_minutes`. Cancelar **sempre é permitido** —
o que a janela decide é se foi dentro do prazo. A Edge Function devolve
`within_free_window`, e o app diz "a loja pode cobrar pelo horário" quando for
fora. Bloquear o cancelamento produziria não comparecimento em vez de horário
liberado, que é o pior resultado para os dois lados.

### 3. Fila e hora marcada convivem: `booking_mode` na loja

`scheduled` | `queue` | `both`. O brief previa os dois modelos e existe casa que
roda os dois no mesmo dia (corte por chegada, barba com hora). A política de RLS
de `queue_entries` recusa entrada em loja `scheduled`, e a Edge Function de
reserva recusa agendamento em loja `queue` — a regra vive no banco, não na tela.

### 4. Posição na fila é derivada, nunca coluna

`queue_state()` calcula a posição por ordem de `joined_at`. Uma coluna
`position` exigiria reescrever N linhas a cada chamada e corromperia sob
concorrência. A estimativa de espera é função pelo mesmo motivo da decisão 0001:
o balcão e o telefone precisam dizer o mesmo número.

### 5. Pagamento: **só o esquema**, e nada de tela

Esta é a que ficou em aberto. Escolher provedor e definir quem recebe — a
plataforma repassando ou o estabelecimento direto — muda o modelo tributário
inteiro. A migration `20260902170000_payments.sql` cria as tabelas e
**nenhuma política de escrita**: dinheiro só se move por Edge Function.

A tela de confirmação **não mostra formas de pagamento**. Exibir PIX e cartão que
não cobram nada seria pior do que não exibir: o usuário sairia achando que pagou.

## O que sustenta a corretude

**A constraint de exclusão, não a função.** `available_slots()` diz o que estava
livre no instante da pergunta. Entre a pergunta e a escrita, outra pessoa pode
comprar o mesmo horário. Quem resolve é `appointments_no_overlap`
(`exclude using gist`), e a Edge Function apenas traduz o `23P01` em "alguém
acabou de reservar esse horário".

Verificado: duas reservas na mesma faixa do mesmo profissional → a segunda é
recusada pelo banco.

## Uma consequência de leitura

`free_count = 0` tem duas causas que o usuário lê de formas opostas: lotado, ou
fechado. Por isso `availability_summary()` devolve `is_open` — uma fita de dias
que escreve "CHEIO" no domingo de uma barbearia que fecha aos domingos está
mentindo com número correto.
