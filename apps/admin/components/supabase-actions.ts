"use client";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";

import type {
  AccessSession,
  AccountSettings,
  AdminData,
  PlanKind,
} from "./model";
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
    request: PromiseLike<{ data: T; error: { message: string; code?: string } | null }>,
  ): Promise<T> => {
    const { data, error } = await request;
    if (error) {
      // O MFA passou a ser exigido no meio da sessão: o servidor leva ao desafio.
      if (error.code === "PVMFA") refresh();
      throw new Error(error.message);
    }
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

  // Vitrine: a imagem sobe direto do navegador para o bucket público
  // `showcase` (a política de Storage confere o papel) e só depois o banco
  // grava o banner, conferindo que o arquivo existe.
  const showcase = supabase.storage.from("showcase");

  const uploadBannerImage = async (file: File) => {
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `banners/${crypto.randomUUID()}.${ext}`;
    const { error } = await showcase.upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(`A imagem não foi enviada: ${error.message}`);
    return path;
  };

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

    startAccessSession: async (establishmentId, reason, minutes) => {
      const startedAt = new Date();
      const id = await changed(
        supabase.rpc("admin_start_access_session", {
          p_establishment_id: establishmentId,
          p_reason: reason,
          p_minutes: minutes,
        }),
      );
      if (!id) throw new Error("O banco não devolveu a sessão de acesso.");
      const session: AccessSession = {
        id,
        establishmentId,
        establishment:
          get().establishments.find((item) => item.id === establishmentId)?.name ??
          "Estabelecimento",
        reason: reason.trim(),
        startedAt: startedAt.toISOString(),
        expiresAt: new Date(startedAt.getTime() + minutes * 60_000).toISOString(),
      };
      return session;
    },

    endAccessSession: (sessionId) =>
      changed(supabase.rpc("admin_end_access_session", { p_session_id: sessionId })).then(
        () => undefined,
      ),

    accountAgenda: async (sessionId, establishmentId) => {
      const { data, error } = await supabase.rpc("admin_account_agenda", {
        p_session_id: sessionId,
        p_establishment_id: establishmentId,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
        customer: row.customer,
        service: row.service,
        professional: row.professional,
        priceCents: row.price_cents,
      }));
    },

    accountServices: async (sessionId, establishmentId) => {
      const { data, error } = await supabase.rpc("admin_account_services", {
        p_session_id: sessionId,
        p_establishment_id: establishmentId,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        durationMinutes: row.duration_minutes,
        priceCents: row.price_cents,
        active: row.is_active,
        professionals: row.professionals,
      }));
    },

    accountProfessionals: async (sessionId, establishmentId) => {
      const { data, error } = await supabase.rpc("admin_account_professionals", {
        p_session_id: sessionId,
        p_establishment_id: establishmentId,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        title: row.title,
        bio: row.bio,
        active: row.is_active,
        services: row.services,
      }));
    },

    accountSettings: async (sessionId, establishmentId) => {
      const { data, error } = await supabase.rpc("admin_account_settings", {
        p_session_id: sessionId,
        p_establishment_id: establishmentId,
      });
      if (error) throw new Error(error.message);
      const row = data?.[0];
      if (!row) throw new Error("Os ajustes desta conta não foram encontrados.");
      const settings: AccountSettings = {
        timezone: row.timezone,
        bookingMode: row.booking_mode,
        cancellationWindowMinutes: row.cancellation_window_minutes,
        depositPercent: row.deposit_percent,
        slotIntervalMinutes: row.slot_interval_minutes,
        minLeadMinutes: row.min_lead_minutes,
        queueRemoteJoin: row.queue_remote_join,
        queueRequireArrival: row.queue_require_arrival,
        queueArrivalMethod: row.queue_arrival_method,
        queuePerProfessional: row.queue_per_professional,
        queueAutoClose: row.queue_auto_close,
        queueCloseAfterMinutes: row.queue_close_after_minutes,
        queueAutoSkip: row.queue_auto_skip,
        queueNotifyEnabled: row.queue_notify_enabled,
        queueNotifyChannel: row.queue_notify_channel,
        autoApprove: row.auto_approve,
        depositRefundable: row.deposit_refundable,
        acceptAppPayment: row.accept_app_payment,
      };
      return settings;
    },

    accountReviews: async (sessionId, establishmentId) => {
      const { data, error } = await supabase.rpc("admin_account_reviews", {
        p_session_id: sessionId,
        p_establishment_id: establishmentId,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        tags: row.tags,
        customer: row.customer,
        professional: row.professional,
        createdAt: row.created_at,
      }));
    },

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

    saveQuotas: (totals, prices = {}) =>
      changed(supabase.rpc("admin_save_quotas", { p_totals: totals, p_prices: prices })).then(
        () => undefined,
      ),

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

    setMfaRequired: (required) =>
      changed(supabase.rpc("admin_set_mfa_required", { p_required: required })).then(
        () => undefined,
      ),

    // Convite usa a Admin API do Auth: vive na Edge Function `admin-invite`,
    // que confere o papel de quem chama e grava papel e auditoria pela RPC.
    inviteTeamMember: async ({ email, name, role }) => {
      const { data, error } = await supabase.functions.invoke<{ invited: boolean }>(
        "admin-invite",
        { body: { email, name, role } },
      );
      if (error) {
        const context = (error as { context?: unknown }).context;
        const body =
          context instanceof Response
            ? ((await context.json().catch(() => null)) as { error?: { message?: string } } | null)
            : null;
        throw new Error(
          body?.error?.message ??
            (error.name === "FunctionsFetchError"
              ? "A função de convite não respondeu. Confira se as Edge Functions estão no ar."
              : "Não foi possível enviar o convite. Tente de novo."),
        );
      }
      refresh();
      return { invited: data?.invited ?? true };
    },

    setTeamRole: (userId, role) =>
      changed(supabase.rpc("admin_set_team_role", { p_user_id: userId, p_role: role })).then(
        () => undefined,
      ),

    removeTeamMember: (userId) =>
      changed(supabase.rpc("admin_remove_team_member", { p_user_id: userId })).then(
        () => undefined,
      ),

    saveBanner: async (input) => {
      const before = input.id ? get().banners.find((b) => b.id === input.id) : undefined;
      if (input.id && !before) throw new Error("Banner não encontrado.");
      if (!before && !input.file) throw new Error("Envie a imagem do banner.");

      const uploaded = input.file ? await uploadBannerImage(input.file) : null;
      const { error } = await supabase.rpc("admin_save_banner", {
        p_id: input.id,
        p_title: input.title,
        p_subtitle: input.subtitle,
        p_image_path: uploaded ?? before!.imagePath,
        p_target_kind: input.targetKind,
        p_target_value: input.targetValue,
        p_starts_at: input.startsAt ?? undefined,
        p_ends_at: input.endsAt ?? undefined,
      });
      if (error) {
        // o banco recusou: a imagem recém-enviada não fica solta no bucket
        if (uploaded) await showcase.remove([uploaded]);
        throw new Error(error.message);
      }
      // a imagem antiga saiu do banner; se a remoção falhar, só sobra o arquivo
      if (uploaded && before) await showcase.remove([before.imagePath]);
      refresh();
    },

    setBannerActive: (id, active) =>
      changed(supabase.rpc("admin_set_banner_active", { p_id: id, p_active: active })).then(
        () => undefined,
      ),

    reorderBanners: (ids) =>
      changed(supabase.rpc("admin_reorder_banners", { p_ids: ids })).then(() => undefined),

    deleteBanner: async (id) => {
      const path = await changed(supabase.rpc("admin_delete_banner", { p_id: id }));
      if (!path) return;
      const { error } = await showcase.remove([path]);
      if (error) {
        throw new Error(
          `O banner saiu da vitrine, mas a imagem ficou no armazenamento: ${error.message}`,
        );
      }
    },

    ticketMessages: async (id) => {
      const { data, error } = await supabase.rpc("admin_support_ticket_messages", {
        p_ticket_id: id,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((message) => ({
        id: message.id,
        author: message.author_name,
        fromStaff: message.from_staff,
        body: message.body,
        at: message.created_at,
      }));
    },

    replyTicket: (id, body, status) =>
      changed(
        supabase.rpc("admin_reply_ticket", { p_ticket_id: id, p_body: body, p_status: status }),
      ).then(() => undefined),

    setTicketStatus: (id, status) =>
      changed(supabase.rpc("admin_set_ticket_status", { p_ticket_id: id, p_status: status })).then(
        () => undefined,
      ),

    setTicketPriority: (id, priority) =>
      changed(
        supabase.rpc("admin_set_ticket_priority", { p_ticket_id: id, p_priority: priority }),
      ).then(() => undefined),

    assignTicket: (id, adminId) =>
      changed(
        supabase.rpc("admin_assign_ticket", {
          p_ticket_id: id,
          // "ninguém": o gerador não representa argumento nulo; o banco lê o UUID zero.
          p_admin_id: adminId ?? "00000000-0000-0000-0000-000000000000",
        }),
      ).then(() => undefined),
  };
}
