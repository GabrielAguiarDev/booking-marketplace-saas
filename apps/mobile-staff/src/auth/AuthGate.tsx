import { sans } from "@vez/mobile-kit/theme";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { Linking, Text, View } from "react-native";

import { useEstablishment } from "../data/establishment";
import { portalUrl } from "../portal";
import { color } from "../theme/tokens";
import { EmptyState } from "../ui/primitives";
import { Screen } from "../ui/Screen";
import { useSession } from "./session";

/**
 * Portão do app inteiro.
 *
 * Aqui não existe o "olhe antes de entrar" do app do cliente: não há nada para
 * ver sem conta, porque tudo é a operação de uma loja específica. E há uma
 * segunda porta depois do login, que o app do cliente não tem — ter conta não
 * basta, é preciso ser equipe de alguma loja.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const { loading, error, memberships } = useEstablishment();

  if (sessionLoading) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  if (!session) return <Redirect href="/entrar" />;

  if (loading) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  if (error) {
    return (
      <Screen>
        <EmptyState title="Não deu para carregar" body={error} />
      </Screen>
    );
  }

  if (memberships.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            title="Esta conta não é equipe de nenhuma loja"
            body="Se você trabalha numa loja, peça ao dono para incluir seu e-mail na equipe pelo portal. Se a loja é sua, cadastre-a no portal web com esta mesma conta: depois da aprovação da Vez, ela aparece aqui."
            action="Cadastrar minha loja no portal"
            onAction={() => void Linking.openURL(portalUrl())}
          />
          <Text
            style={[
              sans(12.5, 400, { lh: 1.5, color: color.muted }),
              { textAlign: "center", paddingHorizontal: 32 },
            ]}
          >
            Se você é cliente e quer agendar, o app é o Vez.
          </Text>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}
