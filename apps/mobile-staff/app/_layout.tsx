import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from "@expo-google-fonts/ibm-plex-mono";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { startAutoRefreshOnAppState } from "@vez/supabase/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import { SessionProvider } from "../src/auth/session";
import { EstablishmentProvider } from "../src/data/establishment";
import { color } from "../src/theme/tokens";
import { ToastProvider } from "../src/ui/Toast";

/**
 * Duas camadas de navegação, pela regra R5 do projeto.
 *
 * `(tabs)` guarda os cinco destinos da barra e nada mais. Todo o resto —
 * detalhe, ajuste, cadastro, fluxo de criação — é empilhado por cima e roda sem
 * barra: são telas que se termina ou se abandona, não lugares onde se fica.
 */
export default function RootLayout() {
  // Sem isto o token para de renovar com o app em background, e a primeira ação
  // depois de voltar falha com 401 — que num balcão significa "chamar o
  // próximo" não funcionar com o cliente na frente.
  useEffect(() => startAutoRefreshOnAppState(supabase), []);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <EstablishmentProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="entrar" />
              <Stack.Screen name="recuperar" />
              <Stack.Screen name="nova-senha" />

              <Stack.Screen name="agendamento/[id]" />
              <Stack.Screen name="novo-agendamento" />
              <Stack.Screen name="bloquear" />

              <Stack.Screen name="fila-config" />
              <Stack.Screen name="servicos" />
              <Stack.Screen name="servico/[id]" />
              <Stack.Screen name="profissionais" />
              <Stack.Screen name="horarios" />
              <Stack.Screen name="regras" />
              <Stack.Screen name="perfil-publico" />

              <Stack.Screen name="financeiro" />
              <Stack.Screen name="assinatura" />
              <Stack.Screen name="ajustes" />
              <Stack.Screen name="comecar" />
            </Stack>
          </ToastProvider>
        </EstablishmentProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
