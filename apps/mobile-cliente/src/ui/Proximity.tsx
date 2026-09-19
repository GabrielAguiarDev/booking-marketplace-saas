import { LocateFixed } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { Origin, PermissionState } from "../data/location";
import { color } from "../theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";

/**
 * Linha que explica a ordem da lista e oferece a localização.
 *
 * Cada estado diz de onde vem o "perto": do aparelho, de um endereço salvo, ou
 * de lugar nenhum (e aí a lista está por avaliação, e a linha diz isso).
 */
export function ProximityBar({
  origin,
  permission,
  locating,
  failed,
  onRequest,
  onRetry,
}: {
  origin: Origin | null;
  permission: PermissionState;
  locating: boolean;
  failed: boolean;
  onRequest: () => void;
  onRetry: () => void;
}) {
  let text: string;
  let action: { label: string; onPress: () => void } | null = null;

  if (locating) {
    text = "PROCURANDO SUA LOCALIZAÇÃO…";
  } else if (origin?.source === "device") {
    text = "MAIS PERTO DE VOCÊ PRIMEIRO";
  } else if (origin?.source === "address") {
    text = `MAIS PERTO DE ${(origin.label ?? "SEU ENDEREÇO").toUpperCase()}`;
    if (permission !== "granted") action = { label: "Usar localização", onPress: onRequest };
  } else if (permission === "granted" && failed) {
    text = "NÃO DEU PARA ACHAR SUA LOCALIZAÇÃO · POR AVALIAÇÃO";
    action = { label: "Tentar de novo", onPress: onRetry };
  } else if (permission === "blocked") {
    text = "LOCALIZAÇÃO DESLIGADA · POR AVALIAÇÃO";
    action = { label: "Abrir ajustes", onPress: onRequest };
  } else if (permission === "unknown") {
    text = "POR AVALIAÇÃO";
  } else {
    text = "POR AVALIAÇÃO";
    action = { label: "Ver mais perto", onPress: onRequest };
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={[mono(9.5, 600, { ls: 0.1, color: color.muted }), { flex: 1 }]}>{text}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
        >
          <LocateFixed size={14} color={color.coral} strokeWidth={2} />
          <Text style={sans(13, 700, { color: color.coral })}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
