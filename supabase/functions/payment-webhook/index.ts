import { asAdmin } from "../_shared/client.ts";
import { fail, json } from "../_shared/cors.ts";
import {
  activeProviderName,
  applyCharge,
  applyInvoiceCharge,
  merchantFor,
  PAYMENT_COLUMNS,
  type PaymentRow,
  providerByName,
} from "../_shared/payments/store.ts";
import { ProviderError } from "../_shared/payments/types.ts";

/**
 * Recebe os avisos do provedor de pagamento.
 *
 * Roda com `verify_jwt = false`: quem chama é o provedor, não um usuário. A
 * autenticação é a assinatura do webhook, conferida pelo adaptador.
 *
 * O corpo do aviso serve só para saber QUAL cobrança mudou. O estado vem de uma
 * consulta ao provedor, com a nossa credencial — um aviso forjado, mesmo que
 * passasse pela assinatura, não consegue declarar nada como pago.
 *
 * Resposta que não seja 2xx faz o provedor reentregar. É o que se quer quando o
 * aviso chega antes de a nossa linha ter o id da cobrança.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const name = new URL(req.url).searchParams.get("provider") ?? activeProviderName();
  const provider = providerByName(name);
  if (!provider) return fail("provider_unconfigured", "Provedor não configurado.", 503);

  const body = await req.text();
  let event;
  try {
    event = await provider.verifyWebhook({ url: req.url, headers: req.headers, body });
  } catch (error) {
    if (error instanceof ProviderError && error.code === "invalid_signature") {
      return fail("invalid_signature", "Assinatura inválida.", 401);
    }
    console.error("payment-webhook: verificação", error);
    return fail("webhook_failed", "Não foi possível ler o aviso.", 500);
  }
  if (event.kind === "ignored") return json({ ignored: true });

  const admin = asAdmin();

  let payload: unknown = null;
  try {
    payload = JSON.parse(body);
  } catch {
    payload = null;
  }
  const { data: seen } = await admin
    .from("payment_webhook_events")
    .select("id, deliveries")
    .eq("provider", provider.name)
    .eq("event_id", event.eventId)
    .maybeSingle();
  const eventRow = seen
    ? (
        await admin
          .from("payment_webhook_events")
          .update({ deliveries: seen.deliveries + 1 })
          .eq("id", seen.id)
          .select("id")
          .single()
      ).data
    : (
        await admin
          .from("payment_webhook_events")
          .insert({
            provider: provider.name,
            event_id: event.eventId,
            charge_id: event.chargeId,
            payload,
          })
          .select("id")
          .maybeSingle()
      ).data;

  const finish = async (error: string | null) => {
    if (!eventRow) return;
    await admin
      .from("payment_webhook_events")
      .update(error ? { error } : { processed_at: new Date().toISOString(), error: null })
      .eq("id", eventRow.id);
  };

  try {
    const { data: payment } = await admin
      .from("payments")
      .select(PAYMENT_COLUMNS)
      .eq("provider", provider.name)
      .eq("provider_charge_id", event.chargeId)
      .maybeSingle();

    if (payment) {
      const row = payment as unknown as PaymentRow;
      const merchant = await merchantFor(admin, provider, row.establishment_id);
      if (!merchant) throw new Error("loja sem conta conectada");
      await applyCharge(admin, row, await provider.getCharge(merchant, event.chargeId));
      await finish(null);
      return json({ ok: true });
    }

    // Checkout hospedado: a cobrança nasceu na página do provedor e este é o
    // primeiro aviso dela — a nossa linha ainda não tem o id. O aviso diz de
    // qual conta de loja ela é; com a credencial dessa loja lê-se a cobrança, e
    // a referência que nós pusemos nela (`pay_<id>`) aponta a linha.
    if (event.accountId) {
      const { data: account } = await admin
        .from("payment_accounts")
        .select("establishment_id")
        .eq("provider", provider.name)
        .eq("external_account_id", event.accountId)
        .eq("status", "connected")
        .maybeSingle();
      const merchant = account
        ? await merchantFor(admin, provider, account.establishment_id)
        : null;
      const charge = merchant
        ? await provider.getCharge(merchant, event.chargeId).catch(() => null)
        : null;
      if (account && charge?.reference?.startsWith("pay_")) {
        const { data: hosted } = await admin
          .from("payments")
          .select(PAYMENT_COLUMNS)
          .eq("id", charge.reference.slice(4))
          // A referência veio do provedor; a loja tem que ser a dona da conta.
          .eq("establishment_id", account.establishment_id)
          .maybeSingle();
        if (hosted) {
          await applyCharge(admin, hosted as unknown as PaymentRow, charge);
          await finish(null);
          return json({ ok: true });
        }
      }
    }

    const { data: invoice } = await admin
      .from("billing_invoices")
      .select("id")
      .eq("provider", provider.name)
      .eq("provider_charge_id", event.chargeId)
      .maybeSingle();

    if (invoice) {
      await applyInvoiceCharge(admin, invoice.id, await provider.getCharge(null, event.chargeId));
      await finish(null);
      return json({ ok: true });
    }

    // Fatura cujo Pix foi reemitido: o id guardado é o da cobrança nova, mas o
    // dono pode ter pago a anterior. A referência que nós mesmos pusemos na
    // cobrança (`inv_<id>`) ainda diz de que fatura ela é.
    const orphan = await provider.getCharge(null, event.chargeId).catch(() => null);
    if (orphan?.reference?.startsWith("inv_")) {
      await applyInvoiceCharge(admin, orphan.reference.slice(4), orphan);
      await finish(null);
      return json({ ok: true });
    }

    // Ainda não conhecemos esta cobrança: o aviso ganhou a corrida contra o
    // nosso próprio `update`. O provedor reentrega; a conciliação cobre o resto.
    await finish("unknown_charge");
    return fail("unknown_charge", "Cobrança desconhecida.", 409);
  } catch (error) {
    console.error("payment-webhook: aplicação", error);
    await finish(error instanceof Error ? error.message.slice(0, 500) : "erro");
    return fail("webhook_failed", "Não foi possível aplicar o aviso.", 500);
  }
});
