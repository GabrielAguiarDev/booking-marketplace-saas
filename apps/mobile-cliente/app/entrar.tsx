import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { supabase } from "../lib/supabase";
import { AuthShell } from "../src/auth/AuthShell";
import { authErrorMessage } from "../src/auth/errors";
import { emailError, normalizeEmail } from "../src/auth/validation";
import { color } from "../src/theme/tokens";
import { sans } from "../src/theme/type";
import { Field } from "../src/ui/Field";
import { PrimaryButton } from "../src/ui/primitives";

export default function Entrar() {
  const router = useRouter();
  // `redirect` guarda para onde o usuário estava indo quando esbarrou no login.
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const errors = {
      email: emailError(email) ?? undefined,
      // Aqui não se valida tamanho de senha: a regra pode ter mudado desde que
      // a conta foi criada, e dizer "senha curta" a quem tem senha antiga
      // manda a pessoa para o lugar errado.
      password: password ? undefined : "Informe sua senha.",
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setFormError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    setBusy(false);

    if (error) {
      // Conta existe mas nunca foi confirmada: em vez de um beco sem saída,
      // manda direto para a tela do código, que sabe reenviá-lo.
      if (error.code === "email_not_confirmed") {
        router.replace({
          pathname: "/confirmar",
          params: { email: normalizeEmail(email), redirect },
        });
        return;
      }
      setFormError(authErrorMessage(error));
      return;
    }

    // `replace`, não `push`: a tela de entrar não pode voltar por gesto depois
    // de a sessão existir.
    router.replace(redirect ? (redirect as never) : "/(tabs)/perfil");
  }

  return (
    <AuthShell
      title="Entrar"
      subtitle="Use o e-mail e a senha da sua conta Vez."
      error={formError}
      footer={
        <View style={{ gap: 18, marginTop: 8 }}>
          <PrimaryButton
            label={busy ? "Entrando…" : "Entrar"}
            height={54}
            onPress={busy ? undefined : submit}
            background={busy ? color.chevron : color.coral}
          />

          <Pressable
            onPress={() => router.push({ pathname: "/recuperar", params: { email } })}
            hitSlop={8}
            style={{ alignSelf: "center" }}
          >
            <Text style={sans(14, 600, { color: color.ink })}>Esqueci minha senha</Text>
          </Pressable>

          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            <Text style={sans(14, 400, { color: color.muted })}>Não tem conta?</Text>
            <Pressable
              onPress={() => router.replace({ pathname: "/cadastro", params: { redirect } })}
              hitSlop={8}
            >
              <Text style={sans(14, 700, { color: color.coral })}>Criar conta</Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <Field
        label="E-mail"
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          setFieldErrors((prev) => ({ ...prev, email: undefined }));
        }}
        error={fieldErrors.email}
        placeholder="voce@exemplo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />

      <Field
        label="Senha"
        value={password}
        onChangeText={(next) => {
          setPassword(next);
          setFieldErrors((prev) => ({ ...prev, password: undefined }));
        }}
        error={fieldErrors.password}
        placeholder="••••••••"
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={busy ? undefined : submit}
      />
    </AuthShell>
  );
}
