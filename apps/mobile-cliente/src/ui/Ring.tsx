import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { color as token } from "../theme/tokens";

/**
 * O anel de vez — o objeto-assinatura do design.
 *
 * No canvas ele é `conic-gradient(cor 0 N%, #ECECEC N% 100%)`. O React Native
 * não tem gradiente cônico, então o arco é desenhado como um traço de SVG com
 * `strokeDasharray`, girado -90° para começar às 12 horas como o CSS faz.
 *
 * Mede a mesma coisa em três lugares: vagas no card, livres no dia da grade e
 * posição na fila.
 */
type Props = {
  /** Diâmetro externo. */
  size: number;
  /** Diâmetro do disco interno; a diferença vira a espessura do anel. */
  innerSize: number;
  /** 0 a 100. */
  pct: number;
  color: string;
  trackColor?: string;
  /** Cor do disco interno — o dia selecionado da grade usa o acento, não branco. */
  innerColor?: string;
  children?: ReactNode;
};

export function Ring({
  size,
  innerSize,
  pct,
  color,
  trackColor = token.line,
  innerColor = token.bg,
  children,
}: Props) {
  const thickness = (size - innerSize) / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          fill="none"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: innerColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}
