import {
  authErrorMessage,
  MIN_PASSWORD_LENGTH,
  passwordError,
  useCooldown,
} from "@vez/mobile-kit/auth";
import { sans } from "@vez/mobile-kit/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { supabase } from "../lib/supabase";
import { AuthShell } from "../src/auth/AuthShell";
import { color } from "../src/theme/tokens";
import { CodeField, Field } from "../src/ui/Field";
import { PrimaryButton, SectionLabel } from "../src/ui/primitives";

/**
 * Passo 2: código e senha nova na mesma tela.
 *
 * São duas chamadas em sequência — `verifyOtp` abre a sessão a partir do
 * código, `updateUser` troca a senha nessa sessão. Separar em duas telas
 * deixaria a pessoa logada no meio do caminho com a senha antiga ainda valendo,
 * sem ter como saber disso.
 */
export default function NovaSenha() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(60);

  if (!email) {
    return (
      <AuthShell
        title="Redefinir senha"
        subtitle="Precisamos do seu e-mail para validar o código."
        footer={
          <PrimaryButton label="Voltar" height={54} onPress={() => router.replace("/recuperar")} />
        }
      >
        <View />
      </AuthShell>
    );
  }

  async function submit() {
    const badCode = code.length < 6 ? "Digite os seis dígitos." : null;
    const badPass = passwordError(password);
    setCodeError(badCode);
    setPassError(badPass);
    if (badCode || badPass) return;

    setFormError(null);
    setBusy(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email as string,
      token: code,
      type: "recovery",
    });

    if (verifyError) {
      setBusy(false);
      setCodeError(authErrorMessage(verifyError));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      // A sessão já existe aqui, mas a senha continua a antiga. Dizer isso é
      // obrigatório: senão a pessoa sai achando que trocou.
      setFormError(`${authErrorMessage(updateError)} Sua senha antiga continua valendo.`);
      return;
    }

    router.replace("/");
  }

  async function resend() {
    setFormError(null);
    setNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email as string);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    cooldown.start();
    setNotice("Código reenviado.");
  }

  return (
    <AuthShell
      title="Redefinir senha"
      subtitle={`Digite o código enviado para ${email} e escolha uma senha nova.`}
      error={formError}
      canGoBack
      footer={
        <View style={{ gap: 18, marginTop: 8 }}>
          <PrimaryButton
            label={busy ? "Salvando…" : "Salvar nova senha"}
            height={54}
            onPress={busy ? undefined : submit}
            disabled={busy}
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
      <View style={{ gap: 9 }}>
        <SectionLabel tint={color.muted}>Código</SectionLabel>
        <CodeField value={code} onChangeText={setCode} error={codeError} />
      </View>

      <Field
        label="Nova senha"
        value={password}
        onChangeText={(next) => {
          setPassword(next);
          setPassError(null);
        }}
        error={passError}
        placeholder={`Ao menos ${MIN_PASSWORD_LENGTH} caracteres`}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={busy ? undefined : submit}
      />
    </AuthShell>
  );
}
