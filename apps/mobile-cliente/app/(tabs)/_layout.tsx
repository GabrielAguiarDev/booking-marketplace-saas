import { Tabs } from "expo-router";

import { color } from "../../src/theme/tokens";
import { TabBar } from "../../src/ui/TabBar";

/** Só os cinco destinos da barra. As telas empilhadas vivem na raiz de `app/`. */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => <TabBar />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explorar" />
      <Tabs.Screen name="assistente" />
      <Tabs.Screen name="agenda" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}
