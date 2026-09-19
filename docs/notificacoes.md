# Avisos, fila, convites, anexos e recuperação de MFA

Infraestrutura de lançamento que **não** envolve pagamento nem IA. O banco e
as Edge Functions ficam aqui; desde 2026-09-18 os dois apps, o portal e o admin
também expõem os fluxos e os estados externos correspondentes.

| Migration                                        | O que entrega                                                |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `20260917100000_notifications.sql`               | aparelhos, caixa de saída, eventos → aviso, cron do despacho |
| `20260917130000_notification_customer_prefs.sql` | preferências do cliente valem; lembrete; pedido de avaliação |
| `20260917131000_queue_rules.sql`                 | os ajustes da fila passam a atuar; QR do balcão              |
| `20260917132000_establishment_invites.sql`       | convite de conta nova para a equipe da loja                  |
| `20260917133000_support_attachments.sql`         | anexos em chamado, bucket privado                            |
| `20260917134000_mfa_recovery.sql`                | códigos de recuperação e redefinição de fator pelo admin     |

| Edge Function            | Quem chama                        | JWT                       |
| ------------------------ | --------------------------------- | ------------------------- |
| `notifications-dispatch` | `pg_cron` (via `pg_net`)          | não — `x-dispatch-secret` |
| `establishment-invite`   | portal / app da loja (dono)       | sim                       |
| `mfa-recovery`           | admin (a própria pessoa ou admin) | sim                       |

Testes de comportamento (tudo revertido ao final):
`docker exec -i supabase_db_vez-saas psql -U postgres -v ON_ERROR_STOP=1 < supabase/snippets/notifications-queue-invites.sql`

---

## Como um aviso sai

```
evento no banco ──gatilho──▶ notification_outbox (pending)
                                   │  pg_cron, a cada minuto
                                   ▼
               notification_dispatch_kick() ──pg_net──▶ notifications-dispatch
                                                           │ claim → Expo / e-mail → complete
                                                           ▼
                                            sent · retry · failed · skipped · unconfigured
```

- O aviso nasce **na mesma transação** do evento. Reserva que não gravou não
  avisa; reserva que gravou não perde o aviso.
- `dedupe_key` única: gatilho reexecutado ou cron repetido não duplica.
- `retry` volta com espera exponencial (1, 2, 4, 8 min) até `max_attempts` (5).
- Canal **sem provedor configurado** não gasta tentativa: a linha fica
  `unconfigured` e volta sozinha no primeiro despacho com o secret presente.
- Linha `sending` abandonada (despacho que morreu) é reivindicada de novo após
  10 minutos.
- `sent`/`skipped`/`failed` com mais de 90 dias são apagados pelo cron.
- `admin_notification_health()` (operações/suporte) resume a caixa por canal e
  status nas últimas 24h, com o último erro — é onde se vê "e-mail sem
  provedor".

### Eventos que viram aviso

| Evento                                 | Para quem                          | Canal                          | Regra                                 |
| -------------------------------------- | ---------------------------------- | ------------------------------ | ------------------------------------- |
| reserva nova                           | equipe da loja                     | push (staff)                   | `notify_new_appointment`              |
| cliente cancelou                       | equipe da loja                     | push (staff)                   | `notify_cancellation`                 |
| entrou na fila pelo app/QR             | equipe da loja                     | push (staff)                   | `notify_queue_join`                   |
| resumo do dia (a partir das 7h local)  | equipe da loja                     | push (staff)                   | `notify_daily_summary`                |
| loja confirmou / cancelou / remarcou   | cliente                            | push (+e-mail no cancelamento) | `appointment_changes`                 |
| chamado na fila                        | cliente (ou telefone do convidado) | canal da loja                  | `queue_notify_enabled` + `queue_turn` |
| 2h antes da reserva                    | cliente                            | push                           | `appointment_reminder`                |
| 1h depois de concluída                 | cliente                            | push                           | `review_request`                      |
| resposta da equipe em chamado          | quem abriu                         | push + e-mail                  | —                                     |
| decisão de cadastro                    | donos da loja                      | push + e-mail                  | —                                     |
| pedido de esclarecimento em denúncia   | dono e gerência                    | push (staff)                   | —                                     |
| interessado novo na landing            | admin e operações da plataforma    | e-mail                         | —                                     |
| vínculo a conta já existente (convite) | a pessoa                           | push + e-mail                  | —                                     |
| segundo fator removido                 | a pessoa                           | e-mail                         | —                                     |

"Equipe da loja": dono e gerência recebem tudo; `staff` só o que é da cadeira
dele (`professionals.user_id`) ou não tem cadeira. Quem causou o evento não é
avisado. Sem linha em `member_notification_prefs` vale o padrão da tabela; sem
linha em `customer_notification_prefs`, operacional ligado e marketing desligado.

`data` do push sempre traz `type`, `kind` e `notification_id`, mais os ids do
evento (`appointment_id`, `queue_entry_id`, `ticket_id`, `establishment_id`…),
para o app rotear o toque.

### Contrato para os apps (Expo)

```ts
// depois do login, com o token de Notifications.getExpoPushTokenAsync({ projectId })
await supabase.rpc("register_push_device", {
  p_expo_token: token, // ExponentPushToken[…]
  p_app: "cliente", // ou "staff"
  p_platform: Platform.OS, // ios | android | web
  p_device_name: Device.modelName, // opcional
});
// ao sair da conta
await supabase.rpc("unregister_push_device", { p_expo_token: token });
```

O token muda de dono se outra conta entrar no mesmo aparelho. `push_devices` e
`notification_outbox` são legíveis pelo próprio dono (base de uma caixa de
entrada no app); ninguém escreve nelas direto.

### Secrets e configuração

Nada disso tem valor no repositório. Sem eles, o sistema **para em estado
visível**: o cron devolve `unconfigured` e a caixa acumula `pending`; com o
despacho ligado e o canal sem provedor, as linhas ficam `unconfigured` com o
motivo em `last_error`.

**Edge Functions** (`supabase/functions/.env` no local; `supabase secrets set`
em produção) — ver `supabase/functions/.env.example`:

| Secret                                     | Para quê                                                    |
| ------------------------------------------ | ----------------------------------------------------------- |
| `NOTIFICATIONS_DISPATCH_SECRET`            | obrigatório; sem ele o despacho responde 503 `unconfigured` |
| `PUSH_PROVIDER=expo`                       | liga o canal push                                           |
| `EXPO_ACCESS_TOKEN`                        | só se o projeto Expo tiver "Enhanced push security"         |
| `EMAIL_PROVIDER`                           | `resend` ou `postmark`; liga o canal e-mail                 |
| `EMAIL_FROM`                               | remetente de domínio verificado no provedor                 |
| `RESEND_API_KEY` / `POSTMARK_SERVER_TOKEN` | a chave do provedor escolhido                               |
| `EMAIL_REPLY_TO`                           | opcional                                                    |
| `PORTAL_SITE_URL`                          | destino do convite da loja (`<url>/convite`)                |
| `ADMIN_SITE_URL`                           | destino do convite da plataforma (já existia)               |

SMS e WhatsApp não têm provedor implementado: avisos nesses canais ficam
sempre `unconfigured`.

**Banco (Vault)** — o cron lê de lá a URL e o mesmo segredo:

```sql
-- local: a função no gateway interno do Docker
select vault.create_secret('http://supabase_kong_vez-saas:8000/functions/v1/notifications-dispatch',
                           'notifications_dispatch_url');
-- produção: https://<ref>.supabase.co/functions/v1/notifications-dispatch
select vault.create_secret('<o mesmo NOTIFICATIONS_DISPATCH_SECRET>', 'notifications_dispatch_secret');
```

Para trocar: `select vault.update_secret(id, '<novo>') from vault.secrets where name = '…'`.

**Local, passo a passo:**

1. Preencha `NOTIFICATIONS_DISPATCH_SECRET` (e, se quiser, e-mail/push) em
   `supabase/functions/.env`.
2. Crie os dois segredos do Vault acima.
3. `pnpm exec supabase functions serve --env-file supabase/functions/.env`.
4. `pnpm db:stop && pnpm db:start` uma vez, para o Auth ler o modelo novo de
   convite (`supabase/templates/invite.html`) e o runtime ler
   `[functions.notifications-dispatch] verify_jwt = false`.

Disparo manual, sem esperar o cron:
`curl -X POST http://127.0.0.1:54321/functions/v1/notifications-dispatch -H "x-dispatch-secret: $SEGREDO"`.

**Produção:** `pg_cron` e `pg_net` precisam estar habilitados no projeto (a
migration cria as extensões); os jobs são `notifications-dispatch`,
`notifications-daily-summary`, `notifications-appointment-reminders`,
`notifications-outbox-prune` e `queue-maintenance` (`select * from cron.job`).
O Auth hospedado precisa de SMTP próprio para o convite sair em volume.

---

## Os ajustes da fila atuam

Aplicados no banco (`guard_queue_entry_rules`, `queue_state`, cron), valendo
para todas as superfícies. Entrada pela equipe (`source = 'counter'`) nunca é
barrada. Erros levam código estável em `hint`.

| Ajuste                   | Efeito                                                                             | `hint` do erro                                                   |
| ------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `queue_remote_join`      | desligado: o app não entra de longe (só QR ou balcão)                              | `queue_remote_join_disabled`                                     |
| `queue_qr_enabled`       | entrar com o código do cartaz: `source = 'qr'`, já com chegada confirmada          | `queue_qr_disabled`, `queue_code_required`, `queue_code_invalid` |
| `queue_per_professional` | `queue_state()` conta posição e espera por profissional (sem escolha = fila comum) | —                                                                |
| `queue_auto_close`       | recusa entrada pelo app se a espera passar de `queue_close_after_minutes`          | `queue_closed_full`                                              |
| `queue_auto_skip`        | chamado há mais de 2 min sem sentar vira `no_show` (cron a cada minuto)            | —                                                                |
| `queue_notify_*`         | aviso na vez pelo canal escolhido (ver acima)                                      | —                                                                |
| `queue_arrival_method`   | `staff`: cliente não confirma sozinho; `qr` com cartaz ligado: exige o código      | `queue_arrival_by_staff`                                         |

Com `queue_per_professional` desligado, `queue_state()` devolve o mesmo que
antes. `accept_app_payment` e `deposit_refundable` continuam sem efeito: são do
provedor de pagamento.

RPCs novas:

| RPC                                      | Quem         | O quê                                         |
| ---------------------------------------- | ------------ | --------------------------------------------- |
| `queue_qr_code(establishment_id)`        | dono/gerente | código do cartaz (cria na primeira vez)       |
| `rotate_queue_qr_code(establishment_id)` | dono/gerente | invalida o cartaz antigo                      |
| `queue_join(est, service?, pro?, code?)` | cliente      | entra na fila; com código, entra como `qr`    |
| `queue_confirm_arrival(entry, code?)`    | cliente      | confirma chegada respeitando o método da loja |
| `queue_wait_for_newcomer(est, pro?)`     | todos        | espera de quem entrasse agora                 |

Conteúdo sugerido do QR: `vezcliente://fila/<establishment_id>?codigo=<code>`.
O `insert` direto em `queue_entries` que o app do cliente já faz continua
funcionando (e obedecendo as regras); `queue_join` é o caminho com código.

---

## Convite para a equipe da loja

`POST /functions/v1/establishment-invite` com o JWT do dono:

```json
{
  "establishment_id": "…",
  "email": "ana@…",
  "name": "Ana",
  "role": "staff",
  "professional_id": "…"
}
```

Resposta `201 { user_id, invited: true }` (conta criada, e-mail do Auth
enviado) ou `200 { user_id, invited: false }` (conta já existia: vínculo na
hora, aviso pela caixa de saída). Convidar de novo quem não entrou é reenvio.
Erros: `forbidden` (não é dono), `already_member`, `invalid_role`,
`invalid_professional`, `professional_taken`, `rate_limited`, `invite_failed`.

- `role` é `manager` ou `staff`; dono se promove pela tela da equipe.
- `professional_id` liga a conta à cadeira (se a cadeira não tem conta).
- O link do e-mail leva a `PORTAL_SITE_URL/convite` com a sessão no fragmento
  da URL (como o `accept-invite` do admin). A rota `/convite` grava a sessão,
  remove os tokens da barra e pede a senha (`auth.updateUser({ password })`).
- `establishment_invites(establishment_id)` lista os convites (dono/gerente) e
  marca `accepted` quem já entrou; `establishment_revoke_invite(id)` (dono)
  desfaz o pendente, tirando vínculo e cadeira — a conta do Auth fica.

---

## Anexos em chamado

Bucket **privado** `support-attachments` (10 MB; JPEG, PNG, WebP, HEIC, PDF).

1. Subir em `<ticket_id>/<uuid>.<ext>` — a política só aceita chamado que a
   pessoa enxerga e que não está resolvido.
2. `attach_support_file(ticket_id, storage_path, file_name, message_id?)` —
   confere o objeto, lê tipo e tamanho do metadado do Storage (não do cliente),
   limita a 10 por chamado e devolve o id.
3. Ler com `createSignedUrl` (curta duração). `support_ticket_attachments(ticket_id)`
   lista, para qualquer lado da conversa.

Quem enxerga: quem abriu, a loja (se o chamado é dela), e a equipe de suporte
**com o segundo fator** (`support_ticket_can_access` passa por `admin_require`).
Upload sem `attach_support_file` há mais de 24h é apagado pelo despacho.
Os dois apps e o admin usam `@vez/supabase/attachments` para validar, subir,
registrar e abrir o arquivo por URL assinada; quando o bucket não existe no
ambiente, a tela mostra esse estado em vez de tratar como erro de formato.

---

## Autenticador perdido

- **Códigos de recuperação.** Com a sessão em aal2, `mfa_recovery_generate_codes()`
  devolve 10 códigos `XXXXX-XXXXX`, mostrados uma vez; gerar de novo invalida os
  anteriores. `mfa_recovery_status()` diz quantos restam.
- **Usar um código.** Entrando só com a senha (aal1):
  `POST /functions/v1/mfa-recovery {"action":"redeem","code":"…"}`. Cinco erros
  em 15 minutos seguram a conta (`rate_limited`). Certo: os fatores saem, as
  sessões caem, e no próximo login o painel pede um autenticador novo.
- **Admin redefine outra pessoa.** Papel `admin` em aal2:
  `{"action":"reset_member","user_id":"…"}`. Auditado ("Redefiniu o segundo fator
  de …"); não vale para o próprio fator.
- Nos dois casos a pessoa recebe e-mail — é o que denuncia uma recuperação que
  ela não fez. O admin mostra os códigos uma única vez em Configurações, aceita
  um código na barreira de MFA e permite que outro admin redefina o fator pela
  aba Equipe e acessos.
