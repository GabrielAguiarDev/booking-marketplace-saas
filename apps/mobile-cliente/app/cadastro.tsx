import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { supabase } from "../lib/supabase";
import { AuthShell } from "../src/auth/AuthShell";
import { authErrorMessage } from "../src/auth/errors";
import {
  emailError,
  MIN_PASSWORD_LENGTH,
  nameError,
  normalizeEmail,
  passwordError,
} from "../src/auth/validation";
import { color } from "../src/theme/tokens";
import { sans } from "../src/theme/type";
import { Field } from "../src/ui/Field";
import { PrimaryButton } from "../src/ui/primitives";

export default function Cadastro() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const errors = {
      name: nameError(name) ?? undefined,
      email: emailError(email) ?? undefined,
      password: passwordError(password) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.password) return;

    setFormError(null);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      // `full_name` é lido pelo gatilho `handle_new_user()`, que cria a linha em
      // `public.profiles`. Sem este metadado o perfil nasce sem nome.
      options: { data: { full_name: name.trim() } },
    });
    setBusy(false);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }

    // Com `enable_confirmations = true` o signUp não devolve sessão: devolve um
    // usuário pendente e manda o código por e-mail.
    router.replace({
      pathname: "/confirmar",
      params: { email: normalizeEmail(email), redirect },
    });
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Leva um minuto. Você vai receber um código por e-mail para confirmar."
      error={formError}
      footer={
        <View style={{ gap: 18, marginTop: 8 }}>
          <PrimaryButton
            label={busy ? "Criando…" : "Criar conta"}
            height={54}
            onPress={busy ? undefined : submit}
            background={busy ? color.chevron : color.coral}
          />

          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            <Text style={sans(14, 400, { color: color.muted })}>Já tem conta?</Text>
            <Pressable
              onPress={() => router.replace({ pathname: "/entrar", params: { redirect } })}
              hitSlop={8}
            >
              <Text style={sans(14, 700, { color: color.coral })}>Entrar</Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <Field
        label="Nome"
        value={name}
        onChangeText={(next) => {
          setName(next);
          setFieldErrors((prev) => ({ ...prev, name: undefined }));
        }}
        error={fieldErrors.name}
        placeholder="Como quer ser chamado"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />

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
