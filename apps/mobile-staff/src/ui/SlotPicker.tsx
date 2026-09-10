import { mono, sans } from "@vez/mobile-kit/theme";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAvailableSlots } from "../data/schedule";
import { color } from "../theme/tokens";

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Escolha de horário, sempre a partir de `available_slots()`.
 *
 * A tentação aqui era grande: a loja já tem a agenda inteira na mão e daria
 * para desenhar os horários livres em TypeScript. É exatamente o que a regra R1
 * proíbe — o balcão ofereceria por telefone um horário que o app do cliente
 * acabou de vender, porque as duas contas seriam feitas em lugares diferentes.
 *
 * O que a função devolve já respeita jornada, funcionamento, bloqueio,
 * antecedência mínima e reserva existente. A tela só desenha.
 */
export function SlotPicker({
  establishmentId,
  serviceId,
  professionalId,
  selected,
  onSelect,
  days = 14,
}: {
  establishmentId: string | null;
  serviceId: string | null;
  professionalId: string | null;
  selected: string | null;
  onSelect: (slot: { startsAt: string; professionalId: string }) => void;
  days?: number;
}) {
  const [offset, setOffset] = useState(0);

  const date = new Date();
  date.setDate(date.getDate() + offset);

  const slots = useAvailableSlots({
    establishmentId,
    serviceId,
    date: isoDate(date),
    professionalId,
  });

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 7 }}>
          {Array.from({ length: days }, (_, index) => {
            const day = new Date();
            day.setDate(day.getDate() + index);
            const on = index === offset;
            return (
              <Pressable
                key={index}
                onPress={() => setOffset(index)}
                style={{
                  width: 54,
                  paddingVertical: 9,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: on ? color.ink : color.line,
                  backgroundColor: on ? color.ink : color.bg,
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Text style={mono(9.5, 500, { color: on ? "#fff" : color.muted })}>
                  {index === 0 ? "HOJE" : WEEKDAYS[day.getDay()]}
                </Text>
                <Text style={sans(15, 700, { color: on ? "#fff" : color.ink })}>
                  {day.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {!serviceId ? (
        <Text style={sans(13, 400, { lh: 1.5, color: color.muted })}>
          Escolha o serviço primeiro: é a duração dele que define quais horários cabem.
        </Text>
      ) : slots.loading ? (
        <Text style={sans(13, 400, { color: color.muted })}>Procurando horários livres…</Text>
      ) : slots.error ? (
        <Text style={sans(13, 400, { color: color.coral })}>{slots.error}</Text>
      ) : (slots.data ?? []).length === 0 ? (
        <Text style={sans(13, 400, { lh: 1.5, color: color.muted })}>
          Nada livre neste dia. Pode ser folga, bloqueio, agenda cheia — ou a antecedência mínima
          que a loja exige entre o pedido e o horário.
        </Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {(slots.data ?? []).map((slot) => {
            const on = selected === slot.slot_start;
            const time = new Date(slot.slot_start).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <Pressable
                key={`${slot.professional_id}-${slot.slot_start}`}
                onPress={() =>
                  onSelect({ startsAt: slot.slot_start, professionalId: slot.professional_id })
                }
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 13,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: on ? color.ink : color.line,
                  backgroundColor: on ? color.ink : color.bg,
                }}
              >
                <Text style={mono(13, 600, { color: on ? "#fff" : color.ink })}>{time}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
