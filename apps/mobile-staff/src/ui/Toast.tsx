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
import { Text, View } from "react-native";

import { color } from "../theme/tokens";

type Toast = { message: string; tone: "ok" | "bad" };

const ToastContext = createContext<((message: string, tone?: "ok" | "bad") => void) | null>(null);

/**
 * Confirmação do que acabou de acontecer.
 *
 * Toda ação deste app tem consequência fora da tela: chamar alguém, recusar um
 * pedido, marcar falta. Sem um retorno visível, o atendente toca duas vezes — e
 * na fila tocar duas vezes chama duas pessoas.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: "ok" | "bad" = "ok") => {
    setToast({ message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    timer.current = setTimeout(() => setToast(null), 2800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 104,
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
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return value;
}
