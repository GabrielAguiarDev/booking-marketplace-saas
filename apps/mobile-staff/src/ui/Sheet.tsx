import { useReducedMotion } from "@vez/mobile-kit/motion";
import { sans } from "@vez/mobile-kit/theme";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, sheetShadow } from "../theme/tokens";

/**
 * Folha inferior — a regra R6 do projeto.
 *
 * Escolha curta acontece por cima da tela atual, nunca empurrando o que a
 * pessoa já estava lendo. Vale duas vezes aqui: a fila muda sozinha, e uma
 * lista que salta sob o dedo enquanto alguém digita o nome de quem chegou é
 * como se perde o cliente do balcão.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(20,23,26,0.35)", justifyContent: "flex-end" }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            accessibilityViewIsModal
            style={[
              {
                backgroundColor: color.bg,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 24 + insets.bottom,
              },
              sheetShadow,
            ]}
          >
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 999,
                backgroundColor: color.stroke,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <Text accessibilityRole="header" style={sans(19, 800, { ls: -0.3 / 19 })}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[sans(13, 400, { lh: 1.45, color: color.muted }), { marginTop: 5 }]}>
                {subtitle}
              </Text>
            ) : null}
            <View style={{ marginTop: 16 }}>{children}</View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
