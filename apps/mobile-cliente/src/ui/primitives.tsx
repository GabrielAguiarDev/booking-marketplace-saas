import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft } from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { cardShadow, color, segmentShadow } from "../theme/tokens";
import { useReducedMotion } from "@vez/mobile-kit/motion";
import { mono, sans } from "@vez/mobile-kit/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Card branco separado do fundo por hairline — o padrão de superfície do design. */
export function Card({
  children,
  radius = 18,
  padding,
  shadow = false,
  style,
}: {
  children: ReactNode;
  radius?: number;
  padding?: number;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: color.line,
          borderRadius: radius,
          backgroundColor: color.bg,
          padding,
          overflow: "hidden",
        },
        shadow && cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  height = 50,
  radius = 14,
  background = color.coral,
  style,
}: {
  label: string;
  onPress?: () => void;
  height?: number;
  radius?: number;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  // Botão sem `onPress` é o jeito de as telas dizerem "agora não": enquanto
  // envia, ou enquanto falta escolher algo. O leitor de tela precisa saber
  // disso — sem o estado, ele anuncia um botão que não faz nada ao tocar.
  const disabled = !onPress;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius,
          backgroundColor: background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={sans(height >= 54 ? 15.5 : 14.5, 700, { color: "#fff" })} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function OutlineButton({
  label,
  onPress,
  height = 50,
  radius = 14,
  style,
}: {
  label: string;
  onPress?: () => void;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const disabled = !onPress;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: pressed ? color.ink : color.line,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 18,
        },
        style,
      ]}
    >
      <Text style={sans(height >= 54 ? 15 : 14.5, 600)}>{label}</Text>
    </Pressable>
  );
}

/** Chip binário: filtros de resultado e marcadores de avaliação. */
export function Chip({
  label,
  active,
  onPress,
  variant = "sans",
}: {
  label: string;
  active: boolean;
  onPress?: () => void;
  variant?: "sans" | "mono";
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={{
        paddingVertical: variant === "mono" ? 10 : 10,
        paddingHorizontal: variant === "mono" ? 12 : 13,
        borderRadius: variant === "mono" ? 10 : 11,
        borderWidth: 1,
        borderColor: active ? color.ink : color.line,
        backgroundColor: active ? color.ink : color.bg,
      }}
    >
      <Text
        style={
          variant === "mono"
            ? mono(10.5, 600, { ls: 0.05, color: active ? "#fff" : color.ink })
            : sans(13, 600, { color: active ? "#fff" : color.ink })
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Segmento sobre superfície de repouso: abas de Agenda e da Loja. */
export function Segmented({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        gap: 5,
        backgroundColor: color.rest,
        borderRadius: 14,
        padding: 4,
      }}
    >
      {items.map((item) => {
        const on = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: on }}
            style={[
              {
                flex: 1,
                alignItems: "center",
                paddingVertical: 11,
                borderRadius: 11,
                backgroundColor: on ? color.bg : "transparent",
              },
              on && segmentShadow,
            ]}
          >
            <Text style={mono(10.5, 600, { ls: 0.05, color: on ? color.ink : color.muted })}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Ponto que pulsa — `@keyframes vzpulse` do design. */
export function PulseDot({ size = 7, dotColor }: { size?: number; dotColor: string }) {
  const [value] = useState(() => new Animated.Value(0.3));
  const reduced = useReducedMotion();

  useEffect(() => {
    // Com "reduzir movimento" ligado o ponto fica aceso e parado: continua
    // dizendo "ao vivo" pela cor, sem piscar.
    if (reduced) {
      value.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, reduced]);

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: dotColor,
        opacity: value,
      }}
    />
  );
}

/** Bloco de esqueleto com varredura — `@keyframes vzshim`. */
export function Shimmer({
  width,
  height,
  radius = 5,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const [value] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [value, reduced]);

  // O bloco cinza sozinho já diz "carregando"; a varredura é o enfeite, e é
  // ela que sai quando a pessoa pediu menos movimento.
  if (reduced) {
    return (
      <View
        accessible={false}
        importantForAccessibility="no"
        style={{ width, height, borderRadius: radius, backgroundColor: color.rest }}
      />
    );
  }

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: color.rest,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          transform: [
            { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [-240, 240] }) },
          ],
        }}
      >
        <LinearGradient
          colors={[color.rest, "#EFEFF1", color.rest]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: 240, height: "100%" }}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Malha do mapa. No design é `background-image` com dois gradientes repetidos;
 * aqui são linhas de 1px desenhadas a cada 36px (ou 32px na loja).
 */
export function GridBackdrop({ step = 36 }: { step?: number }) {
  const lines = Array.from({ length: 14 }, (_, i) => i * step);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((offset) => (
        <View
          key={`h${offset}`}
          style={{
            position: "absolute",
            top: offset,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: color.line,
          }}
        />
      ))}
      {lines.map((offset) => (
        <View
          key={`v${offset}`}
          style={{
            position: "absolute",
            left: offset,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: color.line,
          }}
        />
      ))}
    </View>
  );
}

/**
 * O "voltar" das telas empilhadas.
 *
 * No canvas é o caractere "‹", que um leitor de tela lê como "aspa angular
 * simples" — ou não lê. Aqui é um botão com nome, e o `hitSlop` leva o alvo
 * aos 44 pt sem mudar o desenho.
 */
export function BackButton({
  onPress,
  boxed = false,
}: {
  onPress: () => void;
  /** Quadrado branco sobre a foto da loja, em vez do traço solto. */
  boxed?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={boxed ? 6 : 12}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      style={
        boxed
          ? {
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: color.bg,
              alignItems: "center",
              justifyContent: "center",
            }
          : { width: 24, height: 28, justifyContent: "center", marginLeft: -5 }
      }
    >
      <ChevronLeft size={boxed ? 20 : 24} color={color.ink} strokeWidth={boxed ? 2 : 1.8} />
    </Pressable>
  );
}

/** Cabeçalho `‹ Título` das telas empilhadas. */
export function BackHeader({
  title,
  onBack,
  right,
  titleSize = 19,
}: {
  title?: string;
  onBack: () => void;
  right?: ReactNode;
  titleSize?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
      <BackButton onPress={onBack} />
      {title ? (
        <Text
          accessibilityRole="header"
          style={[sans(titleSize, 800, { ls: -0.03 }), { flexShrink: 1 }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : null}
      {right}
    </View>
  );
}

/** Rótulo mono de seção (`DIA · SÓ COM VAGA`, `TOKENS`, `POLÍTICA`). */
export function Label({ children }: { children: string }) {
  return <Text style={mono(10, 600, { ls: 0.12, color: color.muted })}>{children}</Text>;
}

/** Cabeçalho de seção com título e um meta à direita. */
export function SectionHeader({
  title,
  meta,
  metaColor = color.muted,
  onMetaPress,
}: {
  title: string;
  meta?: string;
  metaColor?: string;
  onMetaPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
      }}
    >
      <Text accessibilityRole="header" style={sans(21, 800, { ls: -0.03 })}>
        {title}
      </Text>
      {meta ? (
        <Pressable
          onPress={onMetaPress}
          disabled={!onMetaPress}
          hitSlop={12}
          accessibilityRole={onMetaPress ? "button" : undefined}
        >
          <Text style={mono(10.5, 600, { ls: 0.05, color: metaColor })}>{meta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Barra fixa no rodapé da tela — Loja, Horário e Confirmar usam.
 *
 * Soma a área segura por conta própria. Antes ela chegava por prop e todas as
 * telas passavam zero: em aparelho sem botão físico o botão principal ficava
 * em cima da barra de início.
 */
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
