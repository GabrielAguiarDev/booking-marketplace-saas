import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AuthGate } from "../../src/auth/AuthGate";
import {
  type AppointmentDetail,
  rescheduleAppointment,
  useAppointment,
} from "../../src/data/appointments";
import { nextDays, type Slot, useAvailabilitySummary, useSlots } from "../../src/data/availability";
import { accentOf } from "../../src/data/catalog";
import { useEstablishment } from "../../src/data/establishments";
import { RESCHEDULE_REFRESH_SLOTS, rescheduleCheck } from "../../src/domain/reschedule";
import { dayNumber, hourMinute, isoDate, slotLabel, weekdayShort } from "@vez/mobile-kit/format";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import {
  BackHeader,
  Card,
  Label,
  PrimaryButton,
  Shimmer,
  StickyFooter,
} from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { ErrorState, useActionErrorText } from "../../src/ui/States";

/** Duas semanas: remarcar costuma ser "mesma semana" ou "semana que vem". */
const DAYS = 14;

/**
 * Remarcar uma reserva.
 *
 * A grade vem de `available_slots()` — a mesma que a reserva nova usa — e a
 * confirmação passa por `customer_reschedule_appointment()`, que confere de
 * novo tudo no servidor (dono, janela da loja, horário ainda livre). O que
 * esta tela decide é só a escolha; a regra é do banco.
 */
function RemarcarConteudo() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, loading, error, reload } = useAppointment(id ?? null);

  if (loading) {
    return (
      <Screen>
        <ScreenScroll gap={18}>
          <BackHeader title="Remarcar" onBack={() => router.back()} />
          <Shimmer width="100%" height={90} radius={14} />
          <Shimmer width="100%" height={200} radius={14} />
        </ScreenScroll>
      </Screen>
    );
  }

  const check = item
    ? rescheduleCheck(item, item.establishments.cancellation_window_minutes)
    : null;

  if (error || !item || !check?.ok) {
    return (
      <Screen>
        <ScreenScroll gap={18}>
          <BackHeader title="Remarcar" onBack={() => router.back()} />
          {error ? (
            <ErrorState error={error} onRetry={reload} what="esta reserva" />
          ) : (
            <Card radius={16} padding={18} style={{ gap: 12 }}>
              <Text style={sans(14.5, 400, { lh: 1.5, color: color.body })}>
                {!item
                  ? "Reserva não encontrada."
                  : check && !check.ok && check.reason === "outside_window"
                    ? "O prazo para remarcar esta reserva já passou. Você ainda pode cancelar ou falar com a loja."
                    : "Esta reserva não pode mais ser remarcada."}
              </Text>
              <PrimaryButton label="Voltar" height={46} onPress={() => router.back()} />
            </Card>
          )}
        </ScreenScroll>
      </Screen>
    );
  }

  return <Grade key={item.id} item={item} onDone={() => router.back()} />;
}

function Grade({ item, onDone }: { item: AppointmentDetail; onDone: () => void }) {
  const router = useRouter();
  const shopId = item.establishments.id;
  const serviceId = item.services.id;
  const { data: shop } = useEstablishment(shopId);
  const accent = accentOf(item.establishments);

  const days = useMemo(() => nextDays(DAYS), []);
  const [dayIndex, setDayIndex] = useState(() => {
    // Abre no dia da reserva atual, se ele estiver na janela mostrada.
    const current = isoDate(new Date(item.starts_at));
    const index = days.findIndex((day) => isoDate(day) === current);
    return index >= 0 ? index : 0;
  });
  const selectedDay = days[dayIndex]!;

  // Mesmo profissional por padrão: quem remarca quase sempre quer só mudar a
  // hora. Trocar é opção, não passo obrigatório.
  const [professionalId, setProfessionalId] = useState<string | null>(item.professionals.id);
  const [choice, setChoice] = useState<{ start: string; professionalId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const failureText = useActionErrorText(failure);

  const summary = useAvailabilitySummary({
    establishmentId: shopId,
    serviceId,
    days: DAYS,
    professionalId,
  });
  const slots = useSlots({ establishmentId: shopId, serviceId, date: selectedDay, professionalId });

  const byDay = new Map((summary.data ?? []).map((row) => [row.day, row]));

  const currentStart = new Date(item.starts_at).getTime();
  const byTime = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots.data ?? []) {
      // O horário atual com o mesmo profissional não é uma remarcação. Compara
      // instantes, não texto: RPC e select podem serializar o fuso diferente.
      if (
        new Date(slot.slot_start).getTime() === currentStart &&
        slot.professional_id === item.professionals.id
      ) {
        continue;
      }
      const list = map.get(slot.slot_start) ?? [];
      list.push(slot);
      map.set(slot.slot_start, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots.data, currentStart, item.professionals.id]);

  function escolher(start: string, options: Slot[]) {
    // Com "qualquer um", prefere quem já atende a reserva, se estiver livre.
    const keep = options.find((o) => o.professional_id === item.professionals.id);
    setChoice({ start, professionalId: (keep ?? options[0]!).professional_id });
    setFailure(null);
  }

  async function confirmar() {
    if (!choice) return;
    setSaving(true);
    setFailure(null);
    const result = await rescheduleAppointment({
      appointmentId: item.id,
      startsAt: choice.start,
      professionalId: choice.professionalId,
    });
    setSaving(false);

    if (!result.ok) {
      setFailure(result.message);
      if (RESCHEDULE_REFRESH_SLOTS.has(result.code)) {
        setChoice(null);
        slots.reload();
        summary.reload();
      }
      if (result.code === "outside_window" || result.code === "not_reschedulable") {
        // A reserva mudou por baixo (prazo, loja cancelou): o detalhe explica.
        router.back();
      }
      return;
    }
    onDone();
  }

  const proName = (proId: string) =>
    shop?.professionals.find((p) => p.id === proId)?.display_name ??
    item.professionals.display_name;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 30, gap: 22 }}
      >
        <BackHeader title="Remarcar" onBack={() => router.back()} />

        <Card radius={14} padding={14} style={{ gap: 4 }}>
          <Label>HORÁRIO ATUAL</Label>
          <Text style={sans(15, 700, { ls: -0.02 })}>
            {item.services.name} · {item.professionals.display_name}
          </Text>
          <Text style={mono(12, 600)}>{slotLabel(item.starts_at)}</Text>
        </Card>

        <View style={{ gap: 11 }}>
          <Label>NOVO DIA</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 9 }}>
              {days.map((day, index) => {
                const on = index === dayIndex;
                const row = byDay.get(isoDate(day));
                const closed = row !== undefined && !row.is_open;
                const soldOut = row !== undefined && row.is_open && row.free_count === 0;
                return (
                  <Pressable
                    key={isoDate(day)}
                    onPress={() => {
                      setDayIndex(index);
                      setChoice(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={{
                      width: 62,
                      paddingVertical: 11,
                      borderRadius: 14,
                      alignItems: "center",
                      gap: 4,
                      borderWidth: 1,
                      borderColor: on ? accent : color.line,
                      backgroundColor: on ? accent : color.bg,
                      opacity: (closed || soldOut) && !on ? 0.45 : 1,
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
                            : `${row.free_count} LIVRES`}
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
                {[{ id: null as string | null, label: "QUALQUER UM" }]
                  .concat(
                    shop.professionals.map((p) => ({
                      id: p.id,
                      label: p.display_name.toUpperCase(),
                    })),
                  )
                  .map((option) => {
                    const on = professionalId === option.id;
                    return (
                      <Pressable
                        key={option.id ?? "any"}
                        onPress={() => {
                          setProfessionalId(option.id);
                          setChoice(null);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={{
                          paddingVertical: 11,
                          paddingHorizontal: 15,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: on ? accent : color.line,
                          backgroundColor: on ? accent : color.bg,
                        }}
                      >
                        <Text style={mono(10, 600, { ls: 0.06, color: on ? "#fff" : color.muted })}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {slots.loading ? (
          <View style={{ gap: 11 }}>
            <Shimmer width="100%" height={48} radius={12} />
            <Shimmer width="100%" height={48} radius={12} />
          </View>
        ) : slots.error ? (
          <ErrorState error={slots.error} onRetry={slots.reload} what="a agenda" />
        ) : byTime.length === 0 ? (
          <Card radius={15} padding={18}>
            <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
              Nenhum horário livre neste dia. Toque em outro dia acima.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 11 }}>
            <Label>NOVO HORÁRIO</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {byTime.map(([iso, options]) => {
                const on = choice?.start === iso;
                return (
                  <Pressable
                    key={iso}
                    onPress={() => escolher(iso, options)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
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
        )}

        {failureText ? (
          <Card radius={14} padding={14} style={{ borderColor: color.coralBorder }}>
            <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{failureText}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <StickyFooter bottomInset={0}>
        <View style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Label>{choice ? "NOVO HORÁRIO" : "ESCOLHA UM HORÁRIO"}</Label>
            <Text style={mono(14, 600)}>
              {choice ? `${slotLabel(choice.start)} · ${proName(choice.professionalId)}` : "—"}
            </Text>
          </View>
          <PrimaryButton
            label={saving ? "Remarcando…" : "Confirmar remarcação"}
            height={52}
            background={choice && !saving ? accent : color.chevron}
            onPress={choice && !saving ? confirmar : undefined}
          />
        </View>
      </StickyFooter>
    </Screen>
  );
}

export default function Remarcar() {
  return (
    <AuthGate>
      <RemarcarConteudo />
    </AuthGate>
  );
}
