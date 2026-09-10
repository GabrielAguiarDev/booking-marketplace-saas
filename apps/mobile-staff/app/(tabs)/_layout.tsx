import { Tabs } from "expo-router";

import { AuthGate } from "../../src/auth/AuthGate";
import { color } from "../../src/theme/tokens";
import { TabBar } from "../../src/ui/TabBar";

/**
 * Só os cinco destinos da barra.
 *
 * O portão está aqui, e não em cada tela: neste app não existe nada para ver
 * sem conta e sem loja — tudo é a operação de um estabelecimento específico.
 */
export default function TabsLayout() {
  return (
    <AuthGate>
      <Tabs
        tabBar={() => <TabBar />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="agenda" />
        <Tabs.Screen name="fila" />
        <Tabs.Screen name="loja" />
        <Tabs.Screen name="mais" />
      </Tabs>
    </AuthGate>
  );
}
