import { useReducedMotion } from "@vez/mobile-kit/motion";
import { sans } from "@vez/mobile-kit/theme";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color } from "../theme/tokens";

type Toast = { id: number; message: string; tone: "ok" | "bad" };

const ToastContext = createContext<((message: string, tone?: "ok" | "bad") => void) | null>(null);

/**
 * Confirmação do que acabou de acontecer.
 *
 * Toda ação deste app tem consequência fora da tela: chamar alguém, recusar um
 * pedido, marcar falta. Sem um retorno visível, o atendente toca duas vezes — e
 * na fila tocar duas vezes chama duas pessoas.
 *
 * "Visível" não alcança quem usa leitor de tela, então a mensagem também é
 * anunciada. E a posição soma a área segura: com `bottom` fixo, em aparelho sem
 * botão físico o aviso nascia atrás da aba central.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const counter = useRef(0);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const show = useCallback((message: string, tone: "ok" | "bad" = "ok") => {
    counter.current += 1;
    setToast({ id: counter.current, message, tone });
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  useEffect(() => {
    if (!toast) return;

    if (reduced) opacity.setValue(1);
    else {
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    }

    // Erro fica mais tempo: é a mensagem que a pessoa precisa de fato ler.
    const timer = setTimeout(() => setToast(null), toast.tone === "bad" ? 4500 : 2800);
    return () => clearTimeout(timer);
  }, [toast, opacity, reduced]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          accessibilityLiveRegion={toast.tone === "bad" ? "assertive" : "polite"}
          accessibilityRole="alert"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 104 + insets.bottom,
            backgroundColor: color.ink,
            borderRadius: 14,
            paddingVertical: 13,
            paddingHorizontal: 15,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            shadowColor: "#14171A",
            shadowOpacity: 0.28,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
            opacity,
          }}
          pointerEvents="none"
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: toast.tone === "ok" ? color.green : color.danger,
            }}
          />
          <Text style={[sans(13.5, 600, { lh: 1.35, color: "#fff" }), { flex: 1 }]}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return value;
}
