import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { supabase } from "../lib/supabase";
import { startAutoRefreshOnAppState } from "@vez/supabase/native";

export default function RootLayout() {
  // Sem isto o token para de renovar com o app em background e a primeira
  // ação depois de voltar falha com 401.
  useEffect(() => startAutoRefreshOnAppState(supabase), []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack />
    </>
  );
}
