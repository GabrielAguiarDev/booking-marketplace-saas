# 0008 — Loja não se aprova sozinha

**Data:** 3 de setembro de 2026
**Status:** aceita
**Migration:** `20260903150000_establishment_status_guard.sql`

## O buraco

`establishments_update_manager` deixa dono e gerente atualizarem a própria loja.
Está certo para nome, descrição, endereço, cor, política de sinal e prazos — é o
que o app do estabelecimento edita.

Só que `status` está na mesma tabela, e **RLS não filtra por coluna**. Na
prática, qualquer dono podia rodar:

```sql
update establishments set status = 'active' where id = '…';
```

e pular a aprovação da plataforma inteira. Uma loja suspensa por fraude podia se
reativar sozinha.

Isso foi encontrado enquanto se escrevia a tela de onboarding do app do
estabelecimento, que tinha um botão "Publicar perfil". O botão não foi escrito;
o buraco foi fechado.

## Por que é vulnerabilidade e não bug de tela

Neste projeto **a autorização é o schema** (ver `architecture.md`). Não existe
camada de servidor conferindo nada: o cliente fala direto com o Postgres. Uma
política que permite mais do que devia não é uma tela mal feita — é a permissão
real do sistema.

O fato de nenhuma tela oferecer o botão não protege: qualquer pessoa com a
chave publicável e um token de dono monta a requisição em uma linha de `curl`.

## A decisão

Um gatilho `before update`, porque RLS não sabe olhar coluna:

```sql
if new.status is distinct from old.status
   and current_setting('role', true) is distinct from 'service_role'
   and not public.is_platform_admin()
then raise exception … using errcode = '42501';
```

`pending → active` continua existindo; muda quem pode fazer. Como o gatilho
compara o papel da conexão, service_role passa — a Edge Function de cadastro e o
admin da plataforma, quando existirem, continuam funcionando. O app do
estabelecimento, não.

## Consequência para o produto

A tela "Começar" do app do estabelecimento lista os três passos de configuração
e **não** oferece publicação. Ela diz a verdade: falta a etapa de aprovação, e
ela ainda não existe em nenhuma superfície (item 3 de
[proximos-passos.md](../proximos-passos.md)).

Isso deixa uma loja recém-cadastrada num limbo — configurada e invisível — até
o portal administrativo existir. É um limbo honesto, e melhor do que o
anterior, que era "qualquer um se publica".
