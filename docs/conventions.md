# Convenções

## Idioma

Texto de interface, mensagem de erro para o usuário e documentação em
**português**. Identificador de código — variável, função, tabela, coluna, tipo,
nome de arquivo — em **inglês**.

Vale para o banco também: `establishments`, não `estabelecimentos`.

## Banco

### RLS é obrigatória

**Nenhuma tabela nasce sem `enable row level security` e sem ao menos uma
política.** Como a autorização vive no schema e não numa camada de servidor,
tabela sem política é dado exposto.

`pnpm db:check-rls` falha se qualquer tabela de `public` violar isso. Rode antes
de abrir PR com migration.

### Helpers de política

Os helpers são `security definer` com `set search_path = ''`. É isso que permite
consultar `establishment_members` de dentro de uma política sem disparar
recursão.

| Helper                                 | Uso                                     |
| -------------------------------------- | --------------------------------------- |
| `is_platform_admin()`                  | Admin da plataforma                     |
| `is_establishment_member(uuid)`        | Pertence ao estabelecimento             |
| `has_establishment_role(uuid, role[])` | Pertence com um dos papéis              |
| `current_establishment_ids()`          | Todos os estabelecimentos do usuário    |
| `shares_establishment_with(uuid)`      | Divide estabelecimento com outro perfil |

`auth.uid()` sempre embrulhado em subquery — `(select auth.uid())` — para o
Postgres avaliar uma vez por statement em vez de uma vez por linha.

### Políticas para `anon` não chamam helper

As leituras públicas usam predicado literal (`is_active`, `status = 'active'`).
O `execute` dos helpers é revogado de `public` e concedido só a `authenticated`
e `service_role`.

### Vínculo com estabelecimento é N:N

`establishment_members` existe porque um profissional pode atender em mais de
uma unidade e uma rede pode ter várias. `profiles` é identidade base, neutra
quanto a papel: a mesma pessoa pode ser cliente em um estabelecimento e equipe
em outro.

### Escritas que não têm política

Duas ausências são deliberadas, não esquecimento:

- **`establishments` não tem política de `insert`.** O cadastro nasce em Edge
  Function, que valida a cota da cidade antes de gravar.
- **`platform_admins` não tem nenhuma política de escrita.** Promover ou revogar
  admin exige service role, fora do alcance do app.

### Migrations

Uma migration por mudança, nome descritivo, nunca editada depois de aplicada.
Depois de qualquer migration: `pnpm db:types` e commit do resultado.

## TypeScript

`tsconfig.base.json` na raiz, estendido por cada workspace. `strict` e
`noUncheckedIndexedAccess` ligados.

`verbatimModuleSyntax` está ligado na base: import de tipo se escreve
`import type` ou `import { type X }`. O lint corrige sozinho com `--fix`.

## Versões

Todas as dependências são **pinadas exatas** (sem `^`), exceto pacotes do Expo,
que usam `~` porque o SDK espera essa faixa.

**React é 19.2.3 nos cinco apps.** O Expo SDK 57 exige essa versão exata; o Next
16 aceita `^19.0.0`. Fixar a mesma nos dois lados mantém uma cópia só no
monorepo. Não suba o React sem subir o SDK do Expo junto.

Pinos que não podem se mover sozinhos:

| Pacote           | Versão  | Amarra                                                |
| ---------------- | ------- | ----------------------------------------------------- |
| TypeScript       | 6.0.3   | `typescript-eslint` só suporta `<6.1.0`               |
| ESLint           | 9.39.5  | `eslint-config-next` quebra no ESLint 10 (ver abaixo) |
| React            | 19.2.3  | Pin exato do Expo SDK 57                              |
| react-native-svg | 15.15.4 | Pin do SDK 57 (`bundledNativeModules`)                |

### A dívida do ESLint

`eslint-config-next@16` arrasta `eslint-plugin-react`, `eslint-plugin-import` e
`eslint-plugin-jsx-a11y`, todos com teto em `eslint ^9`. No ESLint 10 o lint
morre com `TypeError: contextOrFilename.getFilename is not a function`.

O ESLint 9.39.5 funciona, mas está marcado como fora de suporte no npm — não
recebe correção de segurança. É dívida conhecida: quando o ecossistema do Next
migrar para o ESLint 10, subir os dois juntos.

## Mobile

O app do cliente implementa um canvas do Claude Design; a divisão entre dado
real e fixture, e as traduções de CSS para React Native, estão em
[mobile-cliente.md](mobile-cliente.md).

`experiments.typedRoutes` do Expo Router fica **desligado** nos dois apps: os
tipos de rota só são gerados quando o Metro roda, o que faria `turbo run
typecheck` depender de um bundler ter rodado antes e falhar em CI.

`ios/` e `android/` são gerados pelo prebuild (CNG) e não são versionados. Quem
descreve o app nativo é o `app.json`.

## Configuração do pnpm

No pnpm 11, `.npmrc` só é lido para auth e registry. Toda configuração está em
`pnpm-workspace.yaml` — inclusive `allowBuilds`, sem o qual o install falha com
`ERR_PNPM_IGNORED_BUILDS`.

## Portas

Fixas, para os cinco apps rodarem ao mesmo tempo:

| 3000    | 3001   | 3002  | 8081           | 8082         | 54321-54324 |
| ------- | ------ | ----- | -------------- | ------------ | ----------- |
| landing | portal | admin | mobile-cliente | mobile-staff | Supabase    |
