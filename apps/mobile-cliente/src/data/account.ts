import { useAsync } from "@vez/mobile-kit/async";

import { supabase } from "../../lib/supabase";
import type { AddressValue, PersonalValue } from "../domain/account-validation";
import { readErrorBody } from "./appointments";
import type { EstablishmentRow } from "./establishments";
import { type AddressRow, customerDb, type NotificationPrefsRow } from "./customer-db";

/**
 * Conta do cliente: dados pessoais, endereços, favoritos, avisos e exclusão.
 *
 * Tudo passa pela RLS "só o próprio" — nenhum filtro por `customer_id` nas
 * leituras, pelo mesmo motivo de `useAppointments`: a regra mora num lugar só.
 * Nas escritas o id vai explícito porque o `with check` exige.
 */

export type Result<T = null> = { ok: true; value: T } | { ok: false; message: string };

type PgError = { code?: string; message: string; hint?: string | null };

/** `P0001` com mensagem do banco é para o usuário ler; o resto é genérico. */
function failure(error: PgError, fallback: string): { ok: false; message: string } {
  if (error.code === "P0001" || error.code === "P0002")
    return { ok: false, message: error.message };
  return { ok: false, message: fallback };
}

// ---------------------------------------------------------------------------
// Dados pessoais
// ---------------------------------------------------------------------------

export async function updatePersonal(userId: string, value: PersonalValue): Promise<Result> {
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: value.fullName, phone: value.phone })
    .eq("id", userId);
  if (error) return failure(error, "Não foi possível salvar. Tente de novo.");
  return { ok: true, value: null };
}

// ---------------------------------------------------------------------------
// Endereços
// ---------------------------------------------------------------------------

const ADDRESS_COLUMNS =
  "id, customer_id, label, street, number, complement, neighborhood, postal_code, latitude, longitude, is_default, created_at, updated_at";

export function useAddresses(enabled: boolean) {
  return useAsync(
    "customer-addresses",
    async () => {
      const { data, error } = await customerDb
        .from("customer_addresses")
        .select(ADDRESS_COLUMNS)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as AddressRow[];
    },
    { enabled },
  );
}

export type Coordinates = { latitude: number; longitude: number } | null;

export async function saveAddress(input: {
  id: string | null;
  customerId: string;
  value: AddressValue;
  coords: Coordinates;
  makeDefault: boolean;
}): Promise<Result<{ id: string }>> {
  const row = {
    ...input.value,
    latitude: input.coords?.latitude ?? null,
    longitude: input.coords?.longitude ?? null,
  };

  const query = input.id
    ? customerDb.from("customer_addresses").update(row).eq("id", input.id).select("id").single()
    : customerDb
        .from("customer_addresses")
        .insert({ ...row, customer_id: input.customerId })
        .select("id")
        .single();

  const { data, error } = await query;
  if (error || !data) {
    return failure(error ?? { message: "" }, "Não foi possível salvar o endereço.");
  }

  if (input.makeDefault) {
    const result = await setDefaultAddress(data.id);
    if (!result.ok) return result;
  }
  return { ok: true, value: { id: data.id } };
}

export async function setDefaultAddress(addressId: string): Promise<Result> {
  const { error } = await customerDb.rpc("customer_set_default_address", {
    p_address_id: addressId,
  });
  if (error) return failure(error, "Não foi possível marcar como principal.");
  return { ok: true, value: null };
}

export async function deleteAddress(addressId: string): Promise<Result> {
  const { error } = await customerDb.from("customer_addresses").delete().eq("id", addressId);
  if (error) return failure(error, "Não foi possível apagar o endereço.");
  return { ok: true, value: null };
}

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

/** Ids das lojas favoritas — o coração da loja e da lista leem daqui. */
export function useFavoriteIds(enabled: boolean) {
  return useAsync(
    "customer-favorite-ids",
    async () => {
      const { data, error } = await customerDb
        .from("customer_favorites")
        .select("establishment_id");
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((row) => row.establishment_id));
    },
    { enabled },
  );
}

export type FavoriteShop = EstablishmentRow;

/**
 * As lojas favoritas, com os dados de cartão.
 *
 * Duas leituras em vez de um embed: `customer_favorites` não está no tipo
 * gerado, e a loja que saiu do ar some sozinha porque o `select` público de
 * `establishments` só devolve as ativas.
 */
export function useFavoriteShops(enabled: boolean) {
  return useAsync(
    "customer-favorite-shops",
    async () => {
      const { data: favorites, error } = await customerDb
        .from("customer_favorites")
        .select("establishment_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const ids = (favorites ?? []).map((row) => row.establishment_id);
      if (ids.length === 0) return [] as FavoriteShop[];

      const { data: shops, error: shopsError } = await supabase
        .from("establishments")
        .select(
          "id, name, slug, category, accent_color, booking_mode, neighborhood, latitude, longitude, rating_avg, rating_count, deposit_percent",
        )
        .in("id", ids)
        .eq("status", "active");
      if (shopsError) throw new Error(shopsError.message);

      const byId = new Map((shops ?? []).map((shop) => [shop.id, shop as FavoriteShop]));
      return ids.map((id) => byId.get(id)).filter((shop): shop is FavoriteShop => Boolean(shop));
    },
    { enabled },
  );
}

export async function setFavorite(input: {
  customerId: string;
  establishmentId: string;
  favorite: boolean;
}): Promise<Result> {
  if (input.favorite) {
    const { error } = await customerDb
      .from("customer_favorites")
      .insert({ customer_id: input.customerId, establishment_id: input.establishmentId });
    // 23505: já era favorita — o estado final é o pedido, então é sucesso.
    if (error && error.code !== "23505") {
      return failure(error, "Não foi possível favoritar.");
    }
    return { ok: true, value: null };
  }

  const { error } = await customerDb
    .from("customer_favorites")
    .delete()
    .eq("establishment_id", input.establishmentId);
  if (error) return failure(error, "Não foi possível remover dos favoritos.");
  return { ok: true, value: null };
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

export type NotificationPrefs = Pick<
  NotificationPrefsRow,
  "queue_turn" | "appointment_reminder" | "appointment_changes" | "review_request" | "marketing"
>;

/** Sem linha salva vale o padrão do banco: operacional ligado, novidades desligado. */
export const DEFAULT_PREFS: NotificationPrefs = {
  queue_turn: true,
  appointment_reminder: true,
  appointment_changes: true,
  review_request: true,
  marketing: false,
};

export function useNotificationPrefs(enabled: boolean) {
  return useAsync(
    "customer-notification-prefs",
    async () => {
      const { data, error } = await customerDb
        .from("customer_notification_prefs")
        .select("queue_turn, appointment_reminder, appointment_changes, review_request, marketing")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? DEFAULT_PREFS) as NotificationPrefs;
    },
    { enabled },
  );
}

export async function saveNotificationPrefs(
  customerId: string,
  prefs: NotificationPrefs,
): Promise<Result> {
  const { error } = await customerDb
    .from("customer_notification_prefs")
    .upsert({ customer_id: customerId, ...prefs }, { onConflict: "customer_id" });
  if (error) return failure(error, "Não foi possível salvar suas preferências.");
  return { ok: true, value: null };
}

// ---------------------------------------------------------------------------
// Exclusão de conta
// ---------------------------------------------------------------------------

export type DeleteAccountResult =
  { ok: true; cancelledAppointments: number } | { ok: false; code: string; message: string };

/**
 * Pede a exclusão pela Edge Function `delete-account`. A política do que é
 * apagado e do que fica anonimizado está na migration e é repetida, em
 * português de gente, na tela `conta/excluir`.
 */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirmation },
  });
  if (error) {
    const body = await readErrorBody(error);
    return {
      ok: false,
      code: body?.code ?? "network",
      message: body?.message ?? "Não foi possível excluir sua conta. Verifique sua conexão.",
    };
  }
  return {
    ok: true,
    cancelledAppointments:
      (data as { cancelled_appointments?: number } | null)?.cancelled_appointments ?? 0,
  };
}
