"use client";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";

import type { AdminData, PlanKind } from "./model";
import { categoryValue } from "./model";
import type { AdminActions } from "./store";

type GetData = () => AdminData;

/**
 * Escritas reais do painel. As funções SQL validam autorização e regra de
 * negócio, fazem a alteração e registram a auditoria na mesma transação.
 */
export function createSupabaseActions(get: GetData, refresh: () => void): AdminActions {
  const supabase = createBrowserSupabaseClient();

  const changed = async <T>(
    request: PromiseLike<{ data: T; error: { message: string } | null }>,
  ): Promise<T> => {
    const { data, error } = await request;
    if (error) throw new Error(error.message);
    refresh();
    return data;
  };

  const decideApplication = (
    id: string,
    decision: "approved" | "rejected" | "correction",
    plan: PlanKind,
    message: string,
  ) =>
    changed(
      supabase.rpc("admin_decide_application", {
        p_establishment_id: id,
        p_decision: decision,
        p_plan: plan,
        p_message: message,
      }),
    ).then(() => undefined);

  return {
    approveApplication: (id, plan, message) => decideApplication(id, "approved", plan, message),
    rejectApplication: (id, message) => decideApplication(id, "rejected", "commission", message),
    requestCorrection: (id, message) => decideApplication(id, "correction", "commission", message),

    suspendEstablishments: (ids, reason) =>
      changed(
        supabase.rpc("admin_set_establishment_status", {
          p_ids: ids,
          p_status: "suspended",
          p_reason: reason,
        }),
      ).then(() => undefined),

    reactivateEstablishment: (id) =>
      changed(
        supabase.rpc("admin_set_establishment_status", {
          p_ids: [id],
          p_status: "active",
          p_reason: "",
        }),
      ).then(() => undefined),

    changePlan: (ids, plan) =>
      changed(supabase.rpc("admin_change_plan", { p_ids: ids, p_kind: plan })).then(
        () => undefined,
      ),

    applyDiscount: (ids, percent, months) =>
      changed(
        supabase.rpc("admin_apply_discount", {
          p_ids: ids,
          p_percent: percent,
          p_months: months,
        }),
      ).then(() => undefined),

    registerContact: (establishmentId, note) =>
      changed(
        supabase.rpc("admin_register_contact", {
          p_establishment_id: establishmentId,
          p_note: note,
        }),
      ).then(() => undefined),

    startAccessSession: (establishmentId, reason, minutes) =>
      changed(
        supabase.rpc("admin_start_access_session", {
          p_establishment_id: establishmentId,
          p_reason: reason,
          p_minutes: minutes,
        }),
      ).then(() => undefined),

    openCity: ({ name, uf, quota, priceCents }) =>
      changed(
        supabase.rpc("admin_open_city", {
          p_name: name,
          p_uf: uf,
          p_quota: quota,
          p_price_cents: priceCents,
        }),
      ).then(() => undefined),

    setCityStatus: (id, status) =>
      changed(
        supabase.rpc("admin_set_city_status", {
          p_city_id: id,
          p_status: status,
        }),
      ).then(() => undefined),

    saveQuotas: (totals) =>
      changed(supabase.rpc("admin_save_quotas", { p_totals: totals })).then(() => undefined),

    updatePlan: (id, patch, cityPrices = {}) => {
      const current = get().plans.find((plan) => plan.id === id);
      if (!current) return Promise.reject(new Error("Plano não encontrado."));
      const maxProfessionals = Object.hasOwn(patch, "maxProfessionals")
        ? patch.maxProfessionals
        : current.maxProfessionals;
      return changed(
        supabase.rpc("admin_update_plan", {
          p_plan_id: id,
          p_commission_percent: patch.commissionPercent ?? current.commissionPercent ?? 0,
          p_max_professionals: maxProfessionals as number,
          p_city_prices: cityPrices,
        }),
      ).then(() => undefined);
    },

    resendInvoice: () =>
      Promise.reject(
        new Error(
          "O reenvio será ligado junto ao provedor de cobrança; nenhuma fatura fictícia foi enviada.",
        ),
      ),

    saveCatalogItem: (id, patch) =>
      changed(
        supabase.rpc("admin_save_catalog_item", {
          p_id: id,
          p_name: patch.name,
          p_duration_minutes: patch.durationMinutes,
          p_synonyms: patch.synonyms,
        }),
      ).then(() => undefined),

    createCatalogItem: async (group, name) => {
      const id = await changed(
        supabase.rpc("admin_create_catalog_item", {
          p_category: categoryValue(group),
          p_name: name,
        }),
      );
      if (!id) throw new Error("O banco não devolveu o item criado.");
      return id;
    },

    resolveSuggestion: (id, resolution, targetItemId) =>
      changed(
        supabase.rpc("admin_resolve_suggestion", {
          p_key: id,
          p_resolution: resolution,
          // O banco ignora o alvo ao aprovar/recusar. O gerador não representa
          // a nulabilidade de argumentos de função, então enviamos um UUID nulo.
          p_target_id: targetItemId ?? "00000000-0000-0000-0000-000000000000",
        }),
      ).then(() => undefined),

    decideReport: (id, decision, motive, note, notifyAuthor) =>
      changed(
        supabase.rpc("admin_decide_report", {
          p_report_id: id,
          p_decision: decision,
          p_motive: motive,
          p_note: note,
          p_notify_author: notifyAuthor,
        }),
      ).then(() => undefined),

    requestClarification: (id, message) =>
      changed(
        supabase.rpc("admin_request_clarification", {
          p_report_id: id,
          p_message: message,
        }),
      ).then(() => undefined),

    registerCustomerContact: (id, note) =>
      changed(
        supabase.rpc("admin_register_customer_contact", {
          p_user_id: id,
          p_note: note,
        }),
      ).then(() => undefined),

    setCustomerBlocked: (id, blocked, reason) =>
      changed(
        supabase.rpc("admin_set_customer_blocked", {
          p_user_id: id,
          p_blocked: blocked,
          p_reason: reason,
        }),
      ).then(() => undefined),

    updateParam: (key, value) =>
      changed(supabase.rpc("admin_update_param", { p_key: key, p_value: value })).then(
        () => undefined,
      ),
  };
}
