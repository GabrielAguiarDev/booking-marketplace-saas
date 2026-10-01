import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { AuthGate } from "../src/auth/AuthGate";
import { bookAppointment } from "../src/data/appointments";
import { accentOf, initialsOfName, shade } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishments";
import { duration, money, slotLabel } from "@vez/mobile-kit/format";
import { useGoToTab } from "../src/navigation";
import { useAppState } from "../src/state/app-state";
import { color } from "../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { duo2, Photo } from "../src/ui/Photo";
import {
  BackHeader,
  Card,
  Label,
  PrimaryButton,
  Shimmer,
  StickyFooter,
} from "../src/ui/primitives";
import { Screen, ScreenScroll } from "../src/ui/Screen";
import { ErrorState, useActionErrorText } from "../src/ui/States";

function PagamentoConteudo() {
  const router = useRouter();
  const goToTab = useGoToTab();
  const { origem } = useLocalSearchParams<{ origem?: string }>();
  const state = useAppState();
  const { booking } = state;

  const {
    data: shop,
    loading,
    error: loadError,
    reload,
  } = useEstablishment(booking.establishmentId);
  const service = shop?.services.find((s) => s.id === booking.serviceId) ?? null;
  const pro = shop?.professionals.find((p) => p.id === booking.professionalId) ?? null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** O horário foi vendido entre a escolha e a confirmação. */
  const [slotLost, setSlotLost] = useState(false);
  const errorText = useActionErrorText(error);

  const accent = accentOf(shop);

  // Carregando e com erro vêm antes de "incompleta": a loja é nula nos três
  // casos, e quem chega do assistente ainda não tem a loja em memória — a tela
  // dizia "reserva incompleta" de uma reserva perfeitamente completa.
  if (booking.establishmentId && loading) {
    return (
      <Screen>
        <ScreenScroll gap={22}>
          <BackHeader title="Confirmar" onBack={() => router.back()} />
          <Shimmer width="100%" height={88} radius={18} />
          <Shimmer width="100%" height={210} radius={16} />
        </ScreenScroll>
      </Screen>
    );
  }

  if (booking.establishmentId && loadError) {
    return (
      <Screen>
        <ScreenScroll gap={16}>
          <BackHeader title="Confirmar" onBack={() => router.back()} />
          <ErrorState error={loadError} onRetry={reload} what="os dados da reserva" />
        </ScreenScroll>
      </Screen>
    );
  }

  if (!shop || !service || !booking.slotStart || !booking.professionalId) {
    return (
      <Screen>
        <ScreenScroll gap={16}>
          <BackHeader title="Confirmar" onBack={() => router.back()} />
          <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
            A reserva está incompleta. Escolha serviço e horário de novo.
          </Text>
          <PrimaryButton label="Voltar" height={50} onPress={() => router.back()} />
        </ScreenScroll>
      </Screen>
    );
  }

  const rows = [
    { k: service.name, v: money(service.price_cents), strong: false },
    { k: "Pagamento", v: "DIRETO NO ESTABELECIMENTO", strong: true },
  ];

  function escolherOutro() {
    state.setSlot(null);
    // Quem veio da grade volta para ela. Quem veio do assistente nunca passou
    // pela grade: ela entra no lugar desta tela, já com loja e serviço.
    if (origem === "assistente") router.replace("/horario");
    else router.back();
  }

  async function confirmar() {
    setBusy(true);
    setError(null);

    const result = await bookAppointment({
      establishmentId: booking.establishmentId!,
      serviceId: booking.serviceId!,
      professionalId: booking.professionalId!,
      startsAt: booking.slotStart!,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      // O horário foi levado por outra pessoa entre a escolha e a confirmação.
      // Voltar para a grade é a única saída útil — insistir aqui não resolve.
      // O rascunho fica como está até a pessoa sair: limpar o horário agora
      // trocaria esta tela por "reserva incompleta" e apagaria o motivo.
      if (result.code === "slot_taken" || result.code === "slot_unavailable") {
        setSlotLost(true);
      }
      return;
    }

    state.clearBooking();
    // Desempilha loja e horário antes de ir: a reserva acabou, e o gesto de
    // voltar não pode devolver um fluxo concluído. A Agenda recebe o que
    // aconteceu para dizer isso em voz alta — antes ela só aparecia.
    goToTab({
      pathname: "/(tabs)/agenda",
      params: { reservada: result.status === "confirmed" ? "confirmada" : "pedido" },
    });
  }

  return (
    <Screen>
      <ScreenScroll gap={22}>
        <BackHeader title="Confirmar" onBack={() => router.back()} />

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
          />
          <View style={{ gap: 4, flex: 1 }}>
            <Text style={sans(16.5, 800, { ls: -0.03 })} numberOfLines={1}>
              {shop.name}
            </Text>
            <Text style={mono(10.5, 400, { ls: 0.05, color: color.muted })}>
              {slotLabel(booking.slotStart).toUpperCase()}
            </Text>
          </View>
        </Card>

        <View style={{ gap: 11 }}>
          <Label>RESERVA</Label>
          <Card radius={16}>
            <Linha rotulo="Serviço" valor={service.name} />
            <Linha rotulo="Duração" valor={duration(service.duration_minutes)} />
            <Linha rotulo="Profissional" valor={pro?.display_name ?? "A definir"} />
            <Linha rotulo="Horário" valor={slotLabel(booking.slotStart)} ultima />
          </Card>
        </View>

        <View style={{ gap: 11 }}>
          <Label>VALOR INFORMADO</Label>
          <Card radius={16}>
            {rows.map((row, index) => (
              <Linha
                key={row.k}
                rotulo={row.k}
                valor={row.v}
                forte={row.strong}
                ultima={index === rows.length - 1}
              />
            ))}
          </Card>
        </View>

        <Card radius={16} padding={15}>
          <Text style={sans(13.5, 400, { lh: 1.5, color: color.muted })}>
            Cancelamento sem custo até{" "}
            {shop.cancellation_window_minutes >= 60
              ? `${Math.round(shop.cancellation_window_minutes / 60)} h`
              : `${shop.cancellation_window_minutes} min`}{" "}
            antes do horário.
          </Text>
        </Card>

        {errorText ? (
          <Card
            radius={14}
            padding={14}
            style={{ borderColor: color.coralBorder, gap: 11, backgroundColor: "#FFF4F1" }}
          >
            <Text accessibilityRole="alert" style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>
              {errorText}
            </Text>
            {slotLost ? (
              <PrimaryButton
                label="Escolher outro horário"
                height={44}
                background={accent}
                onPress={escolherOutro}
              />
            ) : null}
          </Card>
        ) : null}
      </ScreenScroll>

      <StickyFooter>
        <PrimaryButton
          label={busy ? "Confirmando…" : "Confirmar reserva"}
          height={54}
          background={busy || slotLost ? color.chevron : accent}
          onPress={busy || slotLost ? undefined : confirmar}
        />
      </StickyFooter>
    </Screen>
  );
}

function Linha({
  rotulo,
  valor,
  forte = false,
  ultima = false,
}: {
  rotulo: string;
  valor: string;
  forte?: boolean;
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
      <Text
        style={[
          sans(14, forte ? 700 : 500, { color: forte ? color.ink : color.muted }),
          { flex: 1 },
        ]}
      >
        {rotulo}
      </Text>
      <Text style={mono(13, forte ? 600 : 400)}>{valor}</Text>
    </View>
  );
}

/** Exige conta: confirmar cria um compromisso com o estabelecimento. */
export default function Pagamento() {
  return (
    <AuthGate>
      <PagamentoConteudo />
    </AuthGate>
  );
}
