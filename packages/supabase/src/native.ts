import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import type { Database } from "./database.types";
import { requireEnv } from "./env";
import { secureStorage } from "./secure-storage";

/**
 * Cliente para os dois apps Expo. A sessão persiste no Keychain/Keystore via
 * `secureStorage`, não em AsyncStorage — refresh token em storage não cifrado
 * é lido por qualquer processo com acesso ao sandbox do app.
 */
export function createNativeSupabaseClient() {
  return createClient<Database>(
    requireEnv(process.env.EXPO_PUBLIC_SUPABASE_URL, "EXPO_PUBLIC_SUPABASE_URL"),
    requireEnv(
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
    {
      auth: {
        storage: secureStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Não há URL de retorno para inspecionar em app nativo; o deep link de
        // auth é tratado explicitamente pelo app.
        detectSessionInUrl: false,
      },
    },
  );
}

export type NativeSupabaseClient = ReturnType<typeof createNativeSupabaseClient>;

/**
 * O timer de refresh do Supabase não roda com o app em background. Sem isto o
 * token expira enquanto o app está minimizado e a primeira ação ao voltar
 * falha com 401.
 *
 * Chame uma vez no layout raiz e guarde o retorno para descadastrar.
 */
export function startAutoRefreshOnAppState(client: NativeSupabaseClient): () => void {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void client.auth.startAutoRefresh();
    } else {
      void client.auth.stopAutoRefresh();
    }
  });

  if (AppState.currentState === "active") {
    void client.auth.startAutoRefresh();
  }

  return () => subscription.remove();
}
