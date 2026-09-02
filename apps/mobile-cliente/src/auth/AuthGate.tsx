import { Redirect, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";

import { color } from "../theme/tokens";
import { useSession } from "./session";

/**
 * Envolve uma tela que exige conta.
 *
 * A regra de produto: buscar, explorar e ver a página da loja funcionam
 * deslogado — é o que faz o app ser útil antes de pedir cadastro. Só o que
 * gera compromisso com o estabelecimento (marcar horário, entrar na fila,
 * avaliar) exige sessão.
 *
 * O caminho atual vai como `redirect` para que o login devolva o usuário
 * exatamente onde ele estava. Sem isso ele volta para a Home e precisa refazer
 * a navegação inteira depois de entrar — que é o momento em que as pessoas
 * desistem.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const pathname = usePathname();

  // Enquanto o Keychain não responde não dá para saber se há sessão. Redirecionar
  // aqui mandaria para o login todo usuário logado a cada lançamento a frio.
  if (loading) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  if (!session) {
    return <Redirect href={{ pathname: "/entrar", params: { redirect: pathname } }} />;
  }

  return <>{children}</>;
}
