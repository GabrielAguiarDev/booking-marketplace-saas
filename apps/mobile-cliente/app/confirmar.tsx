import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { supabase } from "../lib/supabase";
import { AuthShell } from "../src/auth/AuthShell";
import { authErrorMessage } from "../src/auth/errors";
import { useCooldown } from "../src/auth/use-cooldown";
import { color } from "../src/theme/tokens";
import { sans } from "../src/theme/type";
import { CodeField } from "../src/ui/Field";
import { PrimaryButton } from "../src/ui/primitives";

/** Confirmação de conta: o código de 6 dígitos que chegou por e-mail. */
export default function Confirmar() {
  const router = useRouter();
  const { email, redirect } = useLocalSearchParams<{ email?: string; redirect?: string }>();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(60);

  // Chegar aqui sem e-mail é estado impossível pelo fluxo, mas possível por deep
  // link ou recarga. Sem o e-mail não há o que verificar — volta para o começo.
  if (!email) {
    return (
      <AuthShell
        title="Confirmar conta"
        subtitle="Precisamos do seu e-mail para verificar o código."
        footer={
          <PrimaryButton
            label="Voltar para o início"
            height={54}
            onPress={() => router.replace("/entrar")}
          />
        }
      >
        <View />
      </AuthShell>
    );
  }

  async function submit() {
    if (code.length < 6) {
      setError("Digite os seis dígitos.");
      return;
    }

    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email as string,
      token: code,
      type: "signup",
    });
    setBusy(false);

    if (verifyError) {
      setError(authErrorMessage(verifyError));
      return;
    }

    // `verifyOtp` já devolve sessão — a conta entra confirmada e logada.
    router.replace(redirect ? (redirect as never) : "/(tabs)/perfil");
  }

  async function resend() {
    setError(null);
    setNotice(null);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email as string,
    });

    if (resendError) {
      setError(authErrorMessage(resendError));
      return;
    }
    cooldown.start();
    setNotice("Código reenviado. Confira sua caixa de entrada.");
  }

  return (
    <AuthShell
      title="Confirmar conta"
      subtitle={`Enviamos um código de seis dígitos para ${email}.`}
      error={error}
      footer={
        <View style={{ gap: 18, marginTop: 8 }}>
          <PrimaryButton
            label={busy ? "Confirmando…" : "Confirmar"}
            height={54}
            onPress={busy ? undefined : submit}
            background={busy ? color.chevron : color.coral}
          />

          <Pressable
            onPress={cooldown.active ? undefined : resend}
            hitSlop={8}
            style={{ alignSelf: "center" }}
          >
            <Text style={sans(14, 600, { color: cooldown.active ? color.muted : color.ink })}>
              {cooldown.active
                ? `Reenviar código em ${cooldown.remaining}s`
                : "Não recebeu? Reenviar código"}
            </Text>
          </Pressable>

          {notice ? (
            <Text style={[sans(13, 500, { color: color.green }), { textAlign: "center" }]}>
              {notice}
            </Text>
          ) : null}
        </View>
      }
    >
      <CodeField value={code} onChangeText={setCode} />
    </AuthShell>
  );
}
