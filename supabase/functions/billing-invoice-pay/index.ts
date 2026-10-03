import { asAdmin, asUser } from "../_shared/client.ts";
import { corsHeaders, fail, json } from "../_shared/cors.ts";
import { PIX_TTL_MINUTES } from "../_shared/payments/core.ts";
import {
  activeProvider,
  applyInvoiceCharge,
  providerByName,
  webhookUrl,
} from "../_shared/payments/store.ts";

/**
 * Gera (ou devolve) o Pix de uma fatura de mensalidade.
 *
 * A fatura já existe no banco — nasce todo mês por `billing_generate_invoices`.
 * A cobrança só é criada aqui, quando o dono abre a fatura para pagar: Pix
 * expira, e gerar um por loja todo mês seria criar código que ninguém leu.
 *
 * Quem recebe é a conta da própria Vez (`merchant` nulo), sem split.
 *
 * Chamar de novo confere a cobrança no provedor antes de responder, então a
 * mesma chamada serve para "já paguei?".
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const {
    data: { user },
  } = await asUser(req).auth.getUser();
  if (!user) return fail("unauthorized", "Entre para continuar.", 401);

  let body: { invoice_id?: string };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_body", "Corpo da requisição inválido.");
  }
  if (!body.invoice_id) return fail("missing_fields", "Informe a fatura.");

  const admin = asAdmin();
  const columns =
    "id, establishment_id, amount_cents, status, period_start, provider, provider_charge_id," +
    " pix_copy_paste, charge_expires_at, paid_at";

  const { data: found, error } = await admin
    .from("billing_invoices")
    .select(columns)
    .eq("id", body.invoice_id)
    .maybeSingle();
  if (error) return fail("lookup_failed", "Não foi possível ler a fatura.", 500);

  type Invoice = {
    id: string;
    establishment_id: string;
    amount_cents: number;
    status: "open" | "paid" | "void";
    period_start: string;
    provider: string | null;
    provider_charge_id: string | null;
    pix_copy_paste: string | null;
    charge_expires_at: string | null;
    paid_at: string | null;
  };
  const invoice = found as unknown as Invoice | null;

  const { data: member } = invoice
    ? await admin
        .from("establishment_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("establishment_id", invoice.establishment_id)
        .maybeSingle()
    : { data: null };
  // Fatura de outra loja responde igual a fatura inexistente.
  if (!invoice || member?.role !== "owner") {
    return fail("not_found", "Fatura não encontrada.", 404);
  }

  const reply = (row: Invoice) =>
    json({
      invoice: {
        id: row.id,
        status: row.status,
        amount_cents: row.amount_cents,
        pix_copy_paste: row.status === "open" ? row.pix_copy_paste : null,
        charge_expires_at: row.charge_expires_at,
        paid_at: row.paid_at,
      },
    });
  const reread = async () =>
    (await admin.from("billing_invoices").select(columns).eq("id", invoice.id).single())
      .data as unknown as Invoice;

  if (invoice.status !== "open") return reply(invoice);
  if (!user.email) return fail("email_required", "Sua conta precisa de um e-mail para pagar.", 409);

  try {
    if (invoice.provider && invoice.provider_charge_id) {
      const previous = providerByName(invoice.provider);
      if (!previous) return fail("payment_unavailable", "Cobrança indisponível.", 503);

      const expired =
        !invoice.charge_expires_at || new Date(invoice.charge_expires_at).getTime() <= Date.now();
      const charge = expired
        ? await previous.cancelCharge(null, invoice.provider_charge_id)
        : await previous.getCharge(null, invoice.provider_charge_id);

      if (charge.status === "paid") {
        await applyInvoiceCharge(admin, invoice.id, charge);
        return reply(await reread());
      }
      if (charge.status === "pending" || charge.status === "authorized") return reply(invoice);
      // Cancelada, vencida ou recusada: segue para emitir outra.
    }

    const provider = activeProvider();
    if (!provider) return fail("payment_unavailable", "Cobrança indisponível.", 503);

    const expiresAt = new Date(Date.now() + PIX_TTL_MINUTES * 60_000);
    const charge = await provider.createCharge(null, {
      reference: `inv_${invoice.id}`,
      // Cada emissão é uma cobrança nova; a anterior já foi cancelada acima.
      idempotencyKey: `inv_${invoice.id}_${expiresAt.getTime()}`,
      method: "pix",
      amountCents: invoice.amount_cents,
      platformFeeCents: 0,
      description: `Mensalidade Vez — ${invoice.period_start.slice(0, 7)}`,
      payer: { email: user.email },
      expiresAt,
      notificationUrl: webhookUrl(provider.name),
    });

    const { error: saveError } = await admin
      .from("billing_invoices")
      .update({
        provider: provider.name,
        provider_charge_id: charge.id,
        pix_copy_paste: charge.pixCopyPaste,
        charge_expires_at: expiresAt.toISOString(),
        provider_payload: charge.raw,
      })
      .eq("id", invoice.id)
      .eq("status", "open");
    if (saveError) throw new Error(saveError.message);

    return reply(await reread());
  } catch (providerError) {
    console.error("billing-invoice-pay: provedor", providerError);
    return fail("provider_failed", "Não foi possível gerar o Pix. Tente de novo.", 502);
  }
});
