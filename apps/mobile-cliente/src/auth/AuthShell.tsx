import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { color, radius } from "../theme/tokens";
import { sans } from "@vez/mobile-kit/theme";
import { BackHeader } from "../ui/primitives";
import { Screen } from "../ui/Screen";

/**
 * Moldura das telas de autenticação.
 *
 * As cinco telas do fluxo compartilham cabeçalho, comportamento de teclado e
 * faixa de erro. Repetir isso cinco vezes garantiria que uma delas divergisse —
 * e a que divergisse seria justamente a que ninguém testa.
 */
export function AuthShell({
  title,
  subtitle,
  error,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  /** Erro do servidor, que vale para o formulário inteiro. Erro de um campo vive no `Field`. */
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Sem isto o teclado cobre o campo em foco em telas pequenas e o
          // usuário digita sem ver o que digita.
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 34,
            gap: 24,
          }}
        >
          <BackHeader onBack={() => router.back()} />

          <View style={{ gap: 9 }}>
            <Text style={sans(30, 800, { ls: -0.04 })}>{title}</Text>
            <Text style={sans(15, 400, { lh: 1.45, color: color.muted })}>{subtitle}</Text>
          </View>

          {error ? (
            <View
              style={{
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.coralBorder,
                backgroundColor: "#FFF4F1",
                paddingVertical: 12,
                paddingHorizontal: 14,
              }}
            >
              <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{error}</Text>
            </View>
          ) : null}

          <View style={{ gap: 16 }}>{children}</View>

          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
