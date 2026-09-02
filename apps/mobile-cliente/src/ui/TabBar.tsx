import { usePathname, useRouter } from "expo-router";
import { Calendar, House, Search, Sparkles, User } from "lucide-react-native";
import type { ComponentType } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, coralGlow } from "../theme/tokens";
import { mono } from "../theme/type";

type IconProps = { size: number; color: string; strokeWidth: number };
type TabKey = "inicio" | "explorar" | "assistente" | "agenda" | "perfil";

const TABS: {
  key: TabKey;
  label: string;
  route: string;
  Icon: ComponentType<IconProps>;
  center?: boolean;
}[] = [
  { key: "inicio", label: "INÍCIO", route: "/", Icon: House },
  { key: "explorar", label: "EXPLORAR", route: "/explorar", Icon: Search },
  { key: "assistente", label: "IA", route: "/assistente", Icon: Sparkles, center: true },
  { key: "agenda", label: "AGENDA", route: "/agenda", Icon: Calendar },
  { key: "perfil", label: "PERFIL", route: "/perfil", Icon: User },
];

/**
 * Só as cinco abas aparecem aqui. As telas empilhadas (loja, horário,
 * pagamento, fila, avaliação, resultados) rodam fora do grupo e não têm barra.
 */
function activeTab(pathname: string): TabKey {
  if (pathname.startsWith("/explorar")) return "explorar";
  if (pathname.startsWith("/assistente")) return "assistente";
  if (pathname.startsWith("/agenda")) return "agenda";
  if (pathname.startsWith("/perfil")) return "perfil";
  return "inicio";
}

export function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const active = activeTab(pathname);

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: color.line,
        backgroundColor: color.bg,
        paddingTop: 9,
        paddingHorizontal: 12,
        paddingBottom: 14 + insets.bottom,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      {TABS.map(({ key, label, route, Icon, center }) => {
        const on = key === active;
        const tint = on ? color.coral : color.muted;

        return (
          <Pressable
            key={key}
            onPress={() => router.navigate(route as never)}
            style={{ flex: 1, alignItems: "center", gap: 5, paddingTop: center ? 0 : 4 }}
          >
            {center ? (
              // O Assistente mantém o destaque que o canvas deu a ele: um alvo
              // maior e preenchido, não só um ícone a mais na fileira.
              <View
                style={[
                  {
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? color.coral : color.rest,
                    borderWidth: on ? 0 : 1,
                    borderColor: color.line,
                  },
                  on && coralGlow,
                ]}
              >
                <Icon size={20} color={on ? "#fff" : color.muted} strokeWidth={2} />
              </View>
            ) : (
              <View style={{ height: 26, justifyContent: "center" }}>
                <Icon size={22} color={tint} strokeWidth={on ? 2.2 : 1.8} />
              </View>
            )}
            <Text style={mono(8.5, 600, { ls: 0.07, color: tint })}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
