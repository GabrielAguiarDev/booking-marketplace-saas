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

Cada app abre numa tela única que consulta `cities` e mostra o resultado. Se
aparecer a lista de cidades, a conexão com o Supabase está de pé.

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

## Verificações do monorepo

```bash
pnpm build       # Next build nos três apps web
pnpm lint        # ESLint nos 6 workspaces
pnpm typecheck   # tsc --noEmit nos 6 workspaces
pnpm format      # Prettier
```

`pnpm build` não passa pelos apps mobile: Expo não compila localmente, quem
compila é o EAS. Neles a rede de proteção é `lint` + `typecheck`.
