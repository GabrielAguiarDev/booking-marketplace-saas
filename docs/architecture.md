# Arquitetura

## As cinco superfícies

| Workspace             | Tipo    | Porta dev | Papel                                  |
| --------------------- | ------- | --------- | -------------------------------------- |
| `apps/landing`        | Next.js | 3000      | Site público; converte estabelecimento |
| `apps/portal`         | Next.js | 3001      | Portal web do estabelecimento          |
| `apps/admin`          | Next.js | 3002      | Portal administrativo da plataforma    |
| `apps/mobile-cliente` | Expo    | 8081      | App do cliente final                   |
| `apps/mobile-staff`   | Expo    | 8082      | App do estabelecimento                 |

As três superfícies web são projetos separados na Vercel, cada uma com seu
_root directory_ apontando para a pasta do app. O `outputFileTracingRoot` no
`next.config.ts` aponta para a raiz do monorepo — sem isso o trace de arquivos
da build sai incompleto e o deploy quebra em runtime.

## Backend

Supabase é o backend inteiro: Postgres, Auth, RLS, Realtime e Storage. Não há
servidor próprio. Lógica que precisa ignorar RLS vive em Edge Function.

Isso significa que **a autorização é o schema**. Uma política de RLS errada é
uma vulnerabilidade, não um bug de tela. Ver `conventions.md`.

## `packages/`

Só existe pacote onde há duplicação real. Hoje existe um:

### `packages/supabase`

Cliente tipado e tipos gerados do banco. Consumido pelas cinco superfícies.
Publicado como TypeScript, sem etapa de build — o Next transpila via
`transpilePackages` e o Metro lê `.ts` nativamente.

Os entrypoints são separados por ambiente de execução, e essa separação é
proposital:

| Entry                   | Para quem                   | Observação                                      |
| ----------------------- | --------------------------- | ----------------------------------------------- |
| `@vez/supabase/browser` | Componentes `"use client"`  | Lê `NEXT_PUBLIC_*`                              |
| `@vez/supabase/server`  | Genérico de servidor        | Recebe o adapter de cookie por parâmetro        |
| `@vez/supabase/next`    | Server Components / Actions | Importa `next/headers`; Metro nunca o alcança   |
| `@vez/supabase/native`  | Os dois apps Expo           | Lê `EXPO_PUBLIC_*`, sessão no Keychain/Keystore |
| `@vez/supabase/types`   | Qualquer lugar              | `Database` gerado do banco                      |

Não existe barrel `index`. Se existisse, um import de `@vez/supabase` dentro de
um app Expo arrastaria `next/headers` para o grafo do Metro.

### A chave de service role

Não existe cliente de service role neste pacote, e isso não é omissão. A secret
key (`sb_secret_…`) ignora RLS por completo; bastaria um import errado em um
Server Component para ela entrar no bundle do navegador. Como ela não está no
pacote, esse erro não é possível.

Toda operação privilegiada — criar estabelecimento validando a cota da cidade,
promover admin da plataforma, conciliar cobrança — vive em Edge Function, lendo
a chave do ambiente do Deno.

## Sessão nos apps nativos

A sessão persiste no `expo-secure-store`, não em AsyncStorage: um refresh token
em storage não cifrado é legível por qualquer processo com acesso ao sandbox do
app.

O Keystore do Android rejeita valores acima de ~2048 bytes e a sessão do
Supabase passa disso, então `packages/supabase/src/secure-storage.ts` parte o
valor em pedaços e remonta na leitura.

O refresh automático não roda com o app em background. `startAutoRefreshOnAppState`
liga o ciclo ao `AppState` e é chamado no layout raiz de cada app.

## O que ainda não existe

Agendamento, fila por ordem de chegada, planos e cobrança, Realtime e Storage.
A migration de fundação cria apenas cidades, estabelecimentos, perfis, vínculo
de equipe e admins da plataforma.
