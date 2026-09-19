import { useFocusEffect, useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { AuthGate } from "../../src/auth/AuthGate";
import { deleteAddress, setDefaultAddress, useAddresses } from "../../src/data/account";
import type { AddressRow } from "../../src/data/customer-db";
import { formatPostalCode } from "../../src/domain/account-validation";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { BackHeader, Card, PrimaryButton, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { ErrorState, useActionErrorText } from "../../src/ui/States";

/**
 * Endereços salvos.
 *
 * Para que servem, dito na tela: o principal é a referência de "perto de
 * você" quando a pessoa não compartilha a localização do aparelho. Nenhuma
 * loja vê o endereço — não há entrega nem atendimento em domicílio no MVP.
 */
function EnderecosConteudo() {
  const router = useRouter();
  const { data, loading, error, reload } = useAddresses(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const failureText = useActionErrorText(failure);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  async function tornarPrincipal(address: AddressRow) {
    setBusyId(address.id);
    setFailure(null);
    const result = await setDefaultAddress(address.id);
    setBusyId(null);
    if (!result.ok) setFailure(result.message);
    reload();
  }

  function apagar(address: AddressRow) {
    Alert.alert("Apagar endereço?", `"${address.label}" sai da sua lista.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          setBusyId(address.id);
          setFailure(null);
          const result = await deleteAddress(address.id);
          setBusyId(null);
          if (!result.ok) setFailure(result.message);
          reload();
        },
      },
    ]);
  }

  const cheio = (data?.length ?? 0) >= 10;

  return (
    <Screen>
      <ScreenScroll gap={18}>
        <BackHeader title="Endereços" onBack={() => router.back()} />

        <Text style={sans(14, 400, { lh: 1.5, color: color.muted })}>
          O endereço principal é usado para mostrar lojas perto de você quando a localização do
          aparelho está desligada. Nenhuma loja vê seus endereços.
        </Text>

        {failureText ? (
          <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{failureText}</Text>
        ) : null}

        {loading ? (
          <>
            <Shimmer width="100%" height={96} radius={16} />
            <Shimmer width="100%" height={96} radius={16} />
          </>
        ) : error ? (
          <ErrorState error={error} onRetry={reload} what="seus endereços" />
        ) : !data || data.length === 0 ? (
          <Card radius={16} padding={20} style={{ gap: 8 }}>
            <Text style={sans(17, 800, { ls: -0.03 })}>Nenhum endereço salvo</Text>
            <Text style={sans(14, 400, { lh: 1.5, color: color.muted })}>
              Salve sua casa ou trabalho para ver as lojas mais próximas mesmo sem compartilhar a
              localização.
            </Text>
          </Card>
        ) : (
          data.map((address) => (
            <Card key={address.id} radius={16} padding={15} style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                <MapPin size={18} color={color.muted} strokeWidth={1.8} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Text style={sans(15.5, 700, { ls: -0.02 })}>{address.label}</Text>
                    {address.is_default ? (
                      <Text style={mono(9, 600, { ls: 0.08, color: color.green })}>PRINCIPAL</Text>
                    ) : null}
                  </View>
                  <Text style={sans(13.5, 400, { lh: 1.4, color: color.body })}>
                    {[address.street, address.number].filter(Boolean).join(", ")}
                    {address.complement ? ` · ${address.complement}` : ""}
                  </Text>
                  <Text style={mono(10, 400, { ls: 0.05, color: color.muted })}>
                    {[address.neighborhood?.toUpperCase(), formatPostalCode(address.postal_code)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {address.latitude === null ? (
                    <Text style={sans(12, 500, { lh: 1.4, color: color.amberDeep })}>
                      Não localizamos este endereço no mapa; ele não serve de referência de
                      distância. Confira rua e CEP.
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 18, paddingLeft: 30 }}>
                <Acao
                  label="Editar"
                  disabled={busyId !== null}
                  onPress={() =>
                    router.push({ pathname: "/conta/endereco", params: { id: address.id } })
                  }
                />
                {!address.is_default ? (
                  <Acao
                    label={busyId === address.id ? "…" : "Tornar principal"}
                    disabled={busyId !== null}
                    onPress={() => tornarPrincipal(address)}
                  />
                ) : null}
                <Acao label="Apagar" disabled={busyId !== null} onPress={() => apagar(address)} />
              </View>
            </Card>
          ))
        )}

        {!loading && !error ? (
          cheio ? (
            <Text style={sans(13, 500, { color: color.muted })}>
              Você chegou ao limite de 10 endereços. Apague um para salvar outro.
            </Text>
          ) : (
            <PrimaryButton
              label="Adicionar endereço"
              height={50}
              onPress={() => router.push("/conta/endereco")}
            />
          )
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

function Acao({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={sans(13.5, 700, { color: disabled ? color.chevron : color.coral })}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function Enderecos() {
  return (
    <AuthGate>
      <EnderecosConteudo />
    </AuthGate>
  );
}
