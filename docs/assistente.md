# Assistente — como ligar

O assistente já está construído e testado. Falta uma coisa: **a sua chave da
OpenAI.** Sem ela, a tela responde "O assistente ainda não está configurado
neste ambiente" — que é o estado correto, não um erro.

## Local, em três passos

**1. Pegue uma chave** em https://platform.openai.com/api-keys.

**2. Ponha em `supabase/functions/.env`** (o arquivo já existe, com os campos
vazios; ele é ignorado pelo git):

```
OPENAI_API_KEY=sk-proj-SUA-CHAVE-AQUI
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=
```

**3. Reinicie a stack** — as Edge Functions só leem o `.env` no start:

```bash
pnpm db:stop && pnpm db:start
```

Pronto. Abra a aba IA e pergunte "tem corte hoje à tarde?".

> Reiniciar só o container (`docker restart supabase_edge_runtime_…`) recarrega
> o código das funções, mas **não** relê o `.env`. Para variável nova, é
> `db:stop && db:start`.

## Em produção

Não existe arquivo. A chave vai como segredo do projeto:

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-SUA-CHAVE-AQUI
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase functions deploy assistant
```

## Custo, que é o que importa numa conta de testes

Quatro travas, todas no servidor:

| Trava                 | Valor          | Onde                                             |
| --------------------- | -------------- | ------------------------------------------------ |
| Perguntas por usuário | 20 por dia     | `assistant/index.ts` + `assistant_usage_today()` |
| Rodadas de ferramenta | 4 por pergunta | `MAX_TOOL_ROUNDS`                                |
| Tamanho da resposta   | 500 tokens     | `max_tokens`                                     |
| Histórico enviado     | 12 mensagens   | `HISTORY_LIMIT`                                  |

O limite de 20 aparece em dois lugares — na constante da Edge Function e na
função `assistant_usage_today()`. **Mudar num só faz a tela mentir**: ela diria
que restam perguntas enquanto o servidor recusa.

## Trocar de modelo

`OPENAI_MODEL` no `.env` (ou nos segredos) e reinicie. Confira o nome exato na
sua conta: nome que não existe devolve 404 e a tela mostra "assistente
indisponível" sem explicar o motivo.

## Conta gratuita **não** dá crédito de API

Este é o tropeço mais provável, e ele não tem nada a ver com o código.

A API da OpenAI é cobrada à parte do ChatGPT. Conta nova (e assinatura do
ChatGPT Plus) **não** inclui crédito de API: a chave é criada normalmente,
autentica normalmente, e toda chamada volta com

```
429 insufficient_quota — You have no credits remaining.
```

Ou seja: chave válida, saldo zero. Para usar, é preciso adicionar crédito em
https://platform.openai.com/settings/organization/billing.

As travas de custo desta implementação — 20 perguntas por dia por usuário, 500
tokens de resposta, 4 rodadas de ferramenta — existem para que o menor crédito
possível dure bastante em teste. Acompanhe o gasto real em
https://platform.openai.com/usage.

## Os três erros que a tela sabe distinguir

| Mensagem na tela                         | Causa                                                         | O que fazer             |
| ---------------------------------------- | ------------------------------------------------------------- | ----------------------- |
| "ainda não está configurado"             | `OPENAI_API_KEY` vazia, ou 401/403 (chave errada ou revogada) | conferir a chave        |
| "está sem crédito"                       | 429 `insufficient_quota`                                      | adicionar crédito       |
| "indisponível agora, tente em instantes" | 429 de limite por minuto, 5xx, rede                           | esperar de fato resolve |

A distinção importa: o 429 da OpenAI é dois erros com o mesmo número, e eles
pedem ações opostas. Esperar resolve um e nunca resolve o outro.

O detalhe cru fica no log: `docker logs supabase_edge_runtime_<projeto>`.

## Testar sem gastar cota

`OPENAI_BASE_URL` aponta para qualquer coisa que fale o protocolo de
`/chat/completions`. Foi assim que o laço de ferramentas foi verificado aqui:
um servidor falso que pede `buscar_estabelecimentos`, depois
`consultar_horarios`, depois responde em texto — provando que as duas rodadas,
os dados reais e os cartões funcionam antes de qualquer chave real existir.

## O que o assistente pode e não pode

**Pode:** buscar lojas da cidade por nome ou categoria, listar serviços com
preço e duração, e consultar horários realmente livres.

**Não pode:** reservar. Ele devolve horários tocáveis; quem confirma é o usuário,
na tela de confirmação. Um assistente que reserva sozinho é um assistente que
marca horário errado sem ninguém conferir.

**Não sabe:** nada que as ferramentas não devolvam. Ele não tem a base em
memória — se a ferramenta não achou, ele diz que não achou.
