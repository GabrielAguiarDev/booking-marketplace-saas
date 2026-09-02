import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { supabase } from "../lib/supabase";
import { AuthShell } from "../src/auth/AuthShell";
import { authErrorMessage } from "../src/auth/errors";
import { emailError, normalizeEmail } from "../src/auth/validation";
import { color } from "../src/theme/tokens";
import { Field } from "../src/ui/Field";
import { PrimaryButton } from "../src/ui/primitives";

/** Passo 1 da recuperação: pedir o código para o e-mail informado. */
export default function Recuperar() {
  const router = useRouter();
  // Vem preenchido quando o usuário desistiu na tela de entrar.
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

    // Sempre segue para a próxima tela, mesmo que o e-mail não tenha conta. O
    // Supabase responde igual nos dois casos de propósito: dizer "não existe
    // conta com esse e-mail" transforma a tela num verificador de quem é
    // cliente da plataforma.
    router.replace({ pathname: "/nova-senha", params: { email: normalizeEmail(email) } });
  }

  return (
    <AuthShell
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail. Se houver uma conta, enviamos um código de seis dígitos para redefinir a senha."
      error={formError}
      footer={
        <View style={{ marginTop: 8 }}>
          <PrimaryButton
            label={busy ? "Enviando…" : "Enviar código"}
            height={54}
            onPress={busy ? undefined : submit}
            background={busy ? color.chevron : color.coral}
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
