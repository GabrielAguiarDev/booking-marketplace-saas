import type { SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useSyncExternalStore } from "react";
import { AppState, Linking, Platform } from "react-native";

import { useAsync } from "../async";
import {
  type DeliveryRow,
  isExpoPushToken,
  permissionState,
  pushBlocker,
  pushPlatform,
  pushRoute,
  type PushApp,
  type PushState,
  resolveProjectId,
} from "./rules";

export * from "./rules";

/**
 * Avisos no aparelho, amarrados ao cliente Supabase de um app.
 *
 * Função e não módulo pronto pelo mesmo motivo da sessão: o app do cliente e o
 * da loja convivem no mesmo telefone, cada um com o seu cliente e o seu `app`
 * em `push_devices`.
 *
 * - `PushRegistrar` fica dentro do `SessionProvider`: com a pessoa logada e a
 *   permissão já dada, grava o token (`register_push_device`). Não pede
 *   permissão sozinho — quem pede é a tela, num botão, com contexto.
 * - `usePush` dá a situação para a tela e as ações (pedir, abrir ajustes).
 * - `signOut` desliga o token ANTES de sair: depois, sem JWT, o banco não
 *   saberia de quem é, e a conta anterior continuaria recebendo.
 * - `useDeliveries` lê os últimos avisos da própria pessoa (`notification_outbox`),
 *   para a tela mostrar se eles estão saindo de verdade.
 */
export function createPush(
  supabase: SupabaseClient,
  options: { app: PushApp; projectId?: string | null },
) {
  const { app } = options;
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const projectId = resolveProjectId(
    options.projectId,
    Constants.easConfig?.projectId,
    extra?.eas?.projectId,
  );

  let state: PushState = { kind: "checking" };
  let userId: string | null = null;
  // O token gravado para a conta atual. É o que `signOut` desliga.
  let token: string | null = null;
  let running: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  function set(next: PushState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  if (Platform.OS !== "web") {
    // Com o app aberto o aviso aparece como banner — a fila chamando não pode
    // depender de a pessoa estar fora do app.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  async function run(ask: boolean) {
    const blocker = pushBlocker({ os: Platform.OS, isDevice: Device.isDevice, projectId });
    if (blocker) return set(blocker);

    try {
      if (Platform.OS === "android") {
        // Android 13+ só mostra o pedido de permissão depois que existe canal.
        await Notifications.setNotificationChannelAsync("default", {
          name: "Avisos",
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      let permission = await Notifications.getPermissionsAsync();
      if (
        ask &&
        permission.status !== "granted" &&
        (permission.status === "undetermined" || permission.canAskAgain)
      ) {
        permission = await Notifications.requestPermissionsAsync();
      }

      const next = permissionState(permission.status, permission.canAskAgain);
      if (next.kind !== "on" || !userId) return set(next);

      set({ kind: "registering" });
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId! });
      if (!isExpoPushToken(data)) {
        return set({ kind: "error", message: "O aparelho devolveu um token inesperado." });
      }

      const { error } = await supabase.rpc("register_push_device", {
        p_expo_token: data,
        p_app: app,
        p_platform: pushPlatform(Platform.OS),
        p_device_name: Device.modelName ?? null,
      });
      if (error) {
        return set({
          kind: "error",
          message:
            error.code === "P0001"
              ? error.message
              : "Não foi possível gravar este aparelho. Confira a conexão e tente de novo.",
        });
      }
      token = data;
      set({ kind: "on" });
    } catch {
      set({
        kind: "error",
        message: "O aparelho não entregou o token de notificação. Tente de novo em instantes.",
      });
    }
  }

  /** Uma execução por vez: foco do app e toque no botão podem chegar juntos. */
  function sync(ask: boolean) {
    if (!running) {
      running = run(ask).finally(() => {
        running = null;
      });
    }
    return running;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function PushRegistrar({
    userId: next,
    onOpen,
  }: {
    userId: string | null;
    onOpen: (route: string) => void;
  }) {
    useEffect(() => {
      userId = next;
      void sync(false);
      // Voltar dos ajustes do aparelho com a permissão trocada.
      const sub = AppState.addEventListener("change", (status) => {
        if (status === "active") void sync(false);
      });
      return () => sub.remove();
    }, [next]);

    useEffect(() => {
      if (Platform.OS === "web") return;
      const open = (response: Notifications.NotificationResponse | null) => {
        const route = pushRoute(app, response?.notification.request.content.data);
        if (route) onOpen(route);
      };
      // App aberto a frio pelo toque.
      void Notifications.getLastNotificationResponseAsync()
        .then(open)
        .catch(() => undefined);
      const sub = Notifications.addNotificationResponseReceivedListener(open);
      return () => sub.remove();
    }, [onOpen]);

    return null;
  }

  function usePush() {
    const current = useSyncExternalStore(subscribe, () => state);
    return {
      state: current,
      enable: () => sync(true),
      retry: () => sync(false),
      openSettings: () => void Linking.openSettings(),
    };
  }

  /** Desliga o token deste aparelho e só então sai da conta. */
  async function signOut(scope?: { scope: "local" | "global" | "others" }) {
    // Se o login acabou de montar o provider, o registro pode ainda estar em
    // voo. Esperar evita a corrida em que ele termina logo depois do sign-out
    // e deixa um token ativo para a conta que acabou de sair.
    await running?.catch(() => undefined);
    const current = token;
    token = null;
    if (current) {
      // Falhar aqui não pode prender a pessoa logada: o próximo login no
      // aparelho passa o token para a nova conta de qualquer jeito.
      await supabase.rpc("unregister_push_device", { p_expo_token: current }).then(
        () => undefined,
        () => undefined,
      );
    }
    await supabase.auth.signOut(scope);
  }

  function useDeliveries(enabled: boolean) {
    return useAsync(
      `push-deliveries:${app}:${enabled}`,
      async () => {
        const { data, error } = await supabase
          .from("notification_outbox")
          .select("id, channel, status, title, created_at, sent_at")
          .or(`app.eq.${app},app.is.null`)
          .order("created_at", { ascending: false })
          .limit(6);
        if (error) throw new Error(error.message);
        return (data ?? []) as DeliveryRow[];
      },
      { enabled },
    );
  }

  return { PushRegistrar, usePush, signOut, useDeliveries };
}
