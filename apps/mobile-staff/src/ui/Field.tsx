import { sans } from "@vez/mobile-kit/theme";
import { Eye, EyeOff } from "lucide-react-native";
import { type ComponentProps, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { color } from "../theme/tokens";

/** Campo de texto do canvas: superfície de repouso, borda que engrossa no foco. */
export function Field({
  label,
  error,
  secure = false,
  mono: useMono = false,
  ...input
}: {
  label?: string;
  error?: string | null;
  secure?: boolean;
  mono?: boolean;
} & Omit<ComponentProps<typeof TextInput>, "secureTextEntry" | "style">) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Erro vence foco: um campo errado continua errado enquanto se digita nele.
  const borderColor = error ? color.coral : focused ? color.ink : color.line;

  return (
    <View style={{ gap: 7 }}>
      {label ? (
        <Text style={sans(11, 700, { ls: 1.1 / 11, color: error ? color.coral : color.muted })}>
          {label.toUpperCase()}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: color.rest,
          paddingHorizontal: 15,
          gap: 10,
        }}
      >
        <TextInput
          // O rótulo é um `Text` solto (ou só o placeholder); sem isto o
          // leitor de tela anuncia "campo de texto", sem dizer de quê.
          accessibilityLabel={
            [label ?? input.placeholder, error].filter(Boolean).join(". ") || undefined
          }
          {...input}
          secureTextEntry={secure && !revealed}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          placeholderTextColor={color.hint}
          style={[
            useMono
              ? { fontFamily: "IBMPlexMono_500Medium", fontSize: 15, color: color.ink }
              : sans(15, 600),
            { flex: 1, paddingVertical: 15 },
          ]}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            hitSlop={13}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Ocultar senha" : "Mostrar senha"}
          >
            {revealed ? (
              <EyeOff size={18} color={color.muted} strokeWidth={1.8} />
            ) : (
              <Eye size={18} color={color.muted} strokeWidth={1.8} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text accessibilityLiveRegion="polite" style={sans(12.5, 500, { color: color.coralDeep })}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Campo do código de seis dígitos.
 *
 * Um `TextInput` só, largo e espaçado, em vez de seis caixas: seis caixas
 * exigem gerenciar foco entre elas, e colar o código do e-mail — que é o que a
 * maioria das pessoas faz — quebra em quase toda implementação delas.
 */
export function CodeField({
  value,
  onChangeText,
  error,
}: {
  value: string;
  onChangeText: (next: string) => void;
  error?: string | null;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 9 }}>
      <TextInput
        value={value}
        // Só dígitos: teclado numérico não impede colar texto com espaços.
        onChangeText={(next) => onChangeText(next.replace(/\D/g, "").slice(0, 6))}
        accessibilityLabel={error ? `Código de seis dígitos. ${error}` : "Código de seis dígitos"}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="––––––"
        placeholderTextColor={color.track}
        style={[
          {
            fontFamily: "IBMPlexMono_600SemiBold",
            fontSize: 30,
            letterSpacing: 6.6,
            color: color.ink,
          },
          {
            height: 68,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: error ? color.coral : focused ? color.ink : color.line,
            textAlign: "center",
            paddingVertical: 0,
            backgroundColor: color.rest,
          },
        ]}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={sans(12.5, 500, { color: color.coralDeep })}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
