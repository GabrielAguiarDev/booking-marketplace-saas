import { useAsync } from "@vez/mobile-kit/async";
import type { Database } from "@vez/supabase/types";

import { supabase } from "../../lib/supabase";

export type NotificationPrefs = Database["public"]["Tables"]["member_notification_prefs"]["Row"];

export const PREF_DEFAULTS = {
  notify_new_appointment: true,
  notify_cancellation: true,
  notify_queue_join: true,
  notify_daily_summary: false,
} as const;

/**
 * O que toca o celular de quem está usando o app.
 *
 * A linha pode não existir: ela nasce no primeiro toque, não no cadastro.
 * Enquanto não existe, valem os padrões acima — os mesmos do banco, escritos
 * aqui de novo porque a tela precisa desenhar antes de haver linha.
 */
export function useNotificationPrefs(userId: string | null, establishmentId: string | null) {
  return useAsync(
    `prefs:${userId}:${establishmentId}`,
    async () => {
      const { data, error } = await supabase
        .from("member_notification_prefs")
        .select("*")
        .eq("user_id", userId!)
        .eq("establishment_id", establishmentId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    { enabled: Boolean(userId && establishmentId) },
  );
}

export async function saveNotificationPrefs(
  userId: string,
  establishmentId: string,
  patch: Partial<typeof PREF_DEFAULTS>,
  current: NotificationPrefs | null,
): Promise<boolean> {
  const { error } = await supabase.from("member_notification_prefs").upsert(
    {
      user_id: userId,
      establishment_id: establishmentId,
      ...PREF_DEFAULTS,
      ...(current ?? {}),
      ...patch,
    },
    { onConflict: "user_id,establishment_id" },
  );
  return !error;
}
