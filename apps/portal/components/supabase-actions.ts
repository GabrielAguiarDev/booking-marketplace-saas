"use client";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";

import type { ApplicationInput, InvoiceCharge, ScheduleImpact, TimeWindow } from "./model";
import { PHOTO_BUCKET } from "./photo-bucket";
import type { PortalActions } from "./store";

type Failure = { message: string } | null;

/** Toda escrita do P6 termina aqui: ou levanta com frase de gente, ou recarrega. */
function check(error: Failure, message: string): void {
  if (!error) return;
  if (/row-level security|violates row-level/i.test(error.message)) {
    throw new Error(`${message} O seu papel nesta loja não permite esta alteração.`);
  }
  if (/business_hours_order|professional_schedules_order/i.test(error.message)) {
    throw new Error("O fim do turno precisa ser depois do começo.");
  }
  if (/services_duration_positive/i.test(error.message)) {
    throw new Error("A duração precisa ficar entre 5 e 480 minutos.");
  }
  if (/establishment_photos_storage_path_format/i.test(error.message)) {
    throw new Error("Nome de arquivo não aceito. Use letras, números, ponto ou hífen.");
  }
  throw new Error(`${message} (${error.message})`);
}

/** A frase que a Edge Function mandou no corpo do erro, ou a de reserva. */
async function functionError(error: { context?: unknown }, fallback: string): Promise<Error> {
  const context = error.context instanceof Response ? error.context : null;
  const payload = context
    ? ((await context.json().catch(() => null)) as { error?: { message?: string } } | null)
    : null;
  return new Error(payload?.error?.message || fallback);
}

/**
 * Reescreve por inteiro os turnos de um dia.
 *
 * Mesma decisão do `mobile-staff` para "quem faz o quê": comparar dois
 * conjuntos no navegador e emitir só as diferenças erra em silêncio quando
 * duas pessoas editam a mesma escala. Apagar e reinserir é uma operação que
 * ou vale inteira ou falha inteira.
 */
function windowRows(windows: TimeWindow[]): TimeWindow[] {
  return windows
    .map((window) => ({ startsAt: window.startsAt.slice(0, 5), endsAt: window.endsAt.slice(0, 5) }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

type ImpactRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customer_name: string;
  service_name: string;
  professional_name: string;
};

function toImpact(rows: ImpactRow[] | null): ScheduleImpact[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    customerName: row.customer_name,
    serviceName: row.service_name,
    professionalName: row.professional_name,
  }));
}

/** Escritas do P2; P5 e P6 ampliam este objeto, mantendo `router.refresh()`. */
export function createPortalActions(refresh: () => void): PortalActions {
  const supabase = createBrowserSupabaseClient();

  return {
    createApplication: async (application: ApplicationInput) => {
      const { data, error } = await supabase.functions.invoke("create-establishment", {
        body: application,
      });
      if (error) {
        const context = error.context as Response | undefined;
        if (context) {
          const payload = (await context.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(payload?.error?.message || error.message);
        }
        throw new Error(error.message);
      }
      refresh();
      return (data as { establishment_id: string }).establishment_id;
    },
    resubmitApplication: async (establishmentId, application) => {
      const { error } = await supabase.rpc("resubmit_establishment_application", {
        p_establishment_id: establishmentId,
        p_application: application,
      });
      if (error) throw new Error(error.message);
      refresh();
    },

    /* ── Operação (P5) ─────────────────────────────────────────────────── */
    availableSlots: async (input) => {
      const { data, error } = await supabase.rpc("available_slots", {
        p_establishment_id: input.establishmentId,
        p_service_id: input.serviceId,
        p_date: input.date,
        p_professional_id: input.professionalId ?? undefined,
      });
      if (error) throw new Error(`Não foi possível consultar os horários. (${error.message})`);
      return (data ?? []).map((slot) => ({
        professionalId: slot.professional_id,
        startsAt: slot.slot_start,
        endsAt: slot.slot_end,
      }));
    },

    createGuestAppointment: async (input) => {
      const { data, error } = await supabase.rpc("portal_create_guest_appointment", {
        p_establishment_id: input.establishmentId,
        // A função aceita NULL ("toda a equipe"), embora o gerador não
        // represente nulabilidade de parâmetros SQL sem valor padrão.
        p_professional_id: input.professionalId as string,
        p_service_id: input.serviceId,
        p_starts_at: input.startsAt,
        p_guest_name: input.guestName,
        p_guest_phone: input.guestPhone ?? undefined,
        p_notes: input.notes ?? undefined,
      });
      if (error) throw new Error(error.message);
      refresh();
      return data;
    },

    approveAppointment: async (id) => {
      const result = await supabase
        .from("appointments")
        .update({ status: "confirmed" })
        .eq("id", id)
        .select("id")
        .single();
      check(result.error, "Não foi possível aprovar a reserva.");
      refresh();
    },

    refuseAppointment: async (id, reason) => {
      if (reason.trim().length < 3) throw new Error("Informe o motivo da recusa.");
      const result = await supabase
        .from("appointments")
        .update({
          status: "cancelled_by_establishment",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason.trim(),
        })
        .eq("id", id)
        .select("id")
        .single();
      check(result.error, "Não foi possível recusar a reserva.");
      refresh();
    },

    completeAppointment: async (id) => {
      const result = await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", id)
        .select("id")
        .single();
      check(result.error, "Não foi possível concluir o atendimento.");
      refresh();
    },

    markAppointmentNoShow: async (id) => {
      const result = await supabase
        .from("appointments")
        .update({ status: "no_show" })
        .eq("id", id)
        .select("id")
        .single();
      check(result.error, "Não foi possível registrar a falta.");
      refresh();
    },

    rescheduleAppointment: async (establishmentId, appointmentId, startsAt) => {
      const { error } = await supabase.rpc("portal_reschedule_appointment", {
        p_establishment_id: establishmentId,
        p_appointment_id: appointmentId,
        p_starts_at: startsAt,
      });
      if (error) throw new Error(error.message);
      refresh();
    },

    callQueueEntry: async (id) => {
      const result = await supabase
        .from("queue_entries")
        .update({ status: "called", called_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .single();
      check(result.error, "Não foi possível chamar esta pessoa.");
      refresh();
    },

    seatQueueEntry: async (id) => {
      const result = await supabase
        .from("queue_entries")
        .update({ status: "in_service", served_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .single();
      check(result.error, "Não foi possível iniciar o atendimento.");
      refresh();
    },

    finishQueueEntry: async (id) => {
      const result = await supabase
        .from("queue_entries")
        .update({ status: "done", finished_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .single();
      check(result.error, "Não foi possível concluir o atendimento.");
      refresh();
    },

    markQueueEntryAbsent: async (id) => {
      const result = await supabase
        .from("queue_entries")
        .update({ status: "no_show" })
        .eq("id", id)
        .select("id")
        .single();
      check(result.error, "Não foi possível registrar a ausência.");
      refresh();
    },

    confirmQueueArrival: async (id) => {
      const result = await supabase
        .from("queue_entries")
        .update({ arrived_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .single();
      check(result.error, "Não foi possível confirmar a chegada.");
      refresh();
    },

    addWalkIn: async (input) => {
      const name = input.name.trim();
      const phone = input.phone?.trim() || null;
      if (name.length < 2) throw new Error("Informe o nome de quem chegou.");
      if (phone && !/^[0-9]{10,13}$/.test(phone.replace(/\D/g, ""))) {
        throw new Error("Informe um telefone válido ou deixe o campo vazio.");
      }
      const now = new Date().toISOString();
      const { error } = await supabase.from("queue_entries").insert({
        establishment_id: input.establishmentId,
        customer_id: null,
        guest_name: name,
        guest_phone: phone,
        service_id: input.serviceId,
        source: "counter",
        status: "waiting",
        joined_at: now,
        arrived_at: now,
      });
      check(error, "Não foi possível colocar esta pessoa na fila.");
      refresh();
    },

    reorderQueueEntry: async (establishmentId, entryId, beforeId) => {
      const { error } = await supabase.rpc("portal_reorder_queue_entry", {
        p_establishment_id: establishmentId,
        p_entry_id: entryId,
        p_before_id: beforeId,
      });
      if (error) throw new Error(error.message);
      refresh();
    },

    /* ── Serviços ────────────────────────────────────────────────────────── */
    saveService: async (input) => {
      const payload = {
        establishment_id: input.establishmentId,
        name: input.name,
        description: input.description,
        duration_minutes: input.durationMinutes,
        price_cents: input.priceCents,
        is_active: input.isActive,
      };
      const saved = input.id
        ? await supabase.from("services").update(payload).eq("id", input.id).select("id").single()
        : await supabase.from("services").insert(payload).select("id").single();
      check(saved.error, "Não foi possível salvar o serviço.");
      const serviceId = saved.data!.id;

      const cleared = await supabase
        .from("professional_services")
        .delete()
        .eq("service_id", serviceId);
      check(cleared.error, "Não foi possível salvar quem executa.");
      if (input.professionalIds.length > 0) {
        const linked = await supabase.from("professional_services").insert(
          input.professionalIds.map((professionalId) => ({
            professional_id: professionalId,
            service_id: serviceId,
          })),
        );
        check(linked.error, "Não foi possível salvar quem executa.");
      }
      refresh();
    },

    // Serviço sai de circulação desativado, nunca apagado: `appointments.service_id`
    // é `on delete restrict`, e apagar apagaria o sentido das reservas passadas.
    setServiceActive: async (id, isActive) => {
      const { error } = await supabase
        .from("services")
        .update({ is_active: isActive })
        .eq("id", id);
      check(error, "Não foi possível mudar o serviço.");
      refresh();
    },

    /* ── Equipe ──────────────────────────────────────────────────────────── */
    saveProfessional: async (input) => {
      const payload = {
        establishment_id: input.establishmentId,
        display_name: input.displayName,
        title: input.title,
        is_active: input.isActive,
        user_id: input.userId,
      };
      const saved = input.id
        ? await supabase
            .from("professionals")
            .update(payload)
            .eq("id", input.id)
            .select("id")
            .single()
        : await supabase.from("professionals").insert(payload).select("id").single();
      check(saved.error, "Não foi possível salvar o profissional.");
      const professionalId = saved.data!.id;

      const cleared = await supabase
        .from("professional_services")
        .delete()
        .eq("professional_id", professionalId);
      check(cleared.error, "Não foi possível salvar o que a pessoa faz.");
      if (input.serviceIds.length > 0) {
        const linked = await supabase.from("professional_services").insert(
          input.serviceIds.map((serviceId) => ({
            professional_id: professionalId,
            service_id: serviceId,
          })),
        );
        check(linked.error, "Não foi possível salvar o que a pessoa faz.");
      }
      refresh();
    },

    setProfessionalActive: async (id, isActive) => {
      const { error } = await supabase
        .from("professionals")
        .update({ is_active: isActive })
        .eq("id", id);
      check(error, "Não foi possível mudar o profissional.");
      refresh();
    },

    setMemberRole: async (establishmentId, userId, role) => {
      const { error } = await supabase
        .from("establishment_members")
        .update({ role })
        .eq("establishment_id", establishmentId)
        .eq("user_id", userId);
      check(error, "Não foi possível mudar o acesso.");
      refresh();
    },

    inviteMember: async (input) => {
      const { data, error } = await supabase.functions.invoke<{ invited: boolean }>(
        "establishment-invite",
        {
          body: {
            establishment_id: input.establishmentId,
            email: input.email,
            name: input.name,
            role: input.role,
            professional_id: input.professionalId,
          },
        },
      );
      if (error) {
        const context = error.context as Response | undefined;
        const payload = context
          ? ((await context.json().catch(() => null)) as { error?: { message?: string } } | null)
          : null;
        throw new Error(
          payload?.error?.message ||
            (error.name === "FunctionsFetchError"
              ? "O serviço de convite não está disponível neste ambiente."
              : "Não foi possível enviar o convite. Tente de novo."),
        );
      }
      refresh();
      return { invited: data?.invited ?? true };
    },

    revokeInvitation: async (invitationId) => {
      const { error } = await supabase.rpc("establishment_revoke_invite", {
        p_invitation_id: invitationId,
      });
      check(error, "Não foi possível revogar o convite.");
      refresh();
    },

    /* ── Horários ────────────────────────────────────────────────────────── */
    saveBusinessHours: async (establishmentId, weekday, windows) => {
      const cleared = await supabase
        .from("business_hours")
        .delete()
        .eq("establishment_id", establishmentId)
        .eq("weekday", weekday);
      check(cleared.error, "Não foi possível salvar o funcionamento.");
      const rows = windowRows(windows);
      if (rows.length > 0) {
        const { error } = await supabase.from("business_hours").insert(
          rows.map((window) => ({
            establishment_id: establishmentId,
            weekday,
            opens_at: window.startsAt,
            closes_at: window.endsAt,
          })),
        );
        check(error, "Não foi possível salvar o funcionamento.");
      }
      refresh();
    },

    saveProfessionalSchedule: async (professionalId, weekday, windows) => {
      const cleared = await supabase
        .from("professional_schedules")
        .delete()
        .eq("professional_id", professionalId)
        .eq("weekday", weekday);
      check(cleared.error, "Não foi possível salvar a jornada.");
      const rows = windowRows(windows);
      if (rows.length > 0) {
        const { error } = await supabase.from("professional_schedules").insert(
          rows.map((window) => ({
            professional_id: professionalId,
            weekday,
            starts_at: window.startsAt,
            ends_at: window.endsAt,
          })),
        );
        check(error, "Não foi possível salvar a jornada.");
      }
      refresh();
    },

    saveException: async (input) => {
      const { error } = await supabase.from("schedule_exceptions").insert({
        establishment_id: input.establishmentId,
        professional_id: input.professionalId,
        exception_date: input.date,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        is_available: input.isAvailable,
        reason: input.reason,
      });
      check(error, "Não foi possível salvar a exceção.");
      refresh();
    },

    removeException: async (id) => {
      const { error } = await supabase.from("schedule_exceptions").delete().eq("id", id);
      check(error, "Não foi possível apagar a exceção.");
      refresh();
    },

    /* ── Perfil público, regras e ajustes ────────────────────────────────── */
    savePublicProfile: async (establishmentId, patch) => {
      const { error } = await supabase
        .from("establishments")
        .update({
          description: patch.description,
          address_line: patch.addressLine,
          neighborhood: patch.neighborhood,
          phone: patch.phone,
          accent_color: patch.accentColor,
        })
        .eq("id", establishmentId);
      check(error, "Não foi possível salvar o perfil.");
      refresh();
    },

    saveRules: async (establishmentId, patch) => {
      const { error } = await supabase
        .from("establishments")
        .update({
          ...(patch.bookingMode === undefined ? {} : { booking_mode: patch.bookingMode }),
          ...(patch.slotIntervalMinutes === undefined
            ? {}
            : { slot_interval_minutes: patch.slotIntervalMinutes }),
          ...(patch.minLeadMinutes === undefined ? {} : { min_lead_minutes: patch.minLeadMinutes }),
          ...(patch.depositPercent === undefined ? {} : { deposit_percent: patch.depositPercent }),
          ...(patch.cancellationWindowMinutes === undefined
            ? {}
            : { cancellation_window_minutes: patch.cancellationWindowMinutes }),
        })
        .eq("id", establishmentId);
      check(error, "Não foi possível salvar a regra.");
      refresh();
    },

    saveSettings: async (establishmentId, patch) => {
      const { error } = await supabase
        .from("establishment_settings")
        .update(patch)
        .eq("establishment_id", establishmentId);
      check(error, "Não foi possível salvar o ajuste.");
      refresh();
    },

    /* ── Fotos ───────────────────────────────────────────────────────────── */
    // O caminho `<loja>/<arquivo>` é o que a política do bucket lê para saber
    // de quem é o arquivo; o nome é reescrito para caber na restrição.
    uploadPhoto: async (establishmentId, file) => {
      const extension = (file.name.split(".").pop() ?? "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const path = `${establishmentId}/${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${extension || "jpg"}`;
      const uploaded = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploaded.error) {
        throw new Error(
          /mime|content type/i.test(uploaded.error.message)
            ? "Formato não aceito. Envie JPG, PNG ou WebP."
            : /exceeded|too large/i.test(uploaded.error.message)
              ? "A imagem passa de 5 MB."
              : `Não foi possível enviar a foto. (${uploaded.error.message})`,
        );
      }
      const { error } = await supabase
        .from("establishment_photos")
        .insert({ establishment_id: establishmentId, storage_path: path });
      if (error) {
        // Sem a linha, o arquivo ficaria órfão no bucket e invisível na tela.
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        check(error, "Não foi possível registrar a foto.");
      }
      refresh();
    },

    removePhoto: async (photo) => {
      const { error } = await supabase.from("establishment_photos").delete().eq("id", photo.id);
      check(error, "Não foi possível apagar a foto.");
      await supabase.storage.from(PHOTO_BUCKET).remove([photo.storagePath]);
      refresh();
    },

    /* ── Regra R9 ────────────────────────────────────────────────────────── */
    scheduleImpact: async (input) => {
      const { data, error } = await supabase.rpc("schedule_change_impact", {
        p_establishment_id: input.establishmentId,
        p_professional_id: input.professionalId ?? undefined,
        p_weekday: input.weekday ?? undefined,
        p_windows: windowRows(input.windows).map((window) => ({
          starts_at: window.startsAt,
          ends_at: window.endsAt,
        })),
      });
      if (error) throw new Error(error.message);
      return toImpact(data as ImpactRow[] | null);
    },

    /* ── Pagamento: conta de recebimento e mensalidade ─────────────────── */
    connectReceiving: async (establishmentId) => {
      const { data, error } = await supabase.functions.invoke<{ url: string }>("payment-connect", {
        body: { establishment_id: establishmentId, action: "start" },
      });
      if (error || !data?.url) {
        throw await functionError(
          error ?? {},
          "Não foi possível iniciar a conexão. Tente de novo.",
        );
      }
      return data.url;
    },

    disconnectReceiving: async (establishmentId) => {
      const { error } = await supabase.functions.invoke("payment-connect", {
        body: { establishment_id: establishmentId, action: "disconnect" },
      });
      if (error) throw await functionError(error, "Não foi possível desconectar.");
      refresh();
    },

    payInvoice: async (invoiceId) => {
      const { data, error } = await supabase.functions.invoke<{
        invoice: {
          id: string;
          status: InvoiceCharge["status"];
          amount_cents: number;
          pix_copy_paste: string | null;
          charge_expires_at: string | null;
          paid_at: string | null;
        };
      }>("billing-invoice-pay", { body: { invoice_id: invoiceId } });
      if (error || !data) {
        throw await functionError(error ?? {}, "Não foi possível gerar o Pix da fatura.");
      }
      if (data.invoice.status === "paid") refresh();
      return {
        id: data.invoice.id,
        status: data.invoice.status,
        amountCents: data.invoice.amount_cents,
        pixCopyPaste: data.invoice.pix_copy_paste,
        chargeExpiresAt: data.invoice.charge_expires_at,
        paidAt: data.invoice.paid_at,
      };
    },

    blockImpact: async (input) => {
      const { data, error } = await supabase.rpc("block_impact", {
        p_establishment_id: input.establishmentId,
        p_professional_id: input.professionalId ?? undefined,
        p_date: input.date,
        p_starts_at: input.startsAt ?? undefined,
        p_ends_at: input.endsAt ?? undefined,
      });
      if (error) throw new Error(error.message);
      return toImpact(data as ImpactRow[] | null);
    },
  };
}
