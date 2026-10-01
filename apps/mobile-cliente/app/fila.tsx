import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { AuthGate } from "../src/auth/AuthGate";
import { useSession } from "../src/auth/session";
import { accentOf } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishments";
import { confirmArrival, leaveQueue, useMyQueueEntry, useQueueState } from "../src/data/queue";
import { hourMinute } from "@vez/mobile-kit/format";
import { useGoToTab } from "../src/navigation";
import { color } from "../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import {
  BackHeader,
  Card,
  Label,
  OutlineButton,
  PrimaryButton,
  PulseDot,
  Shimmer,
} from "../src/ui/primitives";
import { Ring } from "../src/ui/Ring";
import { Screen, ScreenScroll } from "../src/ui/Screen";
import { useActionErrorText } from "../src/ui/States";

function FilaConteudo() {
  const router = useRouter();
  const goToTab = useGoToTab();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { data: minhaEntrada, loading: loadingMine, reload: reloadMine } = useMyQueueEntry(true);
  const establishmentId = id ?? minhaEntrada?.establishment_id ?? null;

  const { data: shop } = useEstablishment(establishmentId);
  const { data: fila, loading } = useQueueState(establishmentId);
  // Qual das duas ações está indo. Um `busy` só fazia os dois botões
  // trocarem de rótulo juntos — "Confirmando…" e "Saindo…" ao mesmo tempo.
  const [busy, setBusy] = useState<"arrive" | "leave" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const failureText = useActionErrorText(failure);

  const accent = accentOf(shop);
  const eu = (fila ?? []).find((linha) => linha.customer_id === user?.id) ?? null;
  // Só quem está de fato na frente. A lista inteira sob o título "na sua
  // frente" contava também quem chegou depois.
  //
  // Posição zero não é "primeiro": é quem ainda não entrou na contagem (não
  // confirmou chegada numa loja que exige) ou já saiu dela (foi chamado, está
  // sendo atendido). Para quem está a caminho, todos os que contam estão na
  // frente.
  const naFrente = eu
    ? (fila ?? []).filter(
        (linha) =>
          linha.status === "waiting" &&
          linha.queue_position > 0 &&
          (eu.queue_position === 0 || linha.queue_position < eu.queue_position),
      )
    : [];

  // Sair perde o lugar, e não tem volta: entrar de novo é ir para o fim.
  function confirmarSaida() {
    Alert.alert(
      "Sair da fila?",
      "Você perde seu lugar. Se entrar de novo, volta para o fim da fila.",
      [
        { text: "Continuar na fila", style: "cancel" },
        { text: "Sair da fila", style: "destructive", onPress: () => void sair() },
      ],
    );
  }

  async function sair() {
    if (!minhaEntrada) return;
    setBusy("leave");
    setFailure(null);
    const ok = await leaveQueue(minhaEntrada.id);
    setBusy(null);
    if (!ok) {
      setFailure("Não foi possível sair da fila. Você continua nela; tente de novo.");
      return;
    }
    void reloadMine();
    goToTab("/(tabs)/agenda");
  }

  async function chegou() {
    if (!minhaEntrada) return;
    setBusy("arrive");
    setFailure(null);
    const ok = await confirmArrival(minhaEntrada.id);
    setBusy(null);
    if (!ok) {
      setFailure("Não foi possível confirmar sua chegada. Tente de novo ou avise no balcão.");
      return;
    }
    void reloadMine();
  }

  if (loadingMine || loading) {
    return (
      <Screen>
        <ScreenScroll gap={22}>
          <BackHeader title="Fila ao vivo" onBack={() => router.back()} />
          <Shimmer width="100%" height={160} radius={18} />
        </ScreenScroll>
      </Screen>
    );
  }

  if (!establishmentId || !eu) {
    return (
      <Screen>
        <ScreenScroll gap={18}>
          <BackHeader title="Fila ao vivo" onBack={() => router.back()} />
          <Card radius={18} padding={20} style={{ gap: 10 }}>
            <Text style={sans(18, 800, { ls: -0.03 })}>Você não está nesta fila</Text>
            <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
              Entre na fila pela página da loja. A posição aparece aqui e muda sozinha.
            </Text>
          </Card>
          <PrimaryButton label="Voltar" height={50} onPress={() => router.back()} />
        </ScreenScroll>
      </Screen>
    );
  }

  // O que o anel e o selo dizem. A posição vem do servidor; aqui só se
  // escolhe a frase para cada situação — e "0" nunca aparece como posição.
  const fase =
    eu.status === "in_service"
      ? "atendimento"
      : eu.status === "called"
        ? "chamado"
        : eu.queue_position === 0
          ? "a_caminho"
          : "esperando";
  const quaseLa = fase === "esperando" && eu.queue_position <= 2;
  const destaque = quaseLa || fase === "chamado";
  const selo =
    fase === "atendimento"
      ? "EM ATENDIMENTO"
      : fase === "chamado"
        ? "É A SUA VEZ"
        : fase === "a_caminho"
          ? "CONFIRME SUA CHEGADA"
          : quaseLa
            ? "QUASE NA SUA VEZ"
            : "AO VIVO";
  const anuncio =
    fase === "atendimento"
      ? "Você está sendo atendido"
      : fase === "chamado"
        ? "É a sua vez. Vá até o balcão."
        : fase === "a_caminho"
          ? "Você ainda não está na contagem. Confirme sua chegada quando estiver na loja."
          : `Sua posição na fila: ${eu.queue_position}`;

  return (
    <Screen>
      <ScreenScroll gap={22}>
        <BackHeader title="Fila ao vivo" onBack={() => router.back()} />

        <Card radius={20} padding={20} style={{ gap: 16, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PulseDot dotColor={destaque ? color.coral : color.green} />
            <Text
              style={mono(9.5, 600, { ls: 0.1, color: destaque ? color.coral : color.greenDeep })}
            >
              {selo}
            </Text>
          </View>

          <View accessible accessibilityLiveRegion="polite" accessibilityLabel={anuncio}>
            <Ring
              size={132}
              innerSize={104}
              pct={
                fase === "esperando"
                  ? Math.max(6, 100 - eu.queue_position * 12)
                  : fase === "a_caminho"
                    ? 0
                    : 100
              }
              color={destaque ? color.coral : accent}
            >
              <Text style={mono(38, 600, { ls: -0.03 })}>
                {fase === "esperando" ? eu.queue_position : fase === "a_caminho" ? "—" : "✓"}
              </Text>
            </Ring>
          </View>

          <View style={{ gap: 5, alignItems: "center" }}>
            <Text style={sans(19, 800, { ls: -0.03 })}>{shop?.name ?? "Sua vez"}</Text>
            <Text
              style={[mono(10.5, 400, { ls: 0.05, color: color.muted }), { textAlign: "center" }]}
            >
              {fase === "esperando"
                ? `ESPERA EST. ${eu.estimated_wait_minutes} MIN · ENTROU ${hourMinute(eu.joined_at)}`
                : fase === "a_caminho"
                  ? `ENTROU ${hourMinute(eu.joined_at)} · AINDA FORA DA CONTAGEM`
                  : fase === "chamado"
                    ? "VÁ ATÉ O BALCÃO"
                    : `ENTROU ${hourMinute(eu.joined_at)}`}
            </Text>
            {fase === "a_caminho" ? (
              <Text
                style={[
                  sans(13.5, 400, { lh: 1.45, color: color.body }),
                  { textAlign: "center", marginTop: 4 },
                ]}
              >
                Esta loja só conta quem já chegou. Confirme sua chegada quando estiver lá para pegar
                seu lugar.
              </Text>
            ) : null}
          </View>
        </Card>

        {/* Quem já foi chamado não tem ninguém na frente para ver. */}
        {fase === "esperando" || fase === "a_caminho" ? (
          <View style={{ gap: 11 }}>
            <Label>{fase === "a_caminho" ? "JÁ NA FILA" : "NA SUA FRENTE"}</Label>
            <Card radius={16}>
              {naFrente.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <Text style={sans(14, 400, { color: color.muted })}>
                    {fase === "a_caminho"
                      ? "Ninguém esperando agora."
                      : "Ninguém. Você é o próximo."}
                  </Text>
                </View>
              ) : (
                naFrente.map((linha, index) => (
                  <View
                    key={linha.entry_id}
                    style={{
                      padding: 14,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottomWidth: index === naFrente.length - 1 ? 0 : 1,
                      borderBottomColor: color.lineSoft,
                    }}
                  >
                    <Text style={sans(14.5, 500)}>Posição {linha.queue_position}</Text>
                    <Text style={mono(10.5, 500, { color: color.muted })}>
                      ~{linha.estimated_wait_minutes} MIN
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </View>
        ) : null}

        {failureText ? (
          <Card radius={14} padding={14} style={{ borderColor: color.coralBorder }}>
            <Text accessibilityRole="alert" style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>
              {failureText}
            </Text>
          </Card>
        ) : null}

        <View style={{ gap: 11 }}>
          {minhaEntrada?.arrived_at ? (
            <Card radius={14} padding={14}>
              <Text style={mono(9.5, 600, { ls: 0.08, color: color.greenDeep })}>
                CHEGADA CONFIRMADA ÀS {hourMinute(minhaEntrada.arrived_at)}
              </Text>
            </Card>
          ) : fase === "chamado" || fase === "atendimento" ? null : (
            <PrimaryButton
              label={busy === "arrive" ? "Confirmando…" : "Confirmar chegada"}
              height={52}
              background={busy ? color.chevron : accent}
              onPress={busy ? undefined : chegou}
            />
          )}
          {fase === "atendimento" ? null : (
            <OutlineButton
              label={busy === "leave" ? "Saindo…" : "Sair da fila"}
              height={48}
              onPress={busy ? undefined : confirmarSaida}
            />
          )}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

/** Exige conta: fila cria compromisso com o estabelecimento. */
export default function Fila() {
  return (
    <AuthGate>
      <FilaConteudo />
    </AuthGate>
  );
}
