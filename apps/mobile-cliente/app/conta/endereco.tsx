import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Switch, Text, View } from "react-native";

import { AuthGate } from "../../src/auth/AuthGate";
import { useSession } from "../../src/auth/session";
import { saveAddress, useAddresses } from "../../src/data/account";
import type { AddressRow } from "../../src/data/customer-db";
import { geocode } from "../../src/data/location";
import {
  type AddressInput,
  type FieldErrors,
  formatPostalCode,
  geocodeQuery,
  validateAddress,
} from "../../src/domain/account-validation";
import { color } from "../../src/theme/tokens";
import { sans } from "@vez/mobile-kit/theme";
import { Field } from "../../src/ui/Field";
import { BackHeader, Card, PrimaryButton, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { ErrorState, useActionErrorText } from "../../src/ui/States";

/**
 * Criar ou editar um endereço (`?id=` edita).
 *
 * Sem campo de cidade: o MVP não mostra localidade, e o CEP já localiza o
 * endereço para o geocoder. As coordenadas saem do geocoder do sistema no
 * próprio aparelho — nenhum serviço de mapa de terceiro recebe o endereço.
 */
function EnderecoConteudo() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, loading, error, reload } = useAddresses(true);

  const editing = id ? (data?.find((a) => a.id === id) ?? null) : null;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenScroll gap={18}>
          <BackHeader
            title={id ? "Editar endereço" : "Novo endereço"}
            onBack={() => router.back()}
          />

          {loading ? (
            <Shimmer width="100%" height={300} radius={16} />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} what="seus endereços" />
          ) : id && !editing ? (
            <Card radius={16} padding={18}>
              <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
                Este endereço não existe mais.
              </Text>
            </Card>
          ) : (
            <Formulario
              key={editing?.id ?? "novo"}
              address={editing}
              isFirst={(data?.length ?? 0) === 0}
              onSaved={() => router.back()}
            />
          )}
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Formulario({
  address,
  isFirst,
  onSaved,
}: {
  address: AddressRow | null;
  isFirst: boolean;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const [form, setForm] = useState<AddressInput>({
    label: address?.label ?? "",
    postalCode: formatPostalCode(address?.postal_code ?? null),
    street: address?.street ?? "",
    number: address?.number ?? "",
    complement: address?.complement ?? "",
    neighborhood: address?.neighborhood ?? "",
  });
  // O primeiro endereço nasce principal: sem isso ele não serviria de
  // referência até a pessoa descobrir o botão.
  const [makeDefault, setMakeDefault] = useState(address?.is_default ?? isFirst);
  const [errors, setErrors] = useState<FieldErrors<keyof AddressInput>>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const failureText = useActionErrorText(failure);

  const update = (key: keyof AddressInput) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function salvar() {
    if (!user) return;
    setFailure(null);
    const result = validateAddress(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setSaving(true);
    const coords = await geocode(geocodeQuery(result.value));
    const saved = await saveAddress({
      id: address?.id ?? null,
      customerId: user.id,
      value: result.value,
      coords,
      makeDefault: makeDefault && !address?.is_default,
    });
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
        label="Nome"
        value={form.label}
        onChangeText={update("label")}
        error={errors.label}
        placeholder="Casa, Trabalho…"
        maxLength={40}
      />
      <Field
        label="CEP"
        value={form.postalCode}
        onChangeText={update("postalCode")}
        error={errors.postalCode}
        placeholder="01310-100"
        keyboardType="number-pad"
        autoComplete="postal-code"
        textContentType="postalCode"
        maxLength={9}
      />
      <Field
        label="Rua"
        value={form.street}
        onChangeText={update("street")}
        error={errors.street}
        autoComplete="street-address"
        textContentType="streetAddressLine1"
        maxLength={120}
      />
      <View style={{ flexDirection: "row", gap: 11 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Número"
            value={form.number}
            onChangeText={update("number")}
            error={errors.number}
            maxLength={20}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Field
            label="Complemento"
            value={form.complement}
            onChangeText={update("complement")}
            error={errors.complement}
            maxLength={80}
          />
        </View>
      </View>
      <Field
        label="Bairro"
        value={form.neighborhood}
        onChangeText={update("neighborhood")}
        error={errors.neighborhood}
        maxLength={80}
      />

      {!address?.is_default ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={[sans(14.5, 600), { flex: 1 }]}>Usar como principal</Text>
          <Switch
            value={makeDefault}
            onValueChange={setMakeDefault}
            trackColor={{ true: color.coral, false: color.tabIdle }}
            accessibilityLabel="Usar como endereço principal"
          />
        </View>
      ) : null}

      {failureText ? (
        <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{failureText}</Text>
      ) : null}

      <PrimaryButton
        label={saving ? "Salvando…" : "Salvar endereço"}
        height={52}
        background={saving ? color.chevron : color.coral}
        onPress={saving ? undefined : salvar}
      />
    </>
  );
}

export default function Endereco() {
  return (
    <AuthGate>
      <EnderecoConteudo />
    </AuthGate>
  );
}
