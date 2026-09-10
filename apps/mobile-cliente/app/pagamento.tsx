import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { AuthGate } from "../src/auth/AuthGate";
import { bookAppointment } from "../src/data/appointments";
import { accentOf, initialsOfName, shade } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishments";
import { duration, money, slotLabel } from "@vez/mobile-kit/format";
import { useAppState } from "../src/state/app-state";
import { color } from "../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { duo2, Photo } from "../src/ui/Photo";
import { BackHeader, Card, Label, PrimaryButton, StickyFooter } from "../src/ui/primitives";
import { Screen, ScreenScroll } from "../src/ui/Screen";

function PagamentoConteudo() {
  const router = useRouter();
  const state = useAppState();
  const { booking } = state;

  const { data: shop } = useEstablishment(booking.establishmentId);
  const service = shop?.services.find((s) => s.id === booking.serviceId) ?? null;
  const pro = shop?.professionals.find((p) => p.id === booking.professionalId) ?? null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accent = accentOf(shop);

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

  // A política comercial da loja decide o bloco inteiro: clínica cobra sinal,
  // barbearia não cobra nada pelo app. Mesmo componente, duas políticas.
  const depositCents = Math.round((service.price_cents * shop.deposit_percent) / 100);
  const rows =
    shop.deposit_percent > 0
      ? [
          { k: service.name, v: money(service.price_cents), strong: false },
          { k: `Sinal agora (${shop.deposit_percent}%)`, v: money(depositCents), strong: true },
          { k: "Na recepção", v: money(service.price_cents - depositCents), strong: false },
        ]
      : [
          { k: service.name, v: money(service.price_cents), strong: false },
          { k: "Sinal", v: "NÃO EXIGE", strong: false },
          { k: "Total no balcão", v: money(service.price_cents), strong: true },
        ];

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
      if (result.code === "slot_taken" || result.code === "slot_unavailable") {
        state.setSlot(null);
      }
      return;
    }

    state.clearBooking();
    router.replace("/(tabs)/agenda");
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
          <Label>VALORES</Label>
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

        {error ? (
          <Card radius={14} padding={14} style={{ borderColor: color.coralBorder }}>
            <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{error}</Text>
          </Card>
        ) : null}

        {/*
          Nenhuma forma de pagamento aqui ainda: cobrar exige provedor, conta e
          uma decisão sobre quem recebe. Enquanto isso a reserva é criada e o
          pagamento acontece no balcão — mostrar PIX e cartão que não cobram
          nada seria a pior das opções.
        */}
      </ScreenScroll>

      <StickyFooter bottomInset={0}>
        <PrimaryButton
          label={busy ? "Confirmando…" : "Confirmar reserva"}
          height={54}
          background={busy ? color.chevron : accent}
          onPress={busy ? undefined : confirmar}
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

/** Exige conta: pagamento cria compromisso com o estabelecimento. */
export default function Pagamento() {
  return (
    <AuthGate>
      <PagamentoConteudo />
    </AuthGate>
  );
}
