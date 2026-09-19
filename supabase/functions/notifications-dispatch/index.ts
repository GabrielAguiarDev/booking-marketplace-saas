import { asAdmin } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";

/**
 * Entrega o que está na caixa de saída (`notification_outbox`).
 *
 * Quem chama é o `pg_cron`, a cada minuto, por `notification_dispatch_kick()`
 * — com o cabeçalho `x-dispatch-secret` igual ao secret
 * `NOTIFICATIONS_DISPATCH_SECRET`. Não há JWT de usuário: a função roda com
 * `verify_jwt = false` (config.toml) e confere o segredo à mão.
 *
 * Cada canal só é despachado se o provedor estiver configurado por secret.
 * Canal sem provedor não é "enviado de mentira": as linhas vão para
 * `unconfigured` e voltam sozinhas quando o secret aparecer.
 *
 *   push   PUSH_PROVIDER=expo (EXPO_ACCESS_TOKEN se o projeto exige token)
 *   email  EMAIL_PROVIDER=resend|postmark + EMAIL_FROM
 *          + RESEND_API_KEY ou POSTMARK_SERVER_TOKEN
 *   sms, whatsapp  sem provedor implementado — sempre `unconfigured`
 *
 * O banco decide tentativa e espera (`notification_complete`); aqui só se
 * classifica cada entrega em sent / retry / failed / skipped.
 */

type Channel = "push" | "email" | "sms" | "whatsapp";
type Outcome = "sent" | "retry" | "failed" | "skipped";

type Claimed = {
  id: string;
  channel: Channel;
  app: "cliente" | "staff" | null;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  attempts: number;
  email: string | null;
  phone: string | null;
  expo_tokens: string[];
};

type Result = {
  id: string;
  outcome: Outcome;
  error?: string;
  provider_message_id?: string;
  disable_tokens?: string[];
};

const env = (name: string) => (Deno.env.get(name) ?? "").trim();

function pushConfig() {
  if (env("PUSH_PROVIDER").toLowerCase() !== "expo") return null;
  return { accessToken: env("EXPO_ACCESS_TOKEN") || null };
}

function emailConfig() {
  const provider = env("EMAIL_PROVIDER").toLowerCase();
  const from = env("EMAIL_FROM");
  if (!from) return null;
  if (provider === "resend" && env("RESEND_API_KEY")) {
    return { provider, from, key: env("RESEND_API_KEY"), replyTo: env("EMAIL_REPLY_TO") || null };
  }
  if (provider === "postmark" && env("POSTMARK_SERVER_TOKEN")) {
    return {
      provider,
      from,
      key: env("POSTMARK_SERVER_TOKEN"),
      replyTo: env("EMAIL_REPLY_TO") || null,
    };
  }
  return null;
}

// ── push (Expo) ───────────────────────────────────────────────────────────────

const EXPO_URL = "https://exp.host/--/api/v2/push/send";

async function sendPush(rows: Claimed[], accessToken: string | null): Promise<Result[]> {
  const results = new Map<string, Result>();
  const messages: { row: Claimed; token: string; payload: Record<string, unknown> }[] = [];

  for (const row of rows) {
    if (!row.expo_tokens.length) {
      results.set(row.id, { id: row.id, outcome: "skipped", error: "no_device" });
      continue;
    }
    for (const token of row.expo_tokens) {
      messages.push({
        row,
        token,
        payload: {
          to: token,
          title: row.title,
          body: row.body,
          sound: "default",
          data: { ...row.data, kind: row.kind, notification_id: row.id },
        },
      });
    }
  }

  // Por linha: quantos tickets deram certo, e quais tokens o Expo recusou.
  const tally = new Map<string, { ok: number; dead: string[]; errors: string[] }>();
  const note = (id: string) => {
    if (!tally.has(id)) tally.set(id, { ok: 0, dead: [], errors: [] });
    return tally.get(id)!;
  };

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    let tickets: { status: string; id?: string; message?: string; details?: { error?: string } }[];
    try {
      const response = await fetch(EXPO_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(chunk.map((m) => m.payload)),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.data)) {
        const reason = `expo_http_${response.status}: ${JSON.stringify(payload?.errors ?? payload).slice(0, 200)}`;
        for (const m of chunk) note(m.row.id).errors.push(reason);
        continue;
      }
      tickets = payload.data;
    } catch (error) {
      for (const m of chunk)
        note(m.row.id).errors.push(`expo_network: ${String(error).slice(0, 200)}`);
      continue;
    }

    chunk.forEach((m, index) => {
      const ticket = tickets[index];
      const entry = note(m.row.id);
      if (ticket?.status === "ok") entry.ok += 1;
      else if (ticket?.details?.error === "DeviceNotRegistered") entry.dead.push(m.token);
      else entry.errors.push(`${ticket?.details?.error ?? "expo_error"}: ${ticket?.message ?? ""}`);
    });
  }

  for (const [id, entry] of tally) {
    if (entry.ok > 0) {
      results.set(id, { id, outcome: "sent", disable_tokens: entry.dead });
    } else if (entry.errors.length === 0) {
      results.set(id, {
        id,
        outcome: "skipped",
        error: "device_not_registered",
        disable_tokens: entry.dead,
      });
    } else {
      results.set(id, {
        id,
        outcome: "retry",
        error: entry.errors[0],
        disable_tokens: entry.dead,
      });
    }
  }

  return rows.map(
    (row) => results.get(row.id) ?? { id: row.id, outcome: "retry", error: "no_ticket" },
  );
}

// ── e-mail ────────────────────────────────────────────────────────────────────

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function emailHtml(row: Claimed) {
  const paragraphs = row.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replaceAll("\n", "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
<h2 style="font-size:18px;margin:0 0 16px">${escapeHtml(row.title)}</h2>${paragraphs}
<p style="margin:24px 0 0;color:#777;font-size:12px">Vez · aviso automático</p></body></html>`;
}

async function sendEmail(
  row: Claimed,
  config: NonNullable<ReturnType<typeof emailConfig>>,
): Promise<Result> {
  if (!row.email) return { id: row.id, outcome: "skipped", error: "no_email" };

  const text = `${row.body}\n\n— Vez · aviso automático`;
  let response: Response;
  try {
    response =
      config.provider === "resend"
        ? await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: config.from,
              to: [row.email],
              subject: row.title,
              text,
              html: emailHtml(row),
              ...(config.replyTo ? { reply_to: config.replyTo } : {}),
            }),
          })
        : await fetch("https://api.postmarkapp.com/email", {
            method: "POST",
            headers: {
              "X-Postmark-Server-Token": config.key,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              From: config.from,
              To: row.email,
              Subject: row.title,
              TextBody: text,
              HtmlBody: emailHtml(row),
              MessageStream: "outbound",
              ...(config.replyTo ? { ReplyTo: config.replyTo } : {}),
            }),
          });
  } catch (error) {
    return { id: row.id, outcome: "retry", error: `email_network: ${String(error).slice(0, 200)}` };
  }

  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
    return {
      id: row.id,
      outcome: "sent",
      provider_message_id: String(payload?.id ?? payload?.MessageID ?? ""),
    };
  }
  const reason = `${config.provider}_http_${response.status}: ${JSON.stringify(payload).slice(0, 200)}`;
  // 429 e 5xx passam; 4xx é o pedido que está errado (remetente não
  // verificado, endereço inválido) e repetir não conserta.
  const transient = response.status === 429 || response.status >= 500;
  return { id: row.id, outcome: transient ? "retry" : "failed", error: reason };
}

// ── limpeza de anexo abandonado ───────────────────────────────────────────────

async function pruneOrphanAttachments(admin: ReturnType<typeof asAdmin>) {
  const { data, error } = await admin.rpc("support_attachments_prunable");
  if (error || !data?.length) return 0;
  const names = (data as { name: string }[]).slice(0, 100).map((row) => row.name);
  const { error: removeError } = await admin.storage.from("support-attachments").remove(names);
  if (removeError) {
    console.error("notifications-dispatch: limpeza de anexos falhou", removeError);
    return 0;
  }
  const { error: metadataError } = await admin.rpc("support_attachments_prune_metadata", {
    p_names: names,
  });
  if (metadataError) {
    console.error("notifications-dispatch: limpeza dos metadados de anexos falhou", metadataError);
  }
  return names.length;
}

/** Compara segredos sem encerrar no primeiro byte diferente. */
function secretMatches(received: string, expected: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(received);
  const right = encoder.encode(expected);
  let different = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    different |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return different === 0;
}

// ── entrada ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const secret = env("NOTIFICATIONS_DISPATCH_SECRET");
  if (secret.length < 32) {
    return fail(
      "unconfigured",
      "NOTIFICATIONS_DISPATCH_SECRET não está configurado; o despacho está desligado.",
      503,
    );
  }
  const suppliedSecret = req.headers.get("x-dispatch-secret") ?? "";
  if (!secretMatches(suppliedSecret, secret)) {
    return fail("unauthorized", "Segredo do despacho inválido.", 401);
  }

  const admin = asAdmin();
  const push = pushConfig();
  const email = emailConfig();

  const configured: Channel[] = [];
  if (push) configured.push("push");
  if (email) configured.push("email");
  const unconfigured = (["push", "email", "sms", "whatsapp"] as Channel[]).filter(
    (channel) => !configured.includes(channel),
  );

  const { data: held, error: holdError } = await admin.rpc("notification_hold_unconfigured", {
    p_channels: unconfigured,
  });
  if (holdError) console.error("notifications-dispatch: hold falhou", holdError);

  const summary: Record<string, number> = { sent: 0, retry: 0, failed: 0, skipped: 0 };
  const started = Date.now();

  while (configured.length && Date.now() - started < 40_000) {
    const { data: rows, error } = await admin.rpc("notification_claim", {
      p_channels: configured,
      p_limit: 100,
    });
    if (error) {
      console.error("notifications-dispatch: claim falhou", error);
      return fail("claim_failed", "Não foi possível ler a caixa de saída.", 500);
    }
    const batch = (rows ?? []) as Claimed[];
    if (!batch.length) break;

    const results: Result[] = [];
    const pushRows = batch.filter((row) => row.channel === "push");
    if (pushRows.length && push) results.push(...(await sendPush(pushRows, push.accessToken)));
    for (const row of batch.filter((r) => r.channel === "email")) {
      results.push(await sendEmail(row, email!));
    }

    const { error: completeError } = await admin.rpc("notification_complete", {
      p_results: results,
    });
    if (completeError) {
      // As linhas ficam em `sending` e voltam em 10 minutos pelo claim.
      console.error("notifications-dispatch: complete falhou", completeError);
      return fail("complete_failed", "Entregas feitas, mas o resultado não foi gravado.", 500);
    }
    for (const result of results) summary[result.outcome] += 1;
    if (batch.length < 100) break;
  }

  const pruned = await pruneOrphanAttachments(admin);

  return json({
    configured,
    unconfigured,
    held_unconfigured: held ?? 0,
    ...summary,
    pruned_attachments: pruned,
  });
});
