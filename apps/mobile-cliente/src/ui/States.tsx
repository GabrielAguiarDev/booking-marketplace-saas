import { WifiOff } from "lucide-react-native";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConnected, useFailureKind } from "../data/connectivity";
import { color } from "../theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { Card, OutlineButton } from "./primitives";

/**
 * Faixa fixa de "sem conexão", no topo de qualquer tela.
 *
 * Fica no layout raiz para valer em todas as telas sem cada uma lembrar de
 * desenhá-la. Não bloqueia nada: o que já estava na tela continua legível, e
 * as ações que precisam de rede falham com mensagem própria.
 */
export function OfflineBanner() {
  const connected = useConnected();
  const insets = useSafeAreaInsets();
  if (connected !== false) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        top: insets.top + 4,
        left: 16,
        right: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: color.ink,
      }}
    >
      <WifiOff size={15} color="#fff" strokeWidth={2} />
      <Text style={[sans(13, 600, { color: "#fff" }), { flex: 1 }]}>
        Sem conexão. Mostrando o que já foi carregado.
      </Text>
    </View>
  );
}

/**
 * Cartão de falha de leitura, com o motivo certo: sem internet pede para
 * esperar o sinal; erro do servidor pede para tentar de novo.
 */
export function ErrorState({
  error,
  onRetry,
  what = "estas informações",
}: {
  error: string | null;
  onRetry: () => void;
  /** O que não carregou, para a frase: "Não conseguimos carregar {what}." */
  what?: string;
}) {
  const kind = useFailureKind(error ?? "erro");

  return (
    <Card radius={16} padding={18} style={{ gap: 12 }}>
      <Text style={mono(9.5, 600, { ls: 0.1, color: color.muted })}>
        {kind === "offline" ? "SEM CONEXÃO" : "ALGO DEU ERRADO"}
      </Text>
      <Text style={sans(14.5, 400, { lh: 1.5, color: color.body })}>
        {kind === "offline"
          ? `Você está sem internet. Conecte-se para carregar ${what}.`
          : `Não conseguimos carregar ${what}. Tente de novo em instantes.`}
      </Text>
      <OutlineButton label="Tentar de novo" height={44} onPress={onRetry} />
    </Card>
  );
}

/** Mensagem de falha de uma ação (salvar, remarcar), já considerando a rede. */
export function useActionErrorText(message: string | null): string | null {
  const connected = useConnected();
  if (!message) return null;
  if (connected === false) return "Você está sem internet. Conecte-se e tente de novo.";
  return message;
}
