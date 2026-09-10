import { mono, sans } from "@vez/mobile-kit/theme";
import { usePathname, useRouter } from "expo-router";
import { CalendarDays, House, Menu, Store } from "lucide-react-native";
import type { ComponentType } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEstablishment, waitingRows } from "../data/establishment";
import { actionGlow, color } from "../theme/tokens";
import { PulseDot } from "./primitives";

type IconProps = { size: number; color: string; strokeWidth: number };
type TabKey = "hoje" | "agenda" | "fila" | "loja" | "mais";

const TABS: { key: TabKey; label: string; route: string; Icon?: ComponentType<IconProps> }[] = [
  { key: "hoje", label: "HOJE", route: "/", Icon: House },
  { key: "agenda", label: "AGENDA", route: "/agenda", Icon: CalendarDays },
  // A aba central não tem ícone: tem o número. Ver comentário abaixo.
  { key: "fila", label: "FILA", route: "/fila" },
  { key: "loja", label: "LOJA", route: "/loja", Icon: Store },
  { key: "mais", label: "MAIS", route: "/mais", Icon: Menu },
];

function activeTab(pathname: string): TabKey {
  if (pathname.startsWith("/agenda")) return "agenda";
  if (pathname.startsWith("/fila")) return "fila";
  if (pathname.startsWith("/loja")) return "loja";
  if (pathname.startsWith("/mais")) return "mais";
  return "hoje";
}

/**
 * As cinco abas. As telas empilhadas rodam fora do grupo e não têm barra.
 *
 * A aba do meio quebra a regra das outras quatro de propósito: em vez de ícone,
 * ela mostra quantas pessoas estão esperando agora. É o único número do app que
 * muda sem ninguém tocar em nada, e ele precisa estar visível em qualquer tela
 * — o atendente que está mexendo em preço de serviço tem que ver a fila
 * crescer sem sair de onde está.
 *
 * Os ícones seguem a decisão 0002 do app do cliente: traço, nunca preenchido, e
 * nada de vocabulário abstrato. O canvas desenhava quadradinhos vazados aqui, e
 * quadradinho vazado não diz "agenda".
 */
export function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const active = activeTab(pathname);
  const { queue, establishment } = useEstablishment();

  const waiting = waitingRows(queue).length;
  const usesQueue =
    establishment?.booking_mode === "queue" || establishment?.booking_mode === "both";

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: color.line,
        backgroundColor: color.bg,
        paddingTop: 9,
        paddingHorizontal: 6,
        paddingBottom: 10 + insets.bottom,
        flexDirection: "row",
        alignItems: "flex-start",
      }}
    >
      {TABS.map(({ key, label, route, Icon }) => {
        const on = key === active;
        const center = key === "fila";
        const tint = on ? (center ? color.coral : color.ink) : color.faint;

        return (
          <Pressable
            key={key}
            onPress={() => router.navigate(route as never)}
            style={{ flex: 1, alignItems: "center", gap: 4, paddingTop: center ? 0 : 2 }}
          >
            {center ? (
              <View
                style={[
                  {
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: usesQueue ? color.coral : color.track,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: -22,
                  },
                  usesQueue && actionGlow,
                ]}
              >
                <Text style={mono(18, 600, { lh: 1, color: "#fff" })}>
                  {usesQueue ? waiting : "—"}
                </Text>
                <Text
                  style={[
                    sans(7.5, 700, { ls: 0.6 / 7.5, color: "rgba(255,255,255,0.85)" }),
                    { marginTop: 2 },
                  ]}
                >
                  NA FILA
                </Text>
                {usesQueue && waiting > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -3,
                      right: -3,
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      borderWidth: 2.5,
                      borderColor: "#fff",
                      backgroundColor: color.green,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PulseDot size={7} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ height: 24, justifyContent: "center" }}>
                {Icon ? <Icon size={22} color={tint} strokeWidth={on ? 2.2 : 1.8} /> : null}
              </View>
            )}
            <Text style={sans(10.5, 700, { ls: 0.2 / 10.5, color: tint })}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
