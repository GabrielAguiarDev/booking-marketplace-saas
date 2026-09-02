import { useRouter } from "expo-router";
import { useCallback } from "react";

/**
 * Volta para uma aba a partir de uma tela empilhada.
 *
 * As telas de reserva vivem num Stack por cima das abas. Ir direto para uma
 * aba sem desempilhar deixaria loja/horário/pagamento vivos por baixo, e o
 * gesto de voltar do iOS traria de volta um fluxo que o usuário já concluiu.
 */
export function useGoToTab() {
  const router = useRouter();

  return useCallback(
    (route: string) => {
      if (router.canDismiss()) router.dismissAll();
      router.navigate(route as never);
    },
    [router],
  );
}
