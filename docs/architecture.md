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

Só existe pacote onde há duplicação real, e só depois que o segundo consumidor
existe de fato (regra R8). Hoje existem dois:

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

### `packages/mobile-kit`

O que os dois apps Expo usam igual: os oito tokens do design, a tipografia,
formatação, `useAsync` e a camada de sessão/validação de conta. Quatro entries:
`/theme`, `/format`, `/async`, `/auth`.

Nasceu quando `mobile-staff` passou a existir, não antes — é literalmente a
regra R8 de [proximos-passos.md](proximos-passos.md).

**Os componentes de UI ficaram fora de propósito.** Os dois apps saem de
canvases diferentes e desenham cartão, cabeçalho e barra de abas de formas
distintas; forçá-los no mesmo componente trocaria duplicação por um componente
cheio de `if (app === …)`. O que subiu é o que é igual e neutro de design.

`createSessionContext(supabase)` é fábrica e não componente porque cada app tem
o seu cliente Supabase: as duas sessões convivem no mesmo aparelho sem se
derrubar.

## Sessão nos apps nativos

A sessão persiste no `expo-secure-store`, não em AsyncStorage: um refresh token
em storage não cifrado é legível por qualquer processo com acesso ao sandbox do
app.

O Keystore do Android rejeita valores acima de ~2048 bytes e a sessão do
Supabase passa disso, então `packages/supabase/src/secure-storage.ts` parte o
valor em pedaços e remonta na leitura.

O refresh automático não roda com o app em background. `startAutoRefreshOnAppState`
liga o ciclo ao `AppState` e é chamado no layout raiz de cada app.

## Onde vive cada regra da loja

Três lugares, e a divisão importa porque duplicar qualquer um cria duas
verdades sobre a mesma pergunta:

| Onde                        | O quê                                                               |
| --------------------------- | ------------------------------------------------------------------- |
| `establishments`            | fuso, grade de horário, antecedência, sinal, janela de cancelamento |
| `establishment_settings`    | como a fila funciona; aprovação automática; pagamento               |
| `member_notification_prefs` | o que toca no celular de cada pessoa da equipe                      |

O que a Edge Function de reserva e `available_slots()` já liam continua em
`establishments`. Ver [decisão 0007](decisions/0007-ajustes-da-loja-no-banco.md).

## O que ainda não existe

Planos e cobrança, Storage, notificação push, e o cadastro de estabelecimento
com aprovação da plataforma. `payments` existe como esquema e nunca recebeu uma
linha.
