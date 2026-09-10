import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import { Text } from "react-native";

import { sans } from "@vez/mobile-kit/theme";

/**
 * Campo de fotografia: duotom da marca com monograma.
 *
 * O design é explícito sobre o porquê — o enquadramento é o mesmo que a foto
 * real vai ocupar, então trocar por fotografia é trocar o fundo, sem mexer no
 * layout.
 */
export type Duotone = {
  colors: readonly [string, string, ...string[]];
  locations?: readonly [number, number, ...number[]];
  /** Ângulo CSS em graus (0 = para cima, 90 = para a direita). O design usa 150. */
  angle?: number;
};

/**
 * Converte ângulo CSS para os pontos start/end do expo-linear-gradient.
 *
 * No CSS 0deg aponta para cima e cresce no sentido horário; o vetor em
 * coordenadas de tela (y para baixo) é (sin θ, -cos θ). O eixo é centrado em
 * (0.5, 0.5) e estendido meio vetor para cada lado.
 */
export function gradientAxis(angle = 150) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  return {
    start: { x: 0.5 - dx / 2, y: 0.5 - dy / 2 },
    end: { x: 0.5 + dx / 2, y: 0.5 + dy / 2 },
  };
}

/** Atalho para o formato dominante no design: `150deg, A, B 55%, C`. */
export const duo = (a: string, b: string, c: string, mid = 0.55): Duotone => ({
  colors: [a, b, c],
  locations: [0, mid, 1],
});

/** Duas paradas, usado nas fotos de profissional. */
export const duo2 = (a: string, b: string): Duotone => ({ colors: [a, b] });

type Props = {
  duotone: Duotone;
  size?: DimensionValue;
  width?: DimensionValue;
  height?: DimensionValue;
  radius: number;
  /** Monograma no canto inferior esquerdo, como no design. */
  mono?: string;
  monoSize?: number;
  /** Centraliza o monograma em vez de ancorar embaixo (cards de profissional). */
  center?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function Photo({
  duotone,
  size,
  width,
  height,
  radius,
  mono,
  monoSize = 13,
  center = false,
  style,
  children,
}: Props) {
  const axis = gradientAxis(duotone.angle);

  return (
    <LinearGradient
      colors={duotone.colors}
      locations={duotone.locations}
      start={axis.start}
      end={axis.end}
      style={[
        {
          width: width ?? size,
          height: height ?? size,
          borderRadius: radius,
          padding: 7,
          justifyContent: center ? "center" : "flex-end",
          alignItems: center ? "center" : "flex-start",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {mono ? (
        <Text
          style={sans(monoSize, center ? 700 : 800, {
            ls: center ? 0 : -0.035,
            color: "rgba(255,255,255,0.95)",
          })}
        >
          {mono}
        </Text>
      ) : null}
      {children}
    </LinearGradient>
  );
}
