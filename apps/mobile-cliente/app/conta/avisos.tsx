import { useRouter } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";

import { AuthGate } from "../../src/auth/AuthGate";
import { useSession } from "../../src/auth/session";
import {
  type NotificationPrefs,
  saveNotificationPrefs,
  useNotificationPrefs,
} from "../../src/data/account";
import { color } from "../../src/theme/tokens";
import { sans } from "@vez/mobile-kit/theme";
import { BackHeader, Card, Label, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { PushCard } from "../../src/ui/PushCard";
import { ErrorState, useActionErrorText } from "../../src/ui/States";

/**
 * Preferências de aviso.
 *
 * As escolhas ficam em `customer_notification_prefs`, que o despacho de avisos
 * consulta antes de enfileirar (`notification_customer_allows`). Acima delas,
 * o `PushCard` diz se este aparelho recebe e se os últimos avisos saíram.
 * Novidades nascem desligadas (LGPD: marketing só com consentimento).
 */
const ITEMS: { key: keyof NotificationPrefs; title: string; text: string; group: string }[] = [
  {
    key: "queue_turn",
    title: "Sua vez na fila",
    text: "Quando a loja chamar você ou faltar pouco para a sua vez.",
    group: "FILA",
  },
  {
    key: "appointment_reminder",
    title: "Lembrete de horário",
    text: "Antes de um horário marcado, para dar tempo de chegar ou remarcar.",
    group: "RESERVAS",
  },
  {
    key: "appointment_changes",
    title: "Mudanças na reserva",
    text: "Se a loja confirmar, remarcar ou cancelar um horário seu.",
    group: "RESERVAS",
  },
  {
    key: "review_request",
    title: "Pedido de avaliação",
    text: "Depois do atendimento, um convite para avaliar a loja.",
    group: "RESERVAS",
  },
  {
    key: "marketing",
    title: "Novidades e promoções",
    text: "Lojas novas e ofertas. Desligado até você ligar.",
    group: "OUTROS",
  },
];

function AvisosConteudo() {
  const router = useRouter();
  const { user } = useSession();
  const { data, loading, error, reload } = useNotificationPrefs(true);

  return (
    <Screen>
      <ScreenScroll gap={20}>
        <BackHeader title="Avisos" onBack={() => router.back()} />

        <Text style={sans(13.5, 400, { lh: 1.5, color: color.muted })}>
          Estas escolhas valem para todo aviso que o Vez envia a você. O que estiver desligado aqui
          não é enviado.
        </Text>

        <PushCard />

        {loading ? (
          <Shimmer width="100%" height={320} radius={16} />
        ) : error || !data || !user ? (
          <ErrorState error={error} onRetry={reload} what="suas preferências" />
        ) : (
          <Preferencias key={user.id} userId={user.id} initial={data} onSaved={reload} />
        )}
      </ScreenScroll>
    </Screen>
  );
}

function Preferencias({
  userId,
  initial,
  onSaved,
}: {
  userId: string;
  initial: NotificationPrefs;
  onSaved: () => void;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const failureText = useActionErrorText(failure);

  async function toggle(key: keyof NotificationPrefs, value: boolean) {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(key);
    setFailure(null);
    const result = await saveNotificationPrefs(userId, next);
    setSaving(null);
    if (!result.ok) {
      // Desfaz: o interruptor não pode mostrar uma escolha que não foi gravada.
      setPrefs(previous);
      setFailure(result.message);
      return;
    }
    onSaved();
  }

  const groups = [...new Set(ITEMS.map((item) => item.group))];

  return (
    <>
      {failureText ? (
        <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{failureText}</Text>
      ) : null}

      {groups.map((group) => {
        const items = ITEMS.filter((item) => item.group === group);
        return (
          <View key={group} style={{ gap: 11 }}>
            <Label>{group}</Label>
            <Card radius={16}>
              {items.map((item, index) => (
                <View
                  key={item.key}
                  style={{
                    padding: 15,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    borderBottomWidth: index === items.length - 1 ? 0 : 1,
                    borderBottomColor: color.lineSoft,
                  }}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={sans(14.5, 600, { ls: -0.01 })}>{item.title}</Text>
                    <Text style={sans(12.5, 400, { lh: 1.4, color: color.muted })}>
                      {item.text}
                    </Text>
                  </View>
                  <Switch
                    value={prefs[item.key]}
                    disabled={saving !== null}
                    onValueChange={(value) => toggle(item.key, value)}
                    trackColor={{ true: color.coral, false: color.tabIdle }}
                    accessibilityLabel={item.title}
                  />
                </View>
              ))}
            </Card>
          </View>
        );
      })}
    </>
  );
}

export default function Avisos() {
  return (
    <AuthGate>
      <AvisosConteudo />
    </AuthGate>
  );
}
