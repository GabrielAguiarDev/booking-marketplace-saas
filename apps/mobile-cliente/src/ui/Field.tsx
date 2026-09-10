import { Eye, EyeOff } from "lucide-react-native";
import { type ComponentProps, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { color, radius } from "../theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";

/**
 * Campo de texto do app.
 *
 * É o primeiro `TextInput` de verdade do projeto — no canvas todo campo era uma
 * área pressionável com texto fixo. Por isso os estados que o protótipo nunca
 * precisou desenhar (foco, erro, senha oculta) nascem aqui e valem para todas
 * as telas que vierem.
 */
export function Field({
  label,
  error,
  secure = false,
  ...input
}: {
  label: string;
  error?: string | null;
  secure?: boolean;
} & Omit<ComponentProps<typeof TextInput>, "secureTextEntry" | "style">) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // A borda comunica três coisas distintas e nesta ordem: erro vence foco,
  // porque um campo errado continua errado enquanto o usuário digita nele.
  const borderColor = error ? color.coral : focused ? color.ink : color.line;

  return (
    <View style={{ gap: 7 }}>
      <Text style={mono(10, 600, { ls: 0.12, color: error ? color.coral : color.muted })}>
        {label.toUpperCase()}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 52,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor,
          backgroundColor: color.bg,
          paddingHorizontal: 15,
          gap: 10,
        }}
      >
        <TextInput
          {...input}
          secureTextEntry={secure && !revealed}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          placeholderTextColor={color.chevron}
          style={[sans(15, 500, { ls: -0.01 }), { flex: 1, paddingVertical: 0 }]}
        />

        {secure ? (
          <Pressable onPress={() => setRevealed((v) => !v)} hitSlop={10}>
            {revealed ? (
              <EyeOff size={18} color={color.muted} strokeWidth={1.8} />
            ) : (
              <Eye size={18} color={color.muted} strokeWidth={1.8} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={sans(12.5, 500, { color: color.coral })}>{error}</Text> : null}
    </View>
  );
}

/**
 * Campo do código de seis dígitos.
 *
 * Um `TextInput` só, largo e espaçado, em vez de seis caixas separadas: seis
 * caixas exigem gerenciar foco entre elas, e colar o código do e-mail — que é o
 * que a maioria das pessoas faz — quebra em quase toda implementação delas.
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
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="––––––"
        placeholderTextColor={color.dotIdle}
        style={[
          mono(30, 600, { ls: 0.22 }),
          {
            height: 68,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: error ? color.coral : focused ? color.ink : color.line,
            textAlign: "center",
            paddingVertical: 0,
          },
        ]}
      />
      {error ? <Text style={sans(12.5, 500, { color: color.coral })}>{error}</Text> : null}
    </View>
  );
}
