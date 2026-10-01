import { sans } from "@vez/mobile-kit/theme";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { Linking, Text, View } from "react-native";

import { useEstablishment } from "../data/establishment";
import { portalUrl } from "../portal";
import { signOut } from "../push";
import { color } from "../theme/tokens";
import { EmptyState, OutlineButton } from "../ui/primitives";
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
  const { loading, error, memberships, reload } = useEstablishment();
  const { user } = useSession();
  const [leaving, setLeaving] = useState(false);

  // As duas paradas abaixo (erro e conta sem loja) acontecem antes das abas, e
  // é nas abas que mora o "sair". Sem esta saída, quem entrou com o e-mail
  // errado ficava preso numa tela sem volta.
  const sair = (
    <View style={{ paddingHorizontal: 32, paddingTop: 22, gap: 10 }}>
      {user?.email ? (
        <Text style={[sans(12.5, 500, { color: color.muted }), { textAlign: "center" }]}>
          Você entrou como {user.email}
        </Text>
      ) : null}
      <OutlineButton
        label={leaving ? "Saindo…" : "Sair e entrar com outra conta"}
        disabled={leaving}
        onPress={() => {
          setLeaving(true);
          // Sem navegação: a sessão cai e este mesmo portão redireciona.
          void signOut().finally(() => setLeaving(false));
        }}
      />
    </View>
  );

  if (sessionLoading) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  if (!session) return <Redirect href="/entrar" />;

  if (loading) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  if (error) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            title="Não deu para carregar"
            body={`${error} Confira a conexão e tente de novo.`}
            action="Tentar de novo"
            onAction={reload}
          />
          {sair}
        </View>
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
          {sair}
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}
