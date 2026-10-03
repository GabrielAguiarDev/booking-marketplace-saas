import { asAdmin } from "../_shared/client.ts";
import { fail, json } from "../_shared/cors.ts";
import { refundDueCents, safeEqual } from "../_shared/payments/core.ts";
import {
  applyCharge,
  chargeOf,
  closePending,
  merchantFor,
  type PaymentRow,
  providerByName,
} from "../_shared/payments/store.ts";

/**
 * Confere com o provedor o que está vivo no banco.
 *
 * Quem chama é o `pg_cron`, a cada minuto, por `payment_reconcile_kick()` — com
 * o cabeçalho `x-reconcile-secret` igual ao secret `PAYMENTS_RECONCILE_SECRET`.
 * Roda com `verify_jwt = false` e confere o segredo à mão, como
 * `notifications-dispatch`.
 *
 * Três trabalhos, todos idempotentes:
 *
 *   1. Estorno devido (`refund_requested_cents > refunded_cents`): o
 *      cancelamento marcou, aqui se devolve.
 *   2. Cobrança pendente de reserva cancelada ou já vencida: encerra no
 *      provedor (Pix cancelado, página de cartão fechada), para ninguém pagar
 *      por uma reserva que não existe.
 *   3. Cobrança pendente comum: consulta. É a rede de segurança do webhook.
 *
 * Falha em uma linha não derruba as outras: ela volta na próxima rodada,
 * porque `payment_claim_work` só a esconde por dois minutos.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", 405);

  const secret = (Deno.env.get("PAYMENTS_RECONCILE_SECRET") ?? "").trim();
  if (!secret) return fail("unconfigured", "Conciliação não configurada.", 503);
  if (!safeEqual(req.headers.get("x-reconcile-secret") ?? "", secret)) {
    return fail("unauthorized", "Segredo inválido.", 401);
  }

  const admin = asAdmin();
  const { data, error } = await admin.rpc("payment_claim_work", { p_limit: 25 });
  if (error) {
    console.error("payment-reconcile: claim", error);
    return fail("claim_failed", "Não foi possível reservar trabalho.", 500);
  }

  const rows = (data ?? []) as PaymentRow[];
  const summary = { claimed: rows.length, refunded: 0, cancelled: 0, synced: 0, failed: 0 };

  for (const row of rows) {
    try {
      if (!row.provider || (!row.provider_charge_id && !row.provider_checkout_id)) {
        // Linha que nunca chegou ao provedor: `payment-create` morreu no meio.
        const stale = Date.now() - new Date(row.expires_at ?? 0).getTime() > 0;
        if (stale) {
          await admin
            .from("payments")
            .update({ status: "failed" })
            .eq("id", row.id)
            .eq("status", row.status);
          summary.cancelled += 1;
        }
        continue;
      }

      const provider = providerByName(row.provider);
      if (!provider) throw new Error(`provedor ${row.provider} não configurado`);
      const merchant = await merchantFor(admin, provider, row.establishment_id);
      if (!merchant) throw new Error("loja sem conta conectada");

      const due = refundDueCents(row);
      if (due > 0 && row.provider_charge_id) {
        // A chave amarra o estorno ao total pedido: repetir a rodada não
        // devolve duas vezes.
        const charge = await provider.refund(
          merchant,
          row.provider_charge_id,
          due,
          `refund_${row.id}_${row.refund_requested_cents}`,
        );
        await applyCharge(admin, row, charge);
        summary.refunded += 1;
        continue;
      }

      if (row.status === "pending" || row.status === "authorized") {
        const { data: appointment } = await admin
          .from("appointments")
          .select("status")
          .eq("id", row.appointment_id)
          .maybeSingle();
        const active = appointment && ["scheduled", "confirmed"].includes(appointment.status);
        const expired = row.expires_at && new Date(row.expires_at).getTime() <= Date.now();

        if (!active || expired) {
          await closePending(admin, provider, merchant, row);
          summary.cancelled += 1;
          continue;
        }
      }

      // Checkout hospedado ainda sem pagamento não tem o que aplicar.
      const charge = await chargeOf(provider, merchant, row);
      if (charge) await applyCharge(admin, row, charge);
      summary.synced += 1;
    } catch (rowError) {
      summary.failed += 1;
      console.error("payment-reconcile: linha", row.id, rowError);
    }
  }

  return json(summary);
});
