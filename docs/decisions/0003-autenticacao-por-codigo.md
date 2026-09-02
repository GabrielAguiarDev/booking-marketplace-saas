# 0003 — Autenticação: senha para entrar, código de 6 dígitos para confirmar

Data: 2026-09-02 · Status: aceito · Afeta: `apps/mobile-cliente`, `supabase/config.toml`

## Contexto

A fase 1 do [roadmap](../roadmap-mobile-cliente.md) precisava de uma decisão que
estava em aberto: como as pessoas entram no app. Duas escolhas independentes.

## Decisão 1 — E-mail e senha, não OTP por telefone

Pedido direto: login, cadastro, recuperação de senha e confirmação de usuário.
"Recuperação de senha" só existe onde há senha.

**O que isso custa:** OTP por telefone casaria melhor com parte do público, que
lembra do número e não do e-mail. Fica registrado como possível adição futura
(`signInWithOtp` com `phone`), não como troca — as duas podem coexistir.

## Decisão 2 — Código de 6 dígitos no app, não link mágico no e-mail

O padrão do Supabase é mandar um link (`{{ .ConfirmationURL }}`) que devolve
para o app por deep link. Aqui isso não funcionaria:

- **Não existe domínio.** Universal link exige domínio verificado e um
  `apple-app-site-association` publicado. O projeto não tem nem um nem outro.
- **Sem isso, o link abre o navegador**, não o app. O usuário fica olhando uma
  página de API em vez de voltar para onde estava.
- **Em desenvolvimento é pior ainda:** o esquema do simulador muda entre `exp://`
  e `vezcliente://` conforme como o app foi iniciado.

Os templates em `supabase/templates/` trocam o link por `{{ .Token }}`, o código
de seis dígitos, e o app pede esse código numa tela.

**Fluxos resultantes:**

| Fluxo       | Chamadas                                                                |
| ----------- | ----------------------------------------------------------------------- |
| Cadastro    | `signUp` → `verifyOtp({type:"signup"})`                                 |
| Recuperação | `resetPasswordForEmail` → `verifyOtp({type:"recovery"})` → `updateUser` |
| Reenvio     | `resend({type:"signup"})` / `resetPasswordForEmail` de novo             |

**O que isso custa:** o usuário copia seis dígitos em vez de tocar uma vez. Em
troca, o fluxo funciona hoje, em qualquer cliente de e-mail, sem infraestrutura
de domínio. Quando houver domínio, dá para acrescentar o link **sem tocar nas
telas** — a tela de código continua sendo o caminho alternativo de sempre.

## Decisão 3 — O que exige conta

Buscar, explorar e ver a página da loja funcionam deslogado. Só exigem sessão:
`horario`, `pagamento`, `fila` e `avaliacao` — as ações que criam compromisso
com o estabelecimento.

`AuthGate` (`src/auth/AuthGate.tsx`) envolve essas telas e leva ao login com o
caminho de origem em `redirect`, para devolver o usuário exatamente onde ele
estava. As abas Agenda e Perfil não redirecionam: trocam o conteúdo por um
convite, porque expulsar alguém de uma aba que ele acabou de tocar é hostil.

## Decisão 4 — Senha mínima de 8 caracteres

`minimum_password_length` subiu de 6 para 8 em `supabase/config.toml`.
`MIN_PASSWORD_LENGTH` em `src/auth/validation.ts` espelha esse número; se os
dois divergirem, o servidor vence e o usuário vê o erro traduzido.

## Consequência que precisa de atenção antes de produção

Nada disso funciona em produção sem **SMTP configurado**. O ambiente local usa
Mailpit, que captura tudo. Sem `[auth.email.smtp]` preenchido, o Supabase
hospedado limita a três e-mails por hora — ninguém consegue se cadastrar.
Ver a lista de pendências no roadmap.
