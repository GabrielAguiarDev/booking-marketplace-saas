import { useNetworkState } from "expo-network";

import { failureKind, type FailureKind } from "../domain/network";

/**
 * O aparelho está online? `null` enquanto o sistema ainda não respondeu —
 * "não sei" não é "offline", e mostrar a faixa de sem conexão no primeiro
 * quadro de toda tela seria alarme falso.
 */
export function useConnected(): boolean | null {
  const network = useNetworkState();
  if (network.isConnected === false || network.isInternetReachable === false) return false;
  if (network.isConnected === undefined) return null;
  return true;
}

/** Classifica a falha de uma leitura, usando o que o aparelho sabe da rede. */
export function useFailureKind(message: string | null): FailureKind | null {
  const connected = useConnected();
  if (!message) return null;
  return failureKind(message, connected);
}
