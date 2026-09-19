import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import { supabase } from "../../lib/supabase";
import { AuthGate } from "../../src/auth/AuthGate";
import { deleteAccount } from "../../src/data/account";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { Field } from "../../src/ui/Field";
import { BackHeader, Card, Label, PrimaryButton } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { useActionErrorText } from "../../src/ui/States";
import { useGoToTab } from "../../src/navigation";

/**
 * Exclusão de conta (LGPD, art. 18, VI).
 *
 * A tela repete, em português de gente, a política gravada na migration
 * `20260917120000_cliente_conta.sql` e executada pela Edge Function
 * `delete-account`. Se uma mudar, a outra muda junto: prometer apagar algo que
 * o servidor guarda seria o pior erro possível aqui.
 *
 * Digitar EXCLUIR é o freio: a ação não tem volta, e um botão só é fácil
 * demais de tocar por engano.
 */
const APAGADO = [
  "Nome, celular e foto do perfil",
  "Endereços salvos, favoritos e preferências de aviso",
  "Avisos recebidos e aparelhos cadastrados para notificação",
  "Conversas com o assistente",
  "O texto dos comentários das suas avaliações",
  "Seu e-mail de acesso e o login — a conta deixa de existir",
];

const CANCELADO = [
  "Reservas futuras são canceladas e o horário volta a ficar livre",
  "Se você estiver numa fila, sai dela",
];

const PRESERVADO = [
  "Reservas passadas, sem seu nome: fazem parte da agenda e do caixa da loja",
  "A nota e os marcadores das avaliações, sem autor: compõem a média da loja",
  "Registros de pagamento, pelo prazo que a lei fiscal exige",
  "Chamados de suporte, para defesa em caso de disputa",
];

const CONFIRMATION = "EXCLUIR";

function ExcluirConteudo() {
  const router = useRouter();
  const goToTab = useGoToTab();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const failureText = useActionErrorText(failure);

  const ready = typed.trim().toUpperCase() === CONFIRMATION;

  async function excluir() {
    setBusy(true);
    setFailure(null);
    const result = await deleteAccount(typed);
    if (!result.ok) {
      setBusy(false);
      setFailure(result.message);
      return;
    }
    // Sai desta tela antes de derrubar a sessão: com a sessão nula, o
    // AuthGate daqui redirecionaria para o login com volta para cá.
    goToTab("/perfil");
    // O servidor já encerrou o acesso; limpar a sessão local derruba o
    // estado logado em todas as telas pelo `onAuthStateChange`. `local`
    // porque o token remoto já não vale — pedir revogação daria 401.
    await supabase.auth.signOut({ scope: "local" });
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenScroll gap={20}>
          <BackHeader title="Excluir conta" onBack={() => router.back()} />

          <Text style={sans(14.5, 400, { lh: 1.5, color: color.body })}>
            A exclusão é imediata e não pode ser desfeita. Veja o que acontece com cada informação:
          </Text>

          <Bloco titulo="APAGADO" itens={APAGADO} />
          <Bloco titulo="CANCELADO" itens={CANCELADO} />
          <Bloco titulo="GUARDADO SEM IDENTIFICAÇÃO" itens={PRESERVADO} />

          <Text style={sans(12.5, 400, { lh: 1.5, color: color.muted })}>
            O que fica guardado não aponta mais para você: nome, contato e login são removidos.
            Guardamos só o que a lei manda ou o que a loja precisa para manter o próprio histórico.
            Se você administra uma loja no Vez, transfira a loja pelo suporte antes de excluir.
          </Text>

          <Field
            label={`Digite ${CONFIRMATION} para confirmar`}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          {failureText ? (
            <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{failureText}</Text>
          ) : null}

          <PrimaryButton
            label={busy ? "Excluindo…" : "Excluir minha conta"}
            height={52}
            background={ready && !busy ? "#B33A1F" : color.chevron}
            onPress={ready && !busy ? excluir : undefined}
          />
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <View style={{ gap: 9 }}>
      <Label>{titulo}</Label>
      <Card radius={14} padding={14} style={{ gap: 8 }}>
        {itens.map((item) => (
          <View key={item} style={{ flexDirection: "row", gap: 9 }}>
            <Text style={mono(12, 600, { color: color.muted })}>·</Text>
            <Text style={[sans(13.5, 400, { lh: 1.45, color: color.body }), { flex: 1 }]}>
              {item}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function Excluir() {
  return (
    <AuthGate>
      <ExcluirConteudo />
    </AuthGate>
  );
}
