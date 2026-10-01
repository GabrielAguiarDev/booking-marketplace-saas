import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { AuthGate } from "../../src/auth/AuthGate";
import { cancelAppointment, useAppointment } from "../../src/data/appointments";
import { accentOf, initialsOfName, shade } from "../../src/data/catalog";
import { useCovers } from "../../src/data/photos";
import { cancelIsFree, rescheduleCheck, windowLabel } from "../../src/domain/reschedule";
import { duration, hourMinute, money, slotLabel } from "@vez/mobile-kit/format";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { duo2, Photo } from "../../src/ui/Photo";
import {
  BackHeader,
  Card,
  Label,
  OutlineButton,
  PrimaryButton,
  Shimmer,
} from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { ErrorState, useActionErrorText } from "../../src/ui/States";

const STATUS_LABEL: Record<string, string> = {
  // `scheduled` é o pedido esperando o sim da loja; só `confirmed` é garantido.
  scheduled: "AGUARDANDO A LOJA",
  confirmed: "CONFIRMADO",
  completed: "ATENDIDO",
  cancelled_by_customer: "CANCELADO POR VOCÊ",
  cancelled_by_establishment: "CANCELADO PELA LOJA",
  no_show: "NÃO COMPARECEU",
};

/**
 * Detalhe de uma reserva: o que foi combinado, a política da loja e o que a
 * pessoa ainda pode fazer com ela (remarcar, cancelar, avaliar, pedir ajuda).
 *
 * Os botões seguem `domain/reschedule.ts`, que espelha o servidor: a tela não
 * oferece remarcar quando a RPC vai recusar, e diz até quando pode.
 */
function ReservaConteudo() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, loading, error, reload } = useAppointment(id ?? null);
  const covers = useCovers(item ? [item.establishments.id] : []);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const failureText = useActionErrorText(failure);

  // Voltar da remarcação precisa mostrar o horário novo.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return (
      <Screen>
        <ScreenScroll gap={18}>
          <BackHeader title="Reserva" onBack={() => router.back()} />
          <Shimmer width="100%" height={92} radius={18} />
          <Shimmer width="100%" height={220} radius={16} />
        </ScreenScroll>
      </Screen>
    );
  }

  if (error || !item) {
    return (
      <Screen>
        <ScreenScroll gap={18}>
          <BackHeader title="Reserva" onBack={() => router.back()} />
          {error ? (
            <ErrorState error={error} onRetry={reload} what="esta reserva" />
          ) : (
            <Card radius={16} padding={18}>
              <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
                Reserva não encontrada.
              </Text>
            </Card>
          )}
        </ScreenScroll>
      </Screen>
    );
  }

  const shop = item.establishments;
  const accent = accentOf(shop);
  const windowMinutes = shop.cancellation_window_minutes;
  const check = rescheduleCheck(item, windowMinutes);
  const active = item.status === "scheduled" || item.status === "confirmed";
  // Ainda por vir: remarcável, ou só fora do prazo (mas antes do horário).
  const upcoming = active && (check.ok || check.reason === "outside_window");
  const canReview = item.status === "completed" && item.reviews === null;

  function cancelar() {
    const free = cancelIsFree(item!, windowMinutes);
    Alert.alert(
      "Cancelar reserva?",
      free
        ? "O horário volta a ficar livre para outras pessoas."
        : `Faltam menos de ${windowLabel(windowMinutes)} para o horário. A loja pode cobrar pelo cancelamento tardio.`,
      [
        { text: "Manter", style: "cancel" },
        {
          text: "Cancelar reserva",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            setFailure(null);
            const result = await cancelAppointment(item!.id);
            setCancelling(false);
            if (!result.ok) {
              setFailure(result.message ?? "Não foi possível cancelar.");
              return;
            }
            setNotice(
              result.withinFreeWindow
                ? "Reserva cancelada."
                : "Cancelada fora do prazo. A loja pode cobrar pelo horário.",
            );
            reload();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <ScreenScroll gap={20}>
        <BackHeader title="Reserva" onBack={() => router.back()} />

        <Pressable
          onPress={() => router.push(`/loja/${shop.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Ver loja ${shop.name}`}
        >
          <Card
            radius={18}
            padding={15}
            style={{ flexDirection: "row", gap: 14, alignItems: "center" }}
          >
            <Photo
              duotone={duo2(shade(accent, -0.4), shade(accent, 0.35))}
              size={56}
              radius={16}
              mono={initialsOfName(shop.name)}
              monoSize={16}
              center
              uri={covers.get(shop.id) ?? null}
              alt={`Foto de ${shop.name}`}
            />
            <View style={{ gap: 4, flex: 1 }}>
              <Text style={sans(16.5, 800, { ls: -0.03 })} numberOfLines={1}>
                {shop.name}
              </Text>
              {shop.address_line ? (
                <Text style={mono(10, 400, { ls: 0.04, color: color.muted })} numberOfLines={2}>
                  {shop.address_line.toUpperCase()}
                  {shop.neighborhood ? ` · ${shop.neighborhood.toUpperCase()}` : ""}
                </Text>
              ) : null}
              <Text style={mono(9, 600, { ls: 0.08, color: active ? color.green : color.muted })}>
                {STATUS_LABEL[item.status] ?? item.status.toUpperCase()}
              </Text>
            </View>
            <Text style={sans(17, 400, { lh: 1, color: color.chevron })}>›</Text>
          </Card>
        </Pressable>

        <View style={{ gap: 11 }}>
          <Label>RESERVA</Label>
          <Card radius={16}>
            <Linha rotulo="Horário" valor={slotLabel(item.starts_at)} />
            <Linha rotulo="Serviço" valor={item.services.name} />
            <Linha rotulo="Duração" valor={duration(item.services.duration_minutes)} />
            <Linha rotulo="Profissional" valor={item.professionals.display_name} />
            <Linha rotulo="Valor combinado" valor={money(item.price_cents)} ultima />
          </Card>
          <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>
            O valor foi fixado no momento da reserva; remarcar não muda o preço.
          </Text>
        </View>

        {item.status === "cancelled_by_establishment" && item.cancellation_reason ? (
          <Card radius={16} padding={15} style={{ gap: 6 }}>
            <Label>MOTIVO DA LOJA</Label>
            <Text style={sans(14, 400, { lh: 1.5, color: color.body })}>
              {item.cancellation_reason}
            </Text>
          </Card>
        ) : null}

        {upcoming ? (
          <Card radius={16} padding={15} style={{ gap: 6 }}>
            <Label>POLÍTICA DA LOJA</Label>
            <Text style={sans(13.5, 400, { lh: 1.5, color: color.body })}>
              {windowMinutes > 0
                ? `Remarque ou cancele sem custo até ${windowLabel(windowMinutes)} antes do horário.`
                : "Remarque ou cancele sem custo até o horário."}
              {check.ok && windowMinutes > 0
                ? ` Seu prazo vai até ${slotLabel(check.deadline.toISOString())}.`
                : ""}
            </Text>
            {!check.ok && check.reason === "outside_window" ? (
              <Text style={sans(13, 500, { lh: 1.45, color: color.amberDeep })}>
                O prazo para remarcar passou às {hourMinute(check.deadline!)}. Você ainda pode
                cancelar, mas a loja pode cobrar pelo horário.
              </Text>
            ) : null}
          </Card>
        ) : null}

        {notice ? <Text style={sans(13.5, 600, { color: color.greenDeep })}>{notice}</Text> : null}
        {failureText ? (
          <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{failureText}</Text>
        ) : null}

        <View style={{ gap: 11 }}>
          {upcoming && check.ok ? (
            <PrimaryButton
              label="Remarcar"
              height={50}
              background={accent}
              onPress={() =>
                router.push({ pathname: "/reserva/remarcar", params: { id: item.id } })
              }
            />
          ) : null}
          {upcoming ? (
            <OutlineButton
              label={cancelling ? "Cancelando…" : "Cancelar reserva"}
              height={48}
              onPress={cancelling ? undefined : cancelar}
            />
          ) : null}
          {canReview ? (
            <PrimaryButton
              label="Avaliar atendimento"
              height={50}
              background={accent}
              onPress={() =>
                router.push({ pathname: "/avaliacao", params: { appointmentId: item.id } })
              }
            />
          ) : null}
          {item.status === "completed" && item.reviews !== null ? (
            <Text style={mono(9.5, 600, { ls: 0.08, color: color.green })}>VOCÊ JÁ AVALIOU</Text>
          ) : null}
        </View>

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/ajuda/novo",
              params: {
                establishmentId: shop.id,
                establishmentName: shop.name,
                category: "booking",
                subject: `Reserva de ${slotLabel(item.starts_at)}`,
              },
            })
          }
          hitSlop={6}
          accessibilityRole="button"
        >
          <Text style={sans(13, 600, { color: color.muted })}>
            Preciso de ajuda com esta reserva
          </Text>
        </Pressable>
      </ScreenScroll>
    </Screen>
  );
}

function Linha({
  rotulo,
  valor,
  ultima = false,
}: {
  rotulo: string;
  valor: string;
  ultima?: boolean;
}) {
  return (
    <View
      style={{
        padding: 15,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: color.lineSoft,
      }}
    >
      <Text style={[sans(14, 500, { color: color.muted }), { flex: 1 }]}>{rotulo}</Text>
      <Text style={[mono(13, 500), { flexShrink: 1, textAlign: "right" }]}>{valor}</Text>
    </View>
  );
}

export default function Reserva() {
  return (
    <AuthGate>
      <ReservaConteudo />
    </AuthGate>
  );
}
