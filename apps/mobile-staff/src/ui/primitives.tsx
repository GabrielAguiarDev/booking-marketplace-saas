import { mono, sans } from "@vez/mobile-kit/theme";
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

import { color, tileShadow } from "../theme/tokens";

/** Cartão do canvas: hairline, raio 16, sombra rasa opcional. */
export function Card({
  children,
  radius = 16,
  padding,
  shadow = false,
  borderColor = color.line,
  background = color.bg,
  style,
}: {
  children: ReactNode;
  radius?: number;
  padding?: number;
  shadow?: boolean;
  borderColor?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor,
          borderRadius: radius,
          backgroundColor: background,
          padding,
          overflow: "hidden",
        },
        shadow && tileShadow,
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
  disabled = false,
  height = 52,
  radius = 14,
  background = color.coral,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  height?: number;
  radius?: number;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius,
          backgroundColor: disabled ? color.track : background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          opacity: pressed && !disabled ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={sans(height >= 56 ? 16 : 15, 700, { color: "#fff" })} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function OutlineButton({
  label,
  onPress,
  height = 48,
  radius = 14,
  tint = color.ink,
  style,
}: {
  label: string;
  onPress?: () => void;
  height?: number;
  radius?: number;
  tint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: pressed ? color.ink : color.line,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
        },
        style,
      ]}
    >
      <Text style={sans(14, 600, { color: tint })} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Interruptor do canvas: trilho 48×29, botão 23 que corre 19px.
 *
 * O React Native tem `Switch`, e ele não serve aqui: o componente nativo usa a
 * cor do sistema e ignora o raio e a sombra do design. Como o interruptor
 * aparece dezesseis vezes em três telas de ajuste, ele é elemento de marca.
 */
export function Toggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const [anim] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [value, anim]);

  return (
    <Pressable onPress={() => onChange(!value)} hitSlop={8}>
      <View
        style={{
          width: 48,
          height: 29,
          borderRadius: 999,
          backgroundColor: value ? color.ink : color.track,
          padding: 3,
        }}
      >
        <Animated.View
          style={{
            width: 23,
            height: 23,
            borderRadius: 999,
            backgroundColor: "#fff",
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
            transform: [
              { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 19] }) },
            ],
          }}
        />
      </View>
    </Pressable>
  );
}

/** Pílula de escolha: tinta preenchida quando ligada, contorno quando não. */
export function Pill({
  label,
  active,
  onPress,
  size = "md",
}: {
  label: string;
  active: boolean;
  onPress?: () => void;
  size?: "sm" | "md";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: size === "sm" ? 7 : 9,
        paddingHorizontal: size === "sm" ? 11 : 13,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? color.ink : color.line,
        backgroundColor: active ? color.ink : color.bg,
      }}
    >
      <Text
        style={sans(size === "sm" ? 11.5 : 12.5, 600, { color: active ? "#fff" : color.muted })}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Segmento sobre superfície de repouso: Agenda (dia/semana/mês) e Financeiro. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 2,
        backgroundColor: color.rest,
        borderRadius: 11,
        padding: 3,
      }}
    >
      {items.map((item) => {
        const on = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={[
              {
                flex: 1,
                alignItems: "center",
                paddingVertical: 9,
                borderRadius: 8,
                backgroundColor: on ? color.bg : "transparent",
              },
              on && {
                shadowColor: "#14171A",
                shadowOpacity: 0.12,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              },
            ]}
          >
            <Text style={sans(13, 600, { color: on ? color.ink : color.muted })}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rótulo de seção: `700 11px` com entreletra larga, sempre em caixa alta. */
export function SectionLabel({ children, tint = color.ink }: { children: string; tint?: string }) {
  return <Text style={sans(11, 700, { ls: 1.2 / 11, color: tint })}>{children.toUpperCase()}</Text>;
}

/** Rótulo de seção com um número mono à direita. */
export function SectionHeader({
  label,
  meta,
  metaColor = color.muted,
  count,
}: {
  label: string;
  meta?: string;
  metaColor?: string;
  count?: number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <SectionLabel>{label}</SectionLabel>
        {count !== undefined ? <CountBadge value={count} /> : null}
      </View>
      {meta ? <Text style={mono(11, 500, { color: metaColor })}>{meta}</Text> : null}
    </View>
  );
}

export function CountBadge({
  value,
  background = color.coral,
  tint = "#fff",
}: {
  value: number | string;
  background?: string;
  tint?: string;
}) {
  return (
    <View
      style={{
        minWidth: 19,
        height: 19,
        paddingHorizontal: 5,
        borderRadius: 999,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={mono(11, 600, { color: tint })}>{value}</Text>
    </View>
  );
}

/** Selo de estado: ponto colorido sobre tinta clara. */
export function StatusTag({
  label,
  tint,
  background,
}: {
  label: string;
  tint: string;
  background: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 3,
        paddingHorizontal: 7,
        borderRadius: 6,
        backgroundColor: background,
      }}
    >
      <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: tint }} />
      <Text style={sans(10.5, 600, { color: tint })}>{label}</Text>
    </View>
  );
}

/** Etiqueta chapada, sem ponto: histórico do cliente, acesso do profissional. */
export function Tag({
  label,
  tint = color.muted,
  background = color.rest,
}: {
  label: string;
  tint?: string;
  background?: string;
}) {
  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: background,
      }}
    >
      <Text style={sans(11, 600, { color: tint })}>{label}</Text>
    </View>
  );
}

/** Bloco de número do cabeçalho de Hoje. */
export function StatTile({
  value,
  label,
  tint = color.ink,
  flex = 1,
}: {
  value: string;
  label: string;
  tint?: string;
  flex?: number;
}) {
  return (
    <View
      style={{
        flex,
        backgroundColor: color.rest,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 11,
        gap: 3,
      }}
    >
      <Text style={mono(22, 600, { lh: 1, color: tint })} numberOfLines={1}>
        {value}
      </Text>
      <Text style={sans(10, 500, { ls: 0.3 / 10, color: color.muted })}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** Linha `chave · valor` das telas de detalhe e de prazos. */
export function KeyRow({
  label,
  value,
  help,
  valueColor = color.ink,
  valueMono = false,
  onPress,
  last = false,
}: {
  label: string;
  value?: string;
  help?: string;
  valueColor?: string;
  valueMono?: boolean;
  onPress?: () => void;
  last?: boolean;
}) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.lineSoft,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={sans(13.5, help ? 600 : 500, { color: help ? color.ink : color.muted })}>
          {label}
        </Text>
        {help ? <Text style={sans(12, 400, { lh: 1.4, color: color.muted })}>{help}</Text> : null}
      </View>
      {value ? (
        <Text
          style={
            valueMono ? mono(14, 600, { color: valueColor }) : sans(14, 600, { color: valueColor })
          }
        >
          {value}
        </Text>
      ) : null}
      {onPress ? <Text style={sans(15, 600, { color: color.chevron })}>›</Text> : null}
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

/** Linha dos hubs Loja e Mais: ícone, título, subtítulo e chevron. */
export function HubRow({
  icon,
  label,
  sub,
  tag,
  onPress,
  last = false,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  tag?: { label: string; tint: string; background: string };
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        paddingVertical: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.lineSoft,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: color.rest,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={sans(15, 700)}>{label}</Text>
        <Text style={sans(12.5, 400, { lh: 1.4, color: color.muted })}>{sub}</Text>
      </View>
      {tag ? <Tag label={tag.label} tint={tag.tint} background={tag.background} /> : null}
      <Text style={sans(15, 600, { color: color.chevron })}>›</Text>
    </Pressable>
  );
}

/** Linha de interruptor com ajuda e opções — as três telas de ajuste. */
export function ToggleRow({
  label,
  help,
  value,
  onChange,
  options,
  /**
   * Marca um ajuste que o banco guarda e nenhuma superfície ainda lê.
   *
   * É a coisa mais importante desta tela. Um interruptor que grava e não faz
   * nada é pior que interruptor nenhum: o dono da barbearia liga "fechar a fila
   * quando encher", vai cuidar da vida, e a fila enche.
   */
  pending = false,
  disabled = false,
  first = false,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (next: boolean) => void;
  options?: ReactNode;
  pending?: boolean;
  disabled?: boolean;
  first?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 14,
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: color.lineSoft,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <Text style={sans(14.5, 600, { lh: 1.3 })}>{label}</Text>
          {pending ? (
            <Tag label="ainda não atua" tint={color.amberDeep} background={color.amberTint} />
          ) : null}
        </View>
        <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>{help}</Text>
        {options ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {options}
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 2, opacity: disabled ? 0.4 : 1 }}>
        <Toggle value={value} onChange={disabled ? () => undefined : onChange} />
      </View>
    </View>
  );
}

/** Ponto que pulsa — `@keyframes vezpulse` do canvas. */
export function PulseDot({ size = 7, tint = color.green }: { size?: number; tint?: string }) {
  const [value] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 0.35,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint,
        opacity: value,
      }}
    />
  );
}

/**
 * Hachura diagonal — o `repeating-linear-gradient(135deg, …)` do canvas.
 *
 * O React Native não tem gradiente repetido. São faixas giradas 45° dentro de
 * uma caixa que corta o excesso; o desenho é o mesmo e não custa uma imagem.
 */
export function Hatch({
  stripe = 6,
  light = "#FAFAFB",
  dark = "#F2F2F4",
}: {
  stripe?: number;
  light?: string;
  dark?: string;
}) {
  const bars = Array.from({ length: 40 }, (_, i) => i);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: light, overflow: "hidden" }]}>
      <View
        style={{
          position: "absolute",
          top: -300,
          left: -300,
          right: -300,
          bottom: -300,
          transform: [{ rotate: "45deg" }],
        }}
      >
        {bars.map((i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              top: i * stripe * 2,
              left: 0,
              right: 0,
              height: stripe,
              backgroundColor: dark,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** Círculo com as iniciais — cliente, profissional, dono. */
export function Initials({
  name,
  size = 44,
  background = color.rest,
}: {
  name: string;
  size?: number;
  background?: string;
}) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={sans(size >= 50 ? 17 : size >= 40 ? 15 : 13, 700)}>{letters || "?"}</Text>
    </View>
  );
}

/** Vazio com explicação e, quando faz sentido, uma saída. */
export function EmptyState({
  title,
  body,
  action,
  onAction,
  glyph,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  glyph?: ReactNode;
}) {
  return (
    <View style={{ paddingVertical: 44, paddingHorizontal: 32, alignItems: "center" }}>
      {glyph ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: color.rest,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          {glyph}
        </View>
      ) : null}
      <Text style={[sans(17, 700), { textAlign: "center" }]}>{title}</Text>
      <Text
        style={[
          sans(13.5, 400, { lh: 1.5, color: color.muted }),
          { textAlign: "center", marginTop: 6 },
        ]}
      >
        {body}
      </Text>
      {action ? (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: 18,
            paddingVertical: 13,
            paddingHorizontal: 20,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: color.line,
          }}
        >
          <Text style={sans(13.5, 700)}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Nota de honestidade.
 *
 * Aparece onde a tela mostra menos do que o desenho prometia. Existe porque o
 * pior estado possível de um app de operação é o que parece funcionar: um
 * interruptor que grava mas não faz nada é pior que interruptor nenhum, porque
 * o dono da barbearia vai contar com ele.
 */
export function Caveat({ children }: { children: string }) {
  return (
    <View
      style={{
        marginHorizontal: 20,
        padding: 14,
        borderRadius: 13,
        backgroundColor: color.rest,
      }}
    >
      <Text style={sans(12.5, 400, { lh: 1.5, color: color.muted })}>{children}</Text>
    </View>
  );
}

/** Faixa de erro de consulta, com opção de tentar de novo. */
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 14,
        padding: 14,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: color.coralBorder,
        backgroundColor: color.coralSoft,
        gap: 8,
      }}
    >
      <Text style={sans(13, 500, { lh: 1.4, color: color.coralDeep })}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={sans(13, 700, { color: color.coral })}>Tentar de novo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
