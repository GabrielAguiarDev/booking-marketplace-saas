import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { AuthGate } from "../src/auth/AuthGate";
import { useSession } from "../src/auth/session";
import { accentOf } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishments";
import { confirmArrival, leaveQueue, useMyQueueEntry, useQueueState } from "../src/data/queue";
import { hourMinute } from "../src/format";
import { useGoToTab } from "../src/navigation";
import { color } from "../src/theme/tokens";
import { mono, sans } from "../src/theme/type";
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

function FilaConteudo() {
  const router = useRouter();
  const goToTab = useGoToTab();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { data: minhaEntrada, loading: loadingMine, reload: reloadMine } = useMyQueueEntry(true);
  const establishmentId = id ?? minhaEntrada?.establishment_id ?? null;

  const { data: shop } = useEstablishment(establishmentId);
  const { data: fila, loading } = useQueueState(establishmentId);
  const [busy, setBusy] = useState(false);

  const accent = accentOf(shop);
  const eu = (fila ?? []).find((linha) => linha.customer_id === user?.id) ?? null;
  const esperando = (fila ?? []).filter((linha) => linha.status === "waiting");

  async function sair() {
    if (!minhaEntrada) return;
    setBusy(true);
    await leaveQueue(minhaEntrada.id);
    setBusy(false);
    reloadMine();
    goToTab("/(tabs)/agenda");
  }

  async function chegou() {
    if (!minhaEntrada) return;
    setBusy(true);
    await confirmArrival(minhaEntrada.id);
    setBusy(false);
    reloadMine();
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

  const quaseLa = eu.queue_position <= 2;

  return (
    <Screen>
      <ScreenScroll gap={22}>
        <BackHeader title="Fila ao vivo" onBack={() => router.back()} />

        <Card radius={20} padding={20} style={{ gap: 16, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PulseDot dotColor={quaseLa ? color.coral : color.green} />
            <Text style={mono(9.5, 600, { ls: 0.1, color: quaseLa ? color.coral : color.green })}>
              {quaseLa ? "QUASE NA SUA VEZ" : "AO VIVO"}
            </Text>
          </View>

          <Ring
            size={132}
            innerSize={104}
            pct={Math.max(6, 100 - eu.queue_position * 12)}
            color={quaseLa ? color.coral : accent}
          >
            <Text style={mono(38, 600, { ls: -0.03 })}>{eu.queue_position}</Text>
          </Ring>

          <View style={{ gap: 5, alignItems: "center" }}>
            <Text style={sans(19, 800, { ls: -0.03 })}>{shop?.name ?? "Sua vez"}</Text>
            <Text style={mono(10.5, 400, { ls: 0.05, color: color.muted })}>
              ESPERA EST. {eu.estimated_wait_minutes} MIN · ENTROU {hourMinute(eu.joined_at)}
            </Text>
          </View>
        </Card>

        <View style={{ gap: 11 }}>
          <Label>NA SUA FRENTE</Label>
          <Card radius={16}>
            {esperando.length === 0 ? (
              <View style={{ padding: 16 }}>
                <Text style={sans(14, 400, { color: color.muted })}>
                  Ninguém. Você é o próximo.
                </Text>
              </View>
            ) : (
              esperando.map((linha, index) => (
                <View
                  key={linha.entry_id}
                  style={{
                    padding: 14,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottomWidth: index === esperando.length - 1 ? 0 : 1,
                    borderBottomColor: color.lineSoft,
                    backgroundColor: linha.customer_id === user?.id ? color.rest : "transparent",
                  }}
                >
                  <Text style={sans(14.5, linha.customer_id === user?.id ? 700 : 500)}>
                    {linha.customer_id === user?.id ? "Você" : `Posição ${linha.queue_position}`}
                  </Text>
                  <Text style={mono(10.5, 500, { color: color.muted })}>
                    ~{linha.estimated_wait_minutes} MIN
                  </Text>
                </View>
              ))
            )}
          </Card>
        </View>

        <View style={{ gap: 11 }}>
          {minhaEntrada?.arrived_at ? (
            <Card radius={14} padding={14}>
              <Text style={mono(9.5, 600, { ls: 0.08, color: color.green })}>
                CHEGADA CONFIRMADA ÀS {hourMinute(minhaEntrada.arrived_at)}
              </Text>
            </Card>
          ) : (
            <PrimaryButton
              label={busy ? "Confirmando…" : "Confirmar chegada"}
              height={52}
              background={busy ? color.chevron : accent}
              onPress={busy ? undefined : chegou}
            />
          )}
          <OutlineButton
            label={busy ? "Saindo…" : "Sair da fila"}
            height={48}
            onPress={busy ? undefined : sair}
          />
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
