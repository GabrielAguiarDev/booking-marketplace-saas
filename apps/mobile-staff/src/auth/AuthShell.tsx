import { sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { color } from "../theme/tokens";
import { Screen } from "../ui/Screen";

/** Moldura das telas de conta: cabeçalho, comportamento de teclado, faixa de erro. */
export function AuthShell({
  title,
  subtitle,
  error,
  canGoBack = false,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  error?: string | null;
  canGoBack?: boolean;
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
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 34,
            gap: 22,
          }}
        >
          {canGoBack ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{ alignSelf: "flex-start" }}
            >
              <Text style={sans(24, 400, { lh: 1 })}>‹</Text>
            </Pressable>
          ) : (
            <View style={{ height: 8 }} />
          )}

          <View style={{ gap: 9 }}>
            <Text style={sans(28, 800, { ls: -0.04 })}>{title}</Text>
            <Text style={sans(15, 400, { lh: 1.45, color: color.muted })}>{subtitle}</Text>
          </View>

          {error ? (
            <View
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: color.coralBorder,
                backgroundColor: color.coralSoft,
                paddingVertical: 12,
                paddingHorizontal: 14,
              }}
            >
              <Text style={sans(13.5, 500, { lh: 1.4, color: color.coralDeep })}>{error}</Text>
            </View>
          ) : null}

          <View style={{ gap: 16 }}>{children}</View>

          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
