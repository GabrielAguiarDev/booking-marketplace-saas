import { authErrorMessage, emailError, normalizeEmail } from "@vez/mobile-kit/auth";
import { sans } from "@vez/mobile-kit/theme";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { supabase } from "../lib/supabase";
import { AuthShell } from "../src/auth/AuthShell";
import { useSession } from "../src/auth/session";
import { color } from "../src/theme/tokens";
import { Field } from "../src/ui/Field";
import { PrimaryButton } from "../src/ui/primitives";

/**
 * Entrar.
 *
 * Não existe "criar conta" aqui, e a ausência é deliberada: quem entra neste
 * app é equipe de uma loja que já existe. Cadastro de estabelecimento ainda não
 * existe em superfície nenhuma (item 3 de proximos-passos.md) — inventar um
 * botão daria a impressão contrária.
 */
export default function Entrar() {
  const router = useRouter();
  const { session, loading } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Redirect href="/" />;

  async function submit() {
    const errors = {
      email: emailError(email) ?? undefined,
      // Não se valida tamanho de senha na entrada: a regra pode ter mudado
      // desde que a conta foi criada, e dizer "senha curta" a quem tem senha
      // antiga manda a pessoa para o lugar errado.
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
      setFormError(authErrorMessage(error));
      return;
    }
    router.replace("/");
  }

  return (
    <AuthShell
      title="Vez para estabelecimentos"
      subtitle="O outro lado do app: sua agenda, sua fila e sua loja."
      error={formError}
      footer={
        <View style={{ gap: 18, marginTop: 8 }}>
          <PrimaryButton
            label={busy ? "Entrando…" : "Entrar"}
            height={54}
            onPress={busy ? undefined : submit}
            disabled={busy}
          />

          <Pressable
            onPress={() => router.push({ pathname: "/recuperar", params: { email } })}
            hitSlop={8}
            style={{ alignSelf: "center" }}
          >
            <Text style={sans(14, 600)}>Esqueci minha senha</Text>
          </Pressable>

          <Text
            style={[
              sans(12.5, 400, { lh: 1.5, color: color.muted }),
              { textAlign: "center", paddingHorizontal: 10 },
            ]}
          >
            O acesso é dado pelo dono da loja. Se você deveria estar aqui e não consegue entrar,
            fale com ele.
          </Text>
        </View>
      }
    >
      <Field
        label="E-mail"
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          setFieldErrors((previous) => ({ ...previous, email: undefined }));
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
          setFieldErrors((previous) => ({ ...previous, password: undefined }));
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
