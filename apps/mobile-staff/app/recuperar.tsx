import { authErrorMessage, emailError, normalizeEmail } from "@vez/mobile-kit/auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { supabase } from "../lib/supabase";
import { AuthShell } from "../src/auth/AuthShell";
import { Field } from "../src/ui/Field";
import { PrimaryButton } from "../src/ui/primitives";

/** Passo 1 da recuperação: pedir o código de seis dígitos por e-mail. */
export default function Recuperar() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const invalid = emailError(email);
    setFieldError(invalid);
    if (invalid) return;

    setFormError(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email));
    setBusy(false);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }

    // Segue mesmo quando o e-mail não tem conta: o Supabase responde igual nos
    // dois casos de propósito, e dizer "não existe conta" transformaria a tela
    // num verificador de quem trabalha na plataforma.
    router.replace({ pathname: "/nova-senha", params: { email: normalizeEmail(email) } });
  }

  return (
    <AuthShell
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail. Se houver uma conta, enviamos um código de seis dígitos."
      error={formError}
      canGoBack
      footer={
        <View style={{ marginTop: 8 }}>
          <PrimaryButton
            label={busy ? "Enviando…" : "Enviar código"}
            height={54}
            onPress={busy ? undefined : submit}
            disabled={busy}
          />
        </View>
      }
    >
      <Field
        label="E-mail"
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          setFieldError(null);
        }}
        error={fieldError}
        placeholder="voce@exemplo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={busy ? undefined : submit}
      />
    </AuthShell>
  );
}
