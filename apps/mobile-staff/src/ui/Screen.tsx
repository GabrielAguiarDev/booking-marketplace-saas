import { mono, sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, type StyleProp, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color } from "../theme/tokens";
import { PulseDot, StatTile } from "./primitives";

/** Área segura no topo e o fundo da tela. O rodapé é do tab bar ou da barra fixa. */
export function Screen({
  children,
  background = color.bg,
}: {
  children: ReactNode;
  background?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: background, paddingTop: insets.top }}>{children}</View>
  );
}

/**
 * Corpo rolável.
 *
 * `paddingBottom` grande de propósito: a barra de abas e, na Fila, a ação
 * flutuante ficam por cima do conteúdo. Sem a folga, a última linha da lista
 * nasce embaixo do botão e o usuário não consegue tocá-la.
 */
export function ScreenScroll({
  children,
  padded = false,
  gap = 0,
  bottom = 118,
  contentStyle,
}: {
  children: ReactNode;
  padded?: boolean;
  gap?: number;
  bottom?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        {
          paddingHorizontal: padded ? 20 : 0,
          paddingTop: padded ? 16 : 0,
          paddingBottom: bottom,
          gap,
        },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}

/** Cabeçalho da aba Hoje: quem é a loja, que dia é, e os três números. */
export function TodayHeader({
  name,
  status,
  served,
  queueCount,
  revenue,
  onPressAccount,
}: {
  name: string;
  status: string;
  served: string;
  queueCount: string;
  revenue: string;
  onPressAccount: () => void;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: color.line,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={sans(21, 800, { lh: 1.15, ls: -0.4 / 21 })} numberOfLines={1}>
            {name}
          </Text>
          <Text style={mono(12, 500, { lh: 1.2, ls: 0.2 / 12, color: color.muted })}>{status}</Text>
        </View>
        <Pressable
          onPress={onPressAccount}
          hitSlop={8}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: color.rest,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={sans(14, 700)}>
            {name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((word) => word[0] ?? "")
              .join("")
              .toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <StatTile value={served} label="atendidos" />
        <StatTile value={queueCount} label="na fila" tint={color.coral} />
        <StatTile value={revenue} label="R$ hoje" tint={color.green} flex={1.35} />
      </View>
    </View>
  );
}

/** Cabeçalho da aba Fila: o único do app que se diz ao vivo. */
export function QueueHeader({
  live,
  waiting,
  averageWait,
  onTheWay,
  onAdjust,
}: {
  live: boolean;
  waiting: string;
  averageWait: string;
  onTheWay: string;
  onAdjust: () => void;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: color.line,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 3 }}>
          <Text style={sans(21, 800, { lh: 1.15, ls: -0.4 / 21 })}>Fila de espera</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {live ? (
              <PulseDot />
            ) : (
              <View
                style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: color.track }}
              />
            )}
            <Text
              style={mono(12, 500, {
                lh: 1.2,
                ls: 0.2 / 12,
                color: live ? color.green : color.muted,
              })}
            >
              {live ? "AO VIVO · ABERTA" : "FILA DESLIGADA"}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onAdjust}
          style={{
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: color.line,
            borderRadius: 999,
          }}
        >
          <Text style={sans(13, 600)}>Ajustar</Text>
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: 18,
          marginTop: 14,
          paddingTop: 13,
          borderTopWidth: 1,
          borderTopColor: color.lineSoft,
        }}
      >
        <HeaderStat value={waiting} label=" esperando" />
        <HeaderStat value={averageWait} label=" espera média" tint={color.amber} />
        <HeaderStat value={onTheWay} label=" a caminho" tint={color.muted} />
      </View>
    </View>
  );
}

function HeaderStat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <Text>
      <Text style={mono(17, 600, { color: tint ?? color.ink })}>{value}</Text>
      <Text style={sans(11, 500, { color: color.muted })}>{label}</Text>
    </Text>
  );
}

/** Cabeçalho das telas empilhadas: voltar, título e, às vezes, uma ação. */
export function PlainHeader({
  title,
  action,
  onAction,
  canGoBack = true,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  canGoBack?: boolean;
}) {
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: color.line,
      }}
    >
      {canGoBack ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={sans(24, 400, { lh: 1 })}>‹</Text>
        </Pressable>
      ) : null}
      <Text style={[sans(18, 700, { lh: 1.2, ls: -0.3 / 18 }), { flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      {action ? (
        <Pressable
          onPress={onAction}
          style={{
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: color.coral,
          }}
        >
          <Text style={sans(13, 700, { color: "#fff" })}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Barra fixa no rodapé de uma tela empilhada. */
export function StickyFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: color.line,
        backgroundColor: color.bg,
        paddingHorizontal: 20,
        paddingTop: 13,
        paddingBottom: 16 + insets.bottom,
      }}
    >
      {children}
    </View>
  );
}
