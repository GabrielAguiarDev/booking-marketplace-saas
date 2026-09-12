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
import { AppStateProvider } from "../src/state/app-state";
import { color } from "../src/theme/tokens";

/**
 * Duas camadas de navegação.
 *
 * `(tabs)` guarda apenas os cinco destinos da barra inferior. Todo o resto é
 * empilhado por cima e roda sem tab bar — as telas de reserva têm rodapé fixo
 * próprio, e dois elementos fixos no mesmo lugar competiriam entre si.
 */
export default function RootLayout() {
  // Sem isto o token para de renovar com o app em background e a primeira ação
  // depois de voltar falha com 401.
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
    // A tipografia é metade da identidade do design; renderizar com a fonte do
    // sistema e trocar depois faria a tela saltar.
    return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <AppStateProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="resultados" />
            <Stack.Screen name="loja/[id]" />
            <Stack.Screen name="horario" />
            <Stack.Screen name="pagamento" />
            <Stack.Screen name="fila" />
            <Stack.Screen name="avaliacao" />

            {/* Ajuda: lista, formulário e conversa de um chamado. */}
            <Stack.Screen name="ajuda/index" />
            <Stack.Screen name="ajuda/novo" />
            <Stack.Screen name="ajuda/[id]" />

            {/* Autenticação. Empilhadas como o resto: são fluxo com começo e fim,
              não destino de navegação livre. */}
            <Stack.Screen name="entrar" />
            <Stack.Screen name="cadastro" />
            <Stack.Screen name="confirmar" />
            <Stack.Screen name="recuperar" />
            <Stack.Screen name="nova-senha" />
          </Stack>
        </AppStateProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
