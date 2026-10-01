# Setup local

## Pré-requisitos

- **Node 24.3+** — exigido pelo React Native 0.86
- **pnpm 11.17** — `corepack enable && corepack use pnpm@11.17.0`
- **Um runtime de container** — o stack local do Supabase sobe em Docker.
  No macOS, [OrbStack](https://orbstack.dev) (`brew install --cask orbstack`)
  é mais leve que o Docker Desktop. Precisa estar rodando antes do passo 2.

Para rodar nos apps mobile: Xcode (iOS) ou Android Studio (Android). Para
apenas ver as telas, o Expo Go serve.

## Passo a passo

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Subir o Supabase local

```bash
pnpm db:start
```

Na primeira vez baixa alguns GB de imagens. Ao final imprime as URLs e chaves.

| Serviço          | URL                                                       |
| ---------------- | --------------------------------------------------------- |
| API              | http://127.0.0.1:54321                                    |
| Postgres         | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio           | http://127.0.0.1:54323                                    |
| Mailpit (e-mail) | http://127.0.0.1:54324                                    |

Para reimprimir depois: `pnpm db:status`.

### 3. Configurar as variáveis de ambiente

Cada app tem um `.env.example`. Copie para `.env.local` e confira os valores
contra a saída de `pnpm db:status`:

```bash
for app in landing portal admin mobile-cliente mobile-staff; do
  cp -n "apps/$app/.env.example" "apps/$app/.env.local"
done
```

As chaves do stack local são geradas pelo CLI do Supabase e valem só para a sua
máquina. Nenhum `.env.local` vai para o git.

### 4. Subir os apps

Tudo de uma vez:

```bash
pnpm dev
```

Ou individualmente:

```bash
pnpm --filter @vez/landing dev         # http://localhost:3000
pnpm --filter @vez/portal dev          # http://localhost:3001
pnpm --filter @vez/admin dev           # http://localhost:3002
pnpm --filter @vez/mobile-cliente dev  # Metro em 8081
pnpm --filter @vez/mobile-staff dev    # Metro em 8082
```

A landing apresenta o produto e recebe interessados. O portal permite cadastro
e operação do estabelecimento; o admin exige uma conta da plataforma. Carregue
a demo para testar os dois apps mobile e as áreas autenticadas com dados locais.

## Dados de demonstração

`seed.sql` guarda só cidades e roda em todo `db:reset`. As lojas, a equipe e o
dia de hoje ficam separados de propósito:

```bash
pnpm db:demo
```

Contas criadas, todas com senha `senha-forte-123` (roteiros de teste e
endereços de cada superfície em [contas-de-teste.md](contas-de-teste.md)):

| Conta               | Papel                                            |
| ------------------- | ------------------------------------------------ |
| `rafael@vez.local`  | dono da Barbearia Meia-Nove — acesso total       |
| `diego@vez.local`   | equipe — vê a agenda, não edita cadastro da loja |
| `cliente@vez.local` | cliente, com reserva pendente e lugar na fila    |
| `admin@vez.local`   | administradora da plataforma                     |

Entrar como `rafael` no app do estabelecimento e como `cliente` no app do
cliente mostra os dois lados da mesma fila, ao vivo.

> **Dispositivo físico:** `127.0.0.1` aponta para o próprio aparelho. Troque
> pelo IP da sua máquina na rede local no `.env.local` do app mobile.

## Trabalhando no banco

```bash
pnpm db:reset       # recria do zero: migrations + seed
pnpm db:diff nome   # gera migration a partir de mudanças feitas no Studio
pnpm db:types       # regenera packages/supabase/src/database.types.ts
pnpm db:check-rls   # falha se alguma tabela estiver sem RLS ou sem política
pnpm db:stop        # derruba o stack
```

`database.types.ts` é **gerado**, nunca editado à mão. Depois de qualquer
migration, rode `pnpm db:types` e faça commit do resultado — a build não depende
do banco estar no ar.

`db:demo` e `db:test:behavior` selecionam o container pelo `project_id` deste
repositório. Outros projetos Supabase podem ficar ligados sem receber esse SQL.

### Depois de mover a pasta do projeto

Se o banco responder, mas a API em `54321` não abrir, confira o estado dos
containers. Um erro de montagem do Kong citando a pasta antiga indica que os
templates de e-mail ainda estão vinculados ao caminho anterior. A partir da
nova pasta, rode `pnpm db:stop` e `pnpm db:start`: o stop normal preserva o backup
local e o start recria os containers com os caminhos atuais. Não use `db:reset`
ou `--no-backup` para resolver isso: eles descartam dados.

## Edge Functions e avisos

```bash
cp -n supabase/functions/.env.example supabase/functions/.env   # e preencha
pnpm exec supabase functions serve --env-file supabase/functions/.env
```

Os avisos (push, e-mail) só saem com `NOTIFICATIONS_DISPATCH_SECRET` no `.env`
das funções **e** os dois segredos do Vault que o cron lê. Sem eles nada quebra:
os avisos ficam na caixa de saída como `pending`/`unconfigured`. Passo a passo,
secrets de provedor e contratos em [notificacoes.md](notificacoes.md). Depois
de mudar `supabase/config.toml` (modelo de convite, `verify_jwt`), rode
`pnpm db:stop && pnpm db:start`.

## Verificações do monorepo

```bash
pnpm build       # Next build nos três apps web
pnpm lint        # ESLint nos 7 workspaces
pnpm typecheck   # tsc --noEmit nos 7 workspaces
pnpm test        # testes automatizados dos workspaces
pnpm verify      # tipos, lint, testes e builds web
pnpm format      # Prettier
```

`pnpm build` não passa pelos apps mobile: Expo não compila localmente, quem
compila é o EAS. Neles a rede de proteção é `lint` + `typecheck`.

O workflow `.github/workflows/ci.yml` executa as verificações em PRs e em pushes
para `main`. Um segundo job sobe banco efêmero, aplica migrations, carrega a demo,
verifica RLS e autorização e compara os tipos gerados com os versionados.
Não usa credenciais nem executa deploy em produção. O resultado no GitHub só
existe depois que o workflow é enviado ao repositório remoto.
