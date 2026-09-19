import { createPush } from "@vez/mobile-kit/push";
import { type Href, useRouter } from "expo-router";
import { useCallback } from "react";

import { supabase } from "../lib/supabase";
import { useSession } from "./auth/session";

/**
 * Avisos no aparelho deste app (`push_devices.app = 'cliente'`).
 *
 * `EXPO_PUBLIC_EAS_PROJECT_ID` é o projeto do EAS que assina o token. Sem ele
 * (e sem `extra.eas.projectId` no build) a tela mostra "avisos ainda não
 * disponíveis" em vez de um botão que não funciona.
 */
export const { PushRegistrar, usePush, signOut, useDeliveries } = createPush(supabase, {
  app: "cliente",
  projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
});

/** Grava o token da conta logada e leva o toque na notificação à tela certa. */
export function PushBridge() {
  const { user } = useSession();
  const router = useRouter();
  const onOpen = useCallback((route: string) => router.push(route as Href), [router]);
  return <PushRegistrar userId={user?.id ?? null} onOpen={onOpen} />;
}
