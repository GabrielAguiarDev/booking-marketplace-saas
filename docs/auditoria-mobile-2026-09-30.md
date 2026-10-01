# Auditoria mobile — 30/09/2026

Frente mobile da [finalização](finalizacao-2026-09-30.md): `apps/mobile-cliente`,
`apps/mobile-staff` e `packages/mobile-kit`.

Este documento tem duas partes. A primeira — **Achados** — foi escrita lendo o
código, antes de qualquer alteração. A segunda — **Resolução** — registra o que
mudou, o que foi verificado e o que continua em aberto.

## Como a auditoria foi feita

- Leitura de todas as telas das abas e dos fluxos de reserva, fila, conta,
  ajuda e autenticação do app do cliente; das cinco abas, do detalhe do
  agendamento e dos componentes base do app do estabelecimento; e do kit inteiro.
- Leitura da Edge Function `assistant` e da migration `20260902180000_assistant.sql`
  para saber o que o histórico e a cota permitem **sem** mudar contrato.
- Contagem mecânica de acessibilidade (`grep` em `app/` e `src/`).
- Baseline antes de mexer: `typecheck` e `lint` limpos nos três pacotes;
  **61 testes** (kit 9, cliente 38, estabelecimento 14), zero falhas.

O que **não** foi feito na auditoria: rodar em aparelho físico, medir com
VoiceOver/TalkBack reais, testar push. Onde uma conclusão depende disso, está
dito.

## Achados

Prioridade: **Alta** quebra um fluxo, perde dado do usuário ou causa ação
errada; **Média** atrapalha ou exclui alguém; **Baixa** é acabamento.

### App do cliente

| #   | Prioridade | Lacuna                                                                                                                                                                                                                                                                                                       | Evidência                                                           |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| C1  | Alta       | **Assistente sem histórico.** A conversa vive em `useState`: trocar de aba e voltar mantém, fechar o app perde tudo. O banco já guarda conversas e mensagens (com cartões) e a RLS já deixa o dono ler e apagar — a tela nunca lê.                                                                           | `app/(tabs)/assistente.tsx`; `assistant_*_select_own`, `delete_own` |
| C2  | Alta       | **Erro do assistente perde a pergunta.** O campo é limpo antes da resposta; na falha o balão do usuário fica na tela como se tivesse sido enviado, não há "tentar de novo" e o texto precisa ser redigitado. O servidor não grava pergunta sem resposta, então a tela e o banco divergem.                    | `enviar()` em `assistente.tsx`                                      |
| C3  | Alta       | **Os estados de erro do assistente são um só.** Não configurado, sem crédito, indisponível, cota do dia, sessão expirada e sem internet viram o mesmo cartão vermelho. Só um deles se resolve tentando de novo, e a tela não diz qual.                                                                       | `ask()` devolve `code`, a tela ignora                               |
| C4  | Alta       | **Cota invisível até estourar.** "20 HOJE" em mono 9px é o único sinal. Ao chegar a zero o campo continua ativo: a pessoa digita, envia e só então descobre. Depois do erro `daily_limit_reached` o contador não vai a zero.                                                                                 | cabeçalho de `assistente.tsx`                                       |
| C5  | Alta       | **Horário sugerido sem dizer de onde.** O cartão de horário mostra só "16:00 · QUI 04". Se a resposta consultou duas lojas, os horários se misturam e a chave React (`slot_start`) colide.                                                                                                                   | `message.cards` em `assistente.tsx`                                 |
| C6  | Alta       | **Confirmar pisca "reserva incompleta".** `/pagamento` trata `shop === null` como reserva inválida, mas é nulo enquanto carrega. Vindo do assistente (loja ainda não em tela) o usuário vê o erro antes do resumo.                                                                                           | `app/pagamento.tsx`                                                 |
| C7  | Alta       | **Rodapé fixo ignora a área segura.** As cinco telas com `StickyFooter` passam `bottomInset={0}`: em iPhone sem botão o CTA encosta na barra de início.                                                                                                                                                      | `horario`, `pagamento`, `loja/[id]`, `avaliacao`, `remarcar`        |
| C8  | Alta       | **Reservar não confirma nada.** Depois de "Confirmar reserva" o app troca para a Agenda sem nenhuma mensagem, e usa `replace`: loja e horário continuam empilhados por baixo — voltar por gesto devolve um fluxo já concluído. O helper `useGoToTab` existe para isso e não é usado aqui.                    | `confirmar()` em `pagamento.tsx`                                    |
| C9  | Alta       | **Fila: sair é um toque, e falha em silêncio.** "Sair da fila" perde o lugar sem confirmação; `leaveQueue`/`confirmArrival` devolvem `false` e a tela ignora. Os dois botões dividem o mesmo `busy` e mudam de rótulo juntos. "Na sua frente" lista a fila inteira, inclusive quem está atrás.               | `app/fila.tsx`                                                      |
| C10 | Média      | **Acessibilidade.** 45 `Pressable`, 15 com `accessibilityRole`, 8 com rótulo. Voltar é o caractere "‹" sem nome; botões não anunciam desabilitado/ocupado; abas, segmentos, dias, horários e estrelas não anunciam seleção; vários alvos ficam abaixo de 44 pt (voltar da loja 38, "AGENDAR" ~30 de altura). | contagem por `grep`                                                 |
| C11 | Média      | **Sem preferência de movimento reduzido.** `PulseDot` e `Shimmer` rodam em laço infinito sem consultar o sistema.                                                                                                                                                                                            | `src/ui/primitives.tsx`                                             |
| C12 | Média      | **Avaliação nasce com 5 estrelas.** A nota máxima vem marcada; enviar sem pensar grava 5. E a tela mostra "Não encontramos esse atendimento" enquanto a agenda ainda carrega.                                                                                                                                | `app/avaliacao.tsx`                                                 |
| C13 | Média      | **Sem puxar para atualizar.** Home, Agenda e resultados só recarregam ao ganhar foco. O gesto mais conhecido de lista não existe.                                                                                                                                                                            | nenhum `RefreshControl` no app                                      |
| C14 | Média      | **Anel com número inventado (R7).** O selo "NA VEZ" da loja desenha um anel fixo em 72%, e o anel da "Agenda de hoje" usa `livres × 7`, que não é proporção de nada.                                                                                                                                         | `app/loja/[id].tsx`                                                 |
| C15 | Baixa      | **`vzrise` pendente.** A animação de entrada do canvas nunca foi implementada (já listada em `proximos-passos.md`).                                                                                                                                                                                          | `docs/mobile-cliente.md`                                            |
| C16 | Baixa      | **"EM BREVE" em categoria vazia** promete uma loja que ninguém garantiu.                                                                                                                                                                                                                                     | `app/(tabs)/explorar.tsx`                                           |
| C17 | Baixa      | **Envio pelo teclado não funciona no assistente.** `onSubmitEditing` num `TextInput` multilinha não dispara; o deslocamento do teclado é um número fixo (90).                                                                                                                                                | `assistente.tsx`                                                    |

### App do estabelecimento

| #   | Prioridade | Lacuna                                                                                                                                                                                                                                                      | Evidência                            |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| S1  | Alta       | **Conta sem loja não consegue sair.** O portão mostra "esta conta não é equipe de nenhuma loja" e um link para o portal; não há "sair". Quem entrou com o e-mail errado só resolve reinstalando. O estado de erro do mesmo portão não tem "tentar de novo". | `src/auth/AuthGate.tsx`              |
| S2  | Alta       | **Toque duplo chama duas pessoas.** O próprio comentário do `Toast` avisa do risco, mas `act()` não trava nada: "Chamar próximo", "Sentou", "Chegou" e "Concluir" aceitam um segundo toque enquanto o primeiro ainda está indo.                             | `app/(tabs)/fila.tsx`, `index.tsx`   |
| S3  | Alta       | **"Recusar" em Hoje é um toque, com motivo genérico.** O detalhe do agendamento pede o motivo numa folha; o cartão de Hoje recusa direto com "Recusado pela loja" e o cliente é avisado na hora.                                                            | `decide()` em `app/(tabs)/index.tsx` |
| S4  | Alta       | **Marcar ausência é um toque num alvo de 26×20.** O "×" tira a pessoa da fila, não tem rótulo, fica colado na seta de subir e não pede confirmação nem oferece desfazer.                                                                                    | `QueueLine` em `fila.tsx`            |
| S5  | Média      | **Acessibilidade quase ausente.** 55 `Pressable`, 5 com papel, 3 com rótulo, nenhum com estado. O interruptor (16 usos) não é anunciado como interruptor; a aba central é lida como "3 NA FILA FILA"; botões só de ícone (×, ↑, +) não têm nome.            | contagem por `grep`                  |
| S6  | Média      | **Toast não é anunciado e ignora a área segura.** Sem região viva, quem usa leitor de tela não sabe se a ação deu certo. `bottom: 104` fixo, sem entrada nem saída.                                                                                         | `src/ui/Toast.tsx`                   |
| S7  | Média      | **Faturamento "0" enquanto carrega (R7).** O cabeçalho de Hoje mostra `R$ 0` antes de a consulta voltar e também se ela falhar.                                                                                                                             | `TodayHeader` em `index.tsx`         |
| S8  | Média      | **Sem movimento reduzido.** `PulseDot` em laço e o interruptor animado não consultam o sistema.                                                                                                                                                             | `src/ui/primitives.tsx`              |
| S9  | Baixa      | **Carregando em branco.** O detalhe do agendamento mostra só o cabeçalho enquanto busca.                                                                                                                                                                    | `app/agendamento/[id].tsx`           |
| S10 | Baixa      | **Sem puxar para atualizar** em Hoje e Agenda (a fila já é ao vivo).                                                                                                                                                                                        | nenhum `RefreshControl`              |

### `mobile-kit`

| #   | Prioridade | Lacuna                                                                                                                                                                     |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Média      | Não há um lugar comum para a preferência de movimento reduzido; cada app precisaria reimplementar a leitura de `AccessibilityInfo`. É lógica neutra de design — cabe aqui. |
| K2  | Baixa      | O README lista quatro entradas; o pacote exporta seis (`push` e `push/rules` não aparecem).                                                                                |

### Fora do meu alcance — repassado

- **Dia da cota diverge do dia do usuário.** A Edge Function e
  `assistant_usage_today()` cortam o dia em UTC; para quem está em Brasília a
  cota renova às 21h, e a mensagem diz "Amanhã tem mais". É contrato do backend.
- **Cartão de horário sem nome de loja e serviço.** O app consegue o nome da
  loja pelos cartões da própria conversa; o do serviço só existe no servidor.
  Pedido ao backend: incluir `establishment_name` e `service_name` (opcionais)
  no cartão `slot`. O app lê os dois se vierem e funciona sem eles.

## Ordem de execução

1. Assistente: histórico, erros, cota, contexto dos horários (C1–C5, C17).
2. Reserva e fila: C6–C9, e S1–S4 no app da loja.
3. Acessibilidade e movimento nos componentes base dos dois apps (C10, C11,
   S5, S6, S8, K1) — corrigir a base cobre a maior parte das telas de uma vez.
4. Acabamento: C12–C16, S7, S9, S10, K2.

## Achados durante a implementação

Estes não estavam na lista acima: apareceram ao mexer no código ou ao rodar os
apps. Ficam separados para não reescrever o que foi diagnosticado antes.

| #   | Prioridade | Lacuna                                                                                                                                                                                                                                                                                                                             | Como apareceu                           |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| C18 | Alta       | **Tela caía para quem estava logado.** `useMyQueueEntry` abria o canal Realtime `"my-queue"` em cada tela que o usava (Home, Agenda, Loja, Fila). `supabase.channel(nome)` devolve o canal já existente; a segunda tela chamava `.on()` num canal já inscrito, o que lança erro. Abrir uma loja a partir da Home derrubava a tela. | validação visual: erro ao abrir a loja  |
| C19 | Alta       | **Fila mostrava "0" e "quase na sua vez" para quem ainda não contava.** `queue_state` devolve posição 0 para quem não confirmou chegada (em loja que exige) e para quem já foi chamado. A tela tratava 0 como posição.                                                                                                             | leitura de `queue_state` ao corrigir C9 |
| C20 | Alta       | **Horário perdido apagava o próprio motivo.** Em `slot_taken`, a tela limpava o horário do rascunho, caía no ramo "reserva incompleta" e a mensagem "alguém acabou de reservar" nunca era lida.                                                                                                                                    | ao corrigir C6                          |
| C21 | Média      | **"AGENDADO" para pedido ainda não aceito.** Com aprovação manual a reserva nasce `scheduled` e espera o sim da loja; a Agenda dizia "AGENDADO", que se lê como garantido.                                                                                                                                                         | validação visual do fluxo de reserva    |
| C22 | Média      | **Sugestão que o assistente não sabe responder.** "Qual barbearia tem fila agora?" — as ferramentas dele só conhecem loja, serviço e horário.                                                                                                                                                                                      | leitura de `tools.ts`                   |
| C23 | Média      | **Contraste.** Placeholder dos campos em `#C9CBCE` sobre branco (≈1,6:1) e erro de campo em coral (≈3:1) em corpo 12,5.                                                                                                                                                                                                            | revisão dos componentes base            |
| S11 | Média      | **Botões do detalhe não travavam.** `busy` existia, mas só o botão "Aprovar" o lia; remarcar, concluir, falta e recusar aceitavam o segundo toque.                                                                                                                                                                                 | ao corrigir S2                          |

Repassado ao backend durante a execução (mensagens ao coordenador), além dos
dois itens da seção anterior:

- **Cota contornável apagando conversa (alta).** A contagem diária lê
  `assistant_messages`; `assistant_conversations_delete_own` com `on delete
cascade` apaga essas linhas e a cota volta a 20. Já era explorável por REST;
  a tela de histórico tem "apagar conversa" e torna isso um toque. O app não
  calcula cota: relê `assistant_usage_today()` depois de apagar, então passa a
  mostrar o número certo assim que o servidor contar de outro jeito.
- **Pergunta e resposta com o mesmo `created_at`.** São gravadas no mesmo
  insert; a leitura do histórico pela função não tinha desempate. No app o
  desempate é por papel (pergunta antes da resposta).

## Resolução

### O que mudou

**Assistente (C1–C5, C17, C22)** — `app/(tabs)/assistente.tsx`,
`src/data/assistant.ts`, `src/domain/assistant.ts`.

- **Histórico.** Botão "Conversas anteriores" abre uma folha com as 30 conversas
  mais recentes; tocar abre a conversa, com as lojas tocáveis. "Nova conversa"
  volta ao começo. Apagar pede um segundo toque na própria linha. Tudo pela RLS
  que já existia — **nenhuma mudança em Edge Function, migration ou contrato**.
- **Horário antigo não é oferta.** Numa conversa reaberta, os horários não
  viram botão: a tela diz quando foram consultados e manda perguntar de novo.
  Disponibilidade continua vindo só do Postgres (R1).
- **Erros.** A pergunta só vira mensagem quando a resposta chega. Na falha ela
  fica marcada "NÃO ENVIADA" e o cartão diz qual das seis situações é (sem
  conexão, cota, não configurado, sem crédito, indisponível, sessão) e oferece
  só o que resolve: "Tentar de novo" nas duas em que tentar adianta, "Entrar"
  ou "Explorar lojas" nas outras, e sempre "Editar pergunta", que devolve o
  texto ao campo.
- **Cota.** "RESTAM N DE 20 HOJE" acima do campo, em âmbar a partir de 3; em
  zero o campo sai e entra a explicação. Recusa por cota zera o contador da
  tela. Número desconhecido não aparece como zero.
- **Contexto dos horários.** Agrupados por loja e serviço, com o nome da loja
  (do cartão, ou do que a conversa já mostrou).
- O `onSubmitEditing` morto saiu. **O deslocamento fixo do teclado (90) ficou
  como estava** — ver limitações.

**Reserva e fila (C6–C9, C18–C21).**

- `StickyFooter` soma a área segura sozinho (cinco telas).
- Confirmar: estados de carregando e de erro antes de "incompleta"; horário
  perdido mantém a mensagem e oferece "Escolher outro horário"; sucesso
  desempilha o fluxo e a Agenda diz "Reserva confirmada" ou "Pedido enviado",
  conforme o status que o servidor devolveu.
- Fila do cliente: confirmação para sair, erro visível, um estado ocupado por
  ação, "na sua frente" só com quem está na frente, e quatro fases com frase
  própria (esperando, a caminho, chamado, em atendimento).
- Canal Realtime com nome próprio por tela (`useId`).

**App do estabelecimento (S1–S11).**

- Portão: "Sair e entrar com outra conta" (com o e-mail em uso) e "Tentar de
  novo" no erro.
- `useAction` (`src/ui/use-action.ts`): trava por `ref` contra o segundo toque
  em chamar, sentar, chegou, concluir, subir e aprovar. Botões do detalhe
  desabilitam enquanto a ação corre.
- "Recusar…" em Hoje abre o detalhe já na folha de motivos.
- Ausência pede confirmação numa folha; alvos de subir/ausente maiores.
- Toast anunciado ao leitor de tela, acima da área segura; erro fica mais tempo.
- Faturamento mostra "—" até a consulta voltar.
- Detalhe do agendamento: indicador de carregando e erro com "tentar de novo".
- Puxar para atualizar em Hoje e Agenda.

**Acessibilidade e movimento (C10–C12, C23, S5, S6, S8, K1).**

- Papel, nome e estado nos componentes base dos dois apps: botões (inclusive
  desabilitado), abas e segmentos (selecionado), interruptor (`switch` com
  rótulo), chips, estrelas (grupo de rádio, alvo de 48), dias, horários,
  cartões de loja, botões só de ícone. "Voltar" virou botão com nome.
- Rótulo nos campos de texto; erro de campo e placeholder com contraste maior.
- `@vez/mobile-kit/motion` → `useReducedMotion`. Com a preferência ligada:
  ponto que pulsa fica parado, esqueleto não varre, interruptor não desliza,
  folha troca deslizar por esmaecer, e a entrada de tela não acontece.
- `vzrise` (C15): entrada de tela em `Screen` — sobe 10 pt em 240 ms.
- Avaliação começa sem nota e só envia com uma escolhida.

**Acabamento (C13, C14, C16, K2).** Puxar para atualizar em Home, Agenda e
resultados; anéis da loja deixam de desenhar proporção inventada; "EM BREVE"
virou "NENHUMA AINDA"; README do kit lista as sete entradas.

**Kit.** `useAsync().reload()` devolve uma promessa que resolve quando a busca
termina (é o que segura o indicador de puxar-para-atualizar). A fila de espera
vive em `src/waiters.ts`, pura e testada.

### O que foi verificado

| Verificação                             | Resultado                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck` nos três pacotes            | limpo                                                                                                                                                     |
| `lint` nos três pacotes                 | limpo                                                                                                                                                     |
| Testes                                  | **79** (kit 12, cliente 53, estabelecimento 14), 0 falhas — eram 61                                                                                       |
| Assistente contra a Edge Function local | resposta real `assistant_out_of_credit` → cartão "fora do ar", pergunta "não enviada", "Editar pergunta" devolve o texto                                  |
| Histórico contra o banco local          | conversa de teste listada, aberta (pergunta antes da resposta, loja tocável, horário antigo sem botão), apagada pela tela e conferida no banco (0 linhas) |
| Reserva de ponta a ponta no web         | loja → horário → confirmar → Agenda com "Pedido enviado"; reserva de teste removida depois                                                                |
| Fila do cliente                         | posição 2, "na sua frente" só com a posição 1                                                                                                             |
| App do estabelecimento no web           | conta sem loja → sair → entrar como dono; Hoje e Fila com papéis e nomes na árvore de acessibilidade; folha de ausência abre com nome e aviso             |

A validação visual foi no navegador embutido do Orca (Expo web, portas 8081 e
8082), conferindo a árvore de acessibilidade e capturas de tela. Dados de teste
criados no banco local (uma conversa, uma reserva) foram removidos.

### Limitações reais

- **Nada foi testado em aparelho.** Web prova fluxo, texto e papéis; não prova
  área segura, teclado, VoiceOver/TalkBack, gesto de voltar nem o
  puxar-para-atualizar (o `RefreshControl` não existe no web). A preferência de
  movimento reduzido foi implementada e não exercitada.
- **Resposta bem-sucedida do assistente não foi vista ao vivo**: a conta da
  OpenAI local está sem crédito. O caminho de sucesso está coberto pelos testes
  de `parseCards`/`groupSlots` e pela conversa reaberta do histórico, não por
  uma resposta real do modelo.
- **`keyboardVerticalOffset={90}` no assistente** parece errado pela conta (a
  tela começa em y=0), mas sem aparelho não dá para saber se foi ajustado à
  mão. Não mexi.
- **Folhas da aba Fila no web**: abrem, mas não terminam de fechar — acontece
  igual com "Quem chegou?", que já existia. A hipótese é o redesenho a cada segundo desta tela reiniciando a animação do `Modal` do react-native-web (a folha do assistente, numa tela parada, fecha normalmente); não foi confirmada. O `Modal` nativo não passa
  por esse caminho; não confirmado em aparelho.
- **`Alert.alert` não faz nada no web**: cancelar reserva, apagar endereço e
  sair da fila só confirmam em iOS/Android.
- **Cabeçalho de seção** (`accessibilityRole="header"`) sai como nível 1 em
  todo lugar no web; no nativo não há nível.
- **Decisão de produto em aberto**: "Não compareceu" e "Concluir" no detalhe do
  agendamento continuam em um toque e não voltam atrás. O código documenta isso
  como escolha; agora travam o toque duplo, mas não pedem confirmação.
- **Contraste do coral e do verde em texto pequeno** (`ACEITA FILA`, links
  coral) continua abaixo de 4,5:1 em alguns rótulos: são cores de marca, e
  trocar é decisão de design.
- A cota contornável e o dia em UTC dependem do backend (acima).
