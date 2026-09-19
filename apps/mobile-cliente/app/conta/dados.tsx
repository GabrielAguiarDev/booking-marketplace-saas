import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text } from "react-native";

import { AuthGate } from "../../src/auth/AuthGate";
import { useSession } from "../../src/auth/session";
import { updatePersonal } from "../../src/data/account";
import { type Profile, useProfile } from "../../src/data/use-profile";
import {
  type FieldErrors,
  formatPhone,
  type PersonalInput,
  validatePersonal,
} from "../../src/domain/account-validation";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { Field } from "../../src/ui/Field";
import { BackHeader, Card, PrimaryButton, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { ErrorState, useActionErrorText } from "../../src/ui/States";

/**
 * Dados pessoais: nome e telefone.
 *
 * O e-mail aparece mas não se edita aqui: ele é o login, e trocá-lo exige
 * confirmar o endereço novo por código — um fluxo de autenticação, não um
 * campo de formulário. Até existir, a troca é pelo suporte.
 *
 * O telefone é guardado em E.164 (`+55…`) para a loja conseguir ligar e para
 * o mesmo número não existir em três grafias.
 */
function DadosConteudo() {
  const router = useRouter();
  const { user } = useSession();
  const { profile, loading, error, reload } = useProfile();

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenScroll gap={20}>
          <BackHeader title="Dados pessoais" onBack={() => router.back()} />

          {loading ? (
            <>
              <Shimmer width="100%" height={74} radius={14} />
              <Shimmer width="100%" height={74} radius={14} />
            </>
          ) : error || !profile || !user ? (
            <ErrorState error="profile" onRetry={reload} what="seus dados" />
          ) : (
            // `key` recria o formulário se a conta mudar: o estado inicial vem
            // do perfil, e não pode sobreviver a uma troca de usuário.
            <Formulario
              key={user.id}
              userId={user.id}
              email={user.email ?? ""}
              profile={profile}
              onSaved={() => {
                reload();
                router.back();
              }}
            />
          )}
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Formulario({
  userId,
  email,
  profile,
  onSaved,
}: {
  userId: string;
  email: string;
  profile: Profile;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PersonalInput>({
    fullName: profile.fullName ?? "",
    phone: formatPhone(profile.phone),
  });
  const [errors, setErrors] = useState<FieldErrors<keyof PersonalInput>>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const failureText = useActionErrorText(failure);

  const update = (key: keyof PersonalInput) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function salvar() {
    setFailure(null);
    const result = validatePersonal(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    const saved = await updatePersonal(userId, result.value);
    setSaving(false);
    if (!saved.ok) {
      setFailure(saved.message);
      return;
    }
    onSaved();
  }

  return (
    <>
      <Field
        label="Nome completo"
        value={form.fullName}
        onChangeText={update("fullName")}
        error={errors.fullName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={80}
      />
      <Field
        label="Celular"
        value={form.phone}
        onChangeText={update("phone")}
        error={errors.phone}
        placeholder="(11) 98765-4321"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={20}
      />

      <Card radius={14} padding={14} style={{ gap: 5 }}>
        <Text style={mono(10, 600, { ls: 0.12, color: color.muted })}>E-MAIL DE ACESSO</Text>
        <Text style={sans(15, 500)}>{email}</Text>
        <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>
          É o seu login. Para trocar, abra um chamado em Ajuda.
        </Text>
      </Card>

      <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>
        A loja em que você reserva vê seu nome e celular para confirmar o horário.
      </Text>

      {failureText ? (
        <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{failureText}</Text>
      ) : null}

      <PrimaryButton
        label={saving ? "Salvando…" : "Salvar"}
        height={52}
        background={saving ? color.chevron : color.coral}
        onPress={saving ? undefined : salvar}
      />
    </>
  );
}

export default function Dados() {
  return (
    <AuthGate>
      <DadosConteudo />
    </AuthGate>
  );
}
