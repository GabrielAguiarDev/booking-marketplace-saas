import { mono, sans } from "@vez/mobile-kit/theme";
import { useMemo, useState } from "react";
import { type DimensionValue, Text, View } from "react-native";

import { useAppointments } from "../src/data/appointments";
import { useProfessionals, useServices } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishment";
import {
  useAvailableSlots,
  useBusinessHours,
  useProfessionalSchedules,
} from "../src/data/schedule";
import { clockFromTime, minutesLabel, weekdayLong } from "../src/format";
import { color } from "../src/theme/tokens";
import { Card, Caveat, Pill, SectionLabel } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

function minutesOf(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Horários e escalas.
 *
 * A parte de cima é cadastro; a de baixo é a única explicação honesta de por
 * que um horário aparece ou não para o cliente. Quatro camadas se recortando, e
 * o resultado embaixo vindo da própria `available_slots()` — não de um desenho
 * que imita o cálculo. Se a barra verde estiver vazia com tudo aberto, é porque
 * o banco realmente não tem vaga, e a resposta está nas camadas acima.
 */
export default function Horarios() {
  const { establishment } = useEstablishment();
  const id = establishment?.id ?? null;

  const hours = useBusinessHours(id);
  const schedules = useProfessionalSchedules(id);
  const professionals = useProfessionals(id);
  const services = useServices(id, false);

  const active = (professionals.data ?? []).filter((professional) => professional.isActive);
  const [focusId, setFocusId] = useState<string | null>(null);
  const focus = active.find((professional) => professional.id === focusId) ?? active[0] ?? null;

  const today = useMemo(() => new Date(), []);
  const bounds = useMemo(() => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [today]);

  const appointments = useAppointments(id, bounds.from, bounds.to, focus?.id ?? null);

  // O serviço mais curto que essa pessoa faz: é o que revela o maior número de
  // encaixes possíveis, e portanto o desenho mais generoso da camada final.
  const service =
    (services.data ?? [])
      .filter((item) => focus && item.professionalIds.includes(focus.id))
      .sort((a, b) => a.durationMinutes - b.durationMinutes)[0] ?? null;

  const slots = useAvailableSlots({
    establishmentId: id,
    serviceId: service?.id ?? null,
    date: isoDate(today),
    professionalId: focus?.id ?? null,
  });

  const todayHours = (hours.data ?? []).filter((hour) => hour.weekday === today.getDay());
  const dayStart =
    todayHours.length > 0 ? Math.min(...todayHours.map((hour) => minutesOf(hour.opensAt))) : 480;
  const dayEnd =
    todayHours.length > 0 ? Math.max(...todayHours.map((hour) => minutesOf(hour.closesAt))) : 1200;
  const span = Math.max(60, dayEnd - dayStart);

  const percent = (from: number, to: number) => ({
    left: `${((Math.max(from, dayStart) - dayStart) / span) * 100}%` as DimensionValue,
    width:
      `${(Math.max(0, Math.min(to, dayEnd) - Math.max(from, dayStart)) / span) * 100}%` as DimensionValue,
  });

  const focusSchedules = (schedules.data ?? []).filter(
    (schedule) =>
      focus && schedule.professionalId === focus.id && schedule.weekday === today.getDay(),
  );

  return (
    <Screen>
      <PlainHeader title="Horários e escalas" />

      <ScreenScroll bottom={40}>
        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
          <SectionLabel>Funcionamento da loja</SectionLabel>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {WEEKDAYS.map((weekday) => {
            const shifts = (hours.data ?? []).filter((hour) => hour.weekday === weekday);
            const closed = shifts.length === 0;
            return (
              <View
                key={weekday}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: color.lineSoft,
                }}
              >
                <Text style={sans(13.5, 600, { color: closed ? color.faint : color.ink })}>
                  {weekdayLong(weekday)}
                </Text>
                <Text style={mono(13, 600, { color: closed ? color.faint : color.ink })}>
                  {closed
                    ? "fechado"
                    : shifts
                        .map(
                          (shift) =>
                            `${clockFromTime(shift.opensAt)}–${clockFromTime(shift.closesAt)}`,
                        )
                        .join("  ")}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Por profissional</SectionLabel>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 9 }}>
          {active.map((professional) => {
            const own = (schedules.data ?? []).filter(
              (schedule) => schedule.professionalId === professional.id,
            );
            const days = [...new Set(own.map((schedule) => schedule.weekday))].length;
            return (
              <Card key={professional.id} radius={13} padding={13}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={sans(14.5, 700)}>{professional.displayName}</Text>
                  <Text style={mono(12.5, 600, { color: color.muted })}>
                    {own.length === 0
                      ? "sem escala"
                      : `${clockFromTime(own.reduce((min, s) => (s.startsAt < min ? s.startsAt : min), own[0]!.startsAt))}–${clockFromTime(own.reduce((max, s) => (s.endsAt > max ? s.endsAt : max), own[0]!.endsAt))}`}
                  </Text>
                </View>
                <Text style={[sans(12.5, 400, { lh: 1.4, color: color.muted }), { marginTop: 5 }]}>
                  {own.length === 0
                    ? "Sem jornada cadastrada: esta pessoa não gera nenhum horário para o cliente."
                    : `Trabalha ${days} ${days === 1 ? "dia" : "dias"} por semana.`}
                </Text>
              </Card>
            );
          })}
        </View>

        {/* ── A INTERSEÇÃO ─────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <Card radius={16} padding={15} shadow>
            <Text style={sans(13.5, 700)}>O que o cliente vê como vaga livre</Text>
            <Text style={[sans(12.5, 400, { lh: 1.45, color: color.muted }), { marginTop: 4 }]}>
              Só o encontro de tudo abaixo, hoje. Se uma camada fecha, a vaga desaparece.
            </Text>

            {active.length > 1 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {active.map((professional) => (
                  <Pill
                    key={professional.id}
                    size="sm"
                    label={professional.displayName}
                    active={focus?.id === professional.id}
                    onPress={() => setFocusId(professional.id)}
                  />
                ))}
              </View>
            ) : null}

            <View style={{ marginTop: 14, gap: 7 }}>
              <Layer label="Loja aberta">
                {todayHours.map((shift, index) => (
                  <Bar
                    key={index}
                    {...percent(minutesOf(shift.opensAt), minutesOf(shift.closesAt))}
                    tint={color.track}
                  />
                ))}
              </Layer>

              <Layer label="Escala">
                {focusSchedules.map((schedule, index) => (
                  <Bar
                    key={index}
                    {...percent(minutesOf(schedule.startsAt), minutesOf(schedule.endsAt))}
                    tint={color.chevron}
                  />
                ))}
              </Layer>

              <Layer label="Já agendado">
                {(appointments.data ?? [])
                  .filter(
                    (item) =>
                      item.status === "confirmed" ||
                      item.status === "scheduled" ||
                      item.status === "completed",
                  )
                  .map((item) => {
                    const start = new Date(item.startsAt);
                    const end = new Date(item.endsAt);
                    return (
                      <Bar
                        key={item.id}
                        {...percent(
                          start.getHours() * 60 + start.getMinutes(),
                          end.getHours() * 60 + end.getMinutes(),
                        )}
                        tint={color.ink}
                      />
                    );
                  })}
              </Layer>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  marginTop: 6,
                  paddingTop: 11,
                  borderTopWidth: 1,
                  borderTopColor: color.lineSoft,
                }}
              >
                <Text
                  style={[
                    sans(10.5, 700, { color: color.green }),
                    { width: 74, textAlign: "right" },
                  ]}
                >
                  VAGA LIVRE
                </Text>
                <View
                  style={{
                    flex: 1,
                    height: 18,
                    borderRadius: 5,
                    backgroundColor: color.fill,
                    overflow: "hidden",
                  }}
                >
                  {(slots.data ?? []).map((slot) => {
                    const start = new Date(slot.slot_start);
                    const end = new Date(slot.slot_end);
                    const box = percent(
                      start.getHours() * 60 + start.getMinutes(),
                      end.getHours() * 60 + end.getMinutes(),
                    );
                    return (
                      <View
                        key={slot.slot_start}
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: box.left,
                          width: box.width,
                          backgroundColor: color.green,
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            </View>

            <Text style={[sans(12, 400, { lh: 1.45, color: color.muted }), { marginTop: 12 }]}>
              {!service
                ? "Sem serviço ativo ligado a esta pessoa não há o que calcular — a vaga nasce do par serviço + profissional."
                : (slots.data ?? []).length === 0
                  ? `Nenhuma vaga hoje para ${service.name.toLowerCase()} com ${focus?.displayName ?? "esta pessoa"}. A faixa verde vazia é resposta, não erro: olhe as camadas acima para ver qual delas fechou.`
                  : `A faixa verde é o que a loja tem livre hoje para ${service.name.toLowerCase()} (${service.durationMinutes} min), direto da função de disponibilidade do banco.`}
            </Text>
          </Card>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Card radius={13} padding={14}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={sans(13.5, 600)}>Intervalo da grade de horários</Text>
                <Text style={sans(12, 400, { lh: 1.4, color: color.muted })}>
                  De quantos em quantos minutos um horário pode começar.
                </Text>
              </View>
              <Text style={mono(15, 600)}>
                {minutesLabel(establishment?.slot_interval_minutes ?? 30)}
              </Text>
            </View>
          </Card>
        </View>

        <View style={{ paddingTop: 18, gap: 12 }}>
          <Caveat>
            Editar funcionamento, escala e folga ainda não tem tela: hoje isso é cadastro do portal
            web da loja. O que existe aqui é bloquear um período pontual, na Agenda.
          </Caveat>
          <Caveat>
            Não existe intervalo de limpeza entre um atendimento e outro no banco. O que existe é o
            intervalo da grade acima, que é outra coisa: ele diz de quanto em quanto tempo um
            horário começa, não quanto tempo sobra depois que o cliente levanta.
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}

function Layer({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Text
        style={[sans(10.5, 500, { color: color.muted }), { width: 74, textAlign: "right" }]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
      <View
        style={{
          flex: 1,
          height: 14,
          borderRadius: 4,
          backgroundColor: color.fill,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Bar({ left, width, tint }: { left: DimensionValue; width: DimensionValue; tint: string }) {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left,
        width,
        backgroundColor: tint,
        borderRadius: 4,
      }}
    />
  );
}
