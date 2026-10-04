import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReducedMotion } from "@vez/mobile-kit/motion";
import { sans } from "@vez/mobile-kit/theme";
import { color } from "../theme/tokens";

/**
 * Folha inferior — a regra R6: escolha curta acontece por cima da tela atual,
 * não num bloco que empurra o que a pessoa estava lendo.
 *
 * Fecha de três jeitos, porque cada pessoa procura um: tocar fora, o "×", e o
 * botão voltar do Android (`onRequestClose`).
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
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
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: color.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 20 + insets.bottom,
            maxHeight: "80%",
          }}
        >
          <View
            style={{
              width: 38,
              height: 4,
              borderRadius: 999,
              backgroundColor: color.dotIdle,
              alignSelf: "center",
              marginBottom: 14,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Text accessibilityRole="header" style={[sans(19, 800, { ls: -0.03 }), { flex: 1 }]}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: color.rest,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color={color.muted} strokeWidth={2.2} />
            </Pressable>
          </View>
          <View style={{ flexShrink: 1 }}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}
