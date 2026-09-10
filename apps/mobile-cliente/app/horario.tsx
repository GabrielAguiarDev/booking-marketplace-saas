import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AuthGate } from "../src/auth/AuthGate";
import { nextDays, type Slot, useAvailabilitySummary, useSlots } from "../src/data/availability";
import { accentOf } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishments";
import {
  dayNumber,
  duration,
  hourMinute,
  isoDate,
  moneyShort,
  weekdayShort,
} from "@vez/mobile-kit/format";
import { useAppState } from "../src/state/app-state";
import { color } from "../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { Card, Label, PrimaryButton, Shimmer, StickyFooter } from "../src/ui/primitives";
import { Screen } from "../src/ui/Screen";

/** Manhã / tarde / noite, como o design agrupa. */
const BLOCKS = [
  { key: "manha", label: "MANHÃ", from: 0, to: 12 },
  { key: "tarde", label: "TARDE", from: 12, to: 18 },
  { key: "noite", label: "NOITE", from: 18, to: 24 },
];

function HorarioConteudo() {
  const router = useRouter();
  const state = useAppState();
  const { booking } = state;

  const [dayIndex, setDayIndex] = useState(0);
  const days = useMemo(() => nextDays(7), []);
  const selectedDay = days[dayIndex]!;

  const { data: shop } = useEstablishment(booking.establishmentId);
  const service = shop?.services.find((s) => s.id === booking.serviceId) ?? null;

  const { data: summary } = useAvailabilitySummary({
    establishmentId: booking.establishmentId,
    serviceId: booking.serviceId,
    days: 7,
    professionalId: booking.professionalId,
  });

  const {
    data: slots,
    loading,
    error,
    reload,
  } = useSlots({
    establishmentId: booking.establishmentId,
    serviceId: booking.serviceId,
    date: selectedDay,
    professionalId: booking.professionalId,
  });

  const accent = accentOf(shop);
  const byDay = new Map((summary ?? []).map((row) => [row.day, row]));

  // Um horário pode ser oferecido por mais de um profissional. A tela mostra
  // cada horário uma vez; quem executa é decidido no momento de reservar.
  const byTime = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots ?? []) {
      const list = map.get(slot.slot_start) ?? [];
      list.push(slot);
      map.set(slot.slot_start, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  function escolher(slotStart: string, options: Slot[]) {
    state.setSlot(slotStart);
    // Sem profissional escolhido, fica com o primeiro que tem o horário livre.
    if (!booking.professionalId) {
      state.setProfessional(options[0]!.professional_id);
      state.setSlot(slotStart);
    }
  }

  if (!booking.establishmentId || !booking.serviceId) {
    return (
      <Screen>
        <View style={{ padding: 20, paddingTop: 16, gap: 14 }}>
          <Text style={sans(21, 800, { ls: -0.03 })}>Escolha um serviço</Text>
          <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
            Volte para a loja e toque em Agendar no serviço que você quer.
          </Text>
          <PrimaryButton label="Voltar" height={50} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: color.line,
          gap: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingBottom: 4 }}>
            <Text style={sans(24, 400, { lh: 1 })}>‹</Text>
          </Pressable>
          <Text style={[sans(19, 800, { ls: -0.03 }), { flex: 1 }]} numberOfLines={1}>
            {service?.name ?? "Escolher horário"}
          </Text>
        </View>
        {service ? (
          <Text style={mono(10.5, 400, { ls: 0.05, color: color.muted })}>
            {shop?.name.toUpperCase()} · {duration(service.duration_minutes)} ·{" "}
            {moneyShort(service.price_cents)}
          </Text>
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 30, gap: 22 }}
      >
        <View style={{ gap: 11 }}>
          <Label>DIA</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 9 }}>
              {days.map((day, index) => {
                const on = index === dayIndex;
                const row = byDay.get(isoDate(day));
                // Fechado e lotado são coisas diferentes, e o usuário lê os dois
                // de formas opostas: um manda voltar outro dia, o outro manda
                // tentar de novo mais tarde.
                const closed = row !== undefined && !row.is_open;
                const free = row?.free_count;
                const soldOut = row !== undefined && row.is_open && free === 0;
                const dim = (closed || soldOut) && !on;

                return (
                  <Pressable
                    key={isoDate(day)}
                    onPress={() => {
                      setDayIndex(index);
                      state.setSlot(null);
                    }}
                    style={{
                      width: 62,
                      paddingVertical: 11,
                      borderRadius: 14,
                      alignItems: "center",
                      gap: 4,
                      borderWidth: 1,
                      borderColor: on ? accent : color.line,
                      backgroundColor: on ? accent : color.bg,
                      opacity: dim ? 0.45 : 1,
                    }}
                  >
                    <Text style={mono(9, 600, { ls: 0.08, color: on ? "#fff" : color.muted })}>
                      {weekdayShort(day)}
                    </Text>
                    <Text style={sans(17, 700, { color: on ? "#fff" : color.ink })}>
                      {dayNumber(day)}
                    </Text>
                    <Text
                      style={mono(8.5, 500, {
                        ls: 0.06,
                        color: on
                          ? "rgba(255,255,255,0.85)"
                          : closed || soldOut
                            ? color.muted
                            : color.green,
                      })}
                    >
                      {row === undefined
                        ? "—"
                        : closed
                          ? "FECHADO"
                          : soldOut
                            ? "CHEIO"
                            : `${free} LIVRES`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {shop && shop.professionals.length > 1 ? (
          <View style={{ gap: 11 }}>
            <Label>PROFISSIONAL</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 9 }}>
                <ProChip
                  label="QUALQUER UM"
                  on={booking.professionalId === null}
                  accent={accent}
                  onPress={() => state.setProfessional(null)}
                />
                {shop.professionals.map((pro) => (
                  <ProChip
                    key={pro.id}
                    label={pro.display_name.toUpperCase()}
                    on={booking.professionalId === pro.id}
                    accent={accent}
                    onPress={() => state.setProfessional(pro.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {loading ? (
          <View style={{ gap: 11 }}>
            <Shimmer width={90} height={12} radius={4} />
            <Shimmer width="100%" height={48} radius={12} />
            <Shimmer width="100%" height={48} radius={12} />
          </View>
        ) : error ? (
          <Card radius={15} padding={16} style={{ gap: 11 }}>
            <Text style={sans(14, 400, { lh: 1.5, color: color.body })}>
              Não conseguimos carregar a agenda.
            </Text>
            <PrimaryButton
              label="Tentar de novo"
              height={44}
              onPress={reload}
              background={accent}
            />
          </Card>
        ) : byTime.length === 0 ? (
          <Card radius={15} padding={18}>
            <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
              Nenhum horário livre neste dia. Toque em outro dia acima.
            </Text>
          </Card>
        ) : (
          BLOCKS.map((block) => {
            const inBlock = byTime.filter(([iso]) => {
              const hour = new Date(iso).getHours();
              return hour >= block.from && hour < block.to;
            });
            if (inBlock.length === 0) return null;

            return (
              <View key={block.key} style={{ gap: 11 }}>
                <Label>{block.label}</Label>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
                  {inBlock.map(([iso, options]) => {
                    const on = booking.slotStart === iso;
                    return (
                      <Pressable
                        key={iso}
                        onPress={() => escolher(iso, options)}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: on ? accent : color.line,
                          backgroundColor: on ? accent : color.bg,
                        }}
                      >
                        <Text style={mono(13.5, 600, { color: on ? "#fff" : color.ink })}>
                          {hourMinute(iso)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <StickyFooter bottomInset={0}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ gap: 2, flex: 1 }}>
            <Label>{booking.slotStart ? "ESCOLHIDO" : "ESCOLHA UM HORÁRIO"}</Label>
            <Text style={mono(15, 600)}>
              {booking.slotStart
                ? `${weekdayShort(selectedDay)} ${dayNumber(selectedDay)} · ${hourMinute(booking.slotStart)}`
                : "—"}
            </Text>
          </View>
          <PrimaryButton
            label="Continuar"
            height={52}
            background={booking.slotStart ? accent : color.chevron}
            style={{ flex: 1 }}
            onPress={booking.slotStart ? () => router.push("/pagamento") : undefined}
          />
        </View>
      </StickyFooter>
    </Screen>
  );
}

function ProChip({
  label,
  on,
  accent,
  onPress,
}: {
  label: string;
  on: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 11,
        paddingHorizontal: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: on ? accent : color.line,
        backgroundColor: on ? accent : color.bg,
      }}
    >
      <Text style={mono(10, 600, { ls: 0.06, color: on ? "#fff" : color.muted })}>{label}</Text>
    </Pressable>
  );
}

/** Exige conta: horario cria compromisso com o estabelecimento. */
export default function Horario() {
  return (
    <AuthGate>
      <HorarioConteudo />
    </AuthGate>
  );
}
