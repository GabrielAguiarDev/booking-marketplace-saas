# 0005 — Assistente com a API da OpenAI

Data: 2026-09-02 · Status: aceito · Afeta: `supabase/functions/assistant`, `apps/mobile-cliente`

## Decisão 1 — A chave vive na Edge Function, nunca no app

Não é preferência de arquitetura, é a única opção. Um `.ipa` ou `.apk` se abre
com um descompactador: qualquer variável embutida no bundle é pública, e
`EXPO_PUBLIC_*` então é literalmente pública por definição. Uma chave da OpenAI
vazada é uma fatura aberta na conta do projeto.

O app chama `supabase.functions.invoke("assistant")`. Não existe, e não deve
passar a existir, nenhum caminho do aplicativo direto para `api.openai.com`.

## Decisão 2 — O modelo não sabe nada; ele pergunta

O assistente recebe três ferramentas (`supabase/functions/assistant/tools.ts`):

| Ferramenta                | O que faz                                      |
| ------------------------- | ---------------------------------------------- |
| `buscar_estabelecimentos` | lojas ativas da cidade, por termo ou categoria |
| `listar_servicos`         | serviços com duração e preço                   |
| `consultar_horarios`      | **chama a RPC `available_slots`**              |

**`consultar_horarios` não calcula nada.** Ele chama a mesma função Postgres que
o resto do app usa. A decisão 0001 vale para o assistente sem exceção: se o
modelo deduzisse horário a partir do funcionamento da loja, produziria respostas
plausíveis e erradas — e "plausível e errado" é o que faz alguém aparecer numa
barbearia que não o espera.

O prompt de sistema proíbe inventar loja, serviço, preço ou horário. Mas prompt
é pedido, não garantia: a garantia real é que o modelo **não tem** os dados —
ele só vê o que a ferramenta devolveu.

## Decisão 3 — Cota diária de 20 perguntas por usuário

Conta gratuita tem crédito finito e ele acaba sem aviso. Sem limite, um usuário
curioso (ou um laço com defeito) esgota a cota de todos.

O limite vale no servidor, e é por isso que **não existe política de INSERT** em
`assistant_messages`: se o cliente pudesse inserir, contornaria a contagem
gravando direto na conversa sem passar pela função que chama a OpenAI.

A tela mostra quantas restam. Estourou, a resposta é uma frase em português, não
um 429 traduzido do inglês no meio da conversa.

## Decisão 4 — Cartões nativos, não lista dentro do balão

As ferramentas devolvem `cards` junto com o texto. O app desenha loja e horário
como componentes de verdade, tocáveis: tocar num horário já leva à confirmação
com loja, serviço, profissional e hora preenchidos.

Por isso o prompt manda o modelo **não** repetir a lista em texto. Um balão com
oito horários escritos é uma lista que o usuário não pode tocar.

## Decisão 5 — Modelo e URL base são variáveis de ambiente

`OPENAI_MODEL` (padrão `gpt-4o-mini`) e `OPENAI_BASE_URL`. Trocar de modelo
quando o crédito apertar não deve exigir deploy de código. A URL base abre
caminho para Azure OpenAI ou um proxy — e permitiu testar o laço de ferramentas
inteiro contra um servidor falso, sem gastar cota.

**Confira o nome do modelo na sua conta antes de trocar:** nome inexistente
devolve 404, e o app mostra "assistente indisponível" sem dizer por quê.

## O que ficou de fora

- **Streaming.** A resposta chega inteira. Streaming exige SSE na Edge Function
  e mudaria a tela; com respostas de duas ou três frases, o ganho é pequeno.
- **Histórico de conversas.** As tabelas guardam tudo e a RLS já permite ler,
  mas a tela começa vazia a cada abertura. Falta uma lista de conversas.
- **Moderação.** Nenhuma checagem do que o usuário escreve antes de mandar.
- **Custo observável.** Não gravamos tokens consumidos por resposta. Enquanto o
  volume for de teste, o painel da OpenAI resolve.
