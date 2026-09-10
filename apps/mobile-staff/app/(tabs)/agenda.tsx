import { moneyShort } from "@vez/mobile-kit/format";
import { mono, sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { presentation, useAppointments } from "../../src/data/appointments";
import { useProfessionals } from "../../src/data/catalog";
import { useEstablishment } from "../../src/data/establishment";
import { useBusinessHours } from "../../src/data/schedule";
import { longDate, monthName } from "../../src/format";
import { color } from "../../src/theme/tokens";
import { ErrorNote, OutlineButton, Pill, PrimaryButton, Segmented } from "../../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../../src/ui/Screen";

type View3 = "dia" | "semana" | "mes";

const HOUR = 44;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function shift(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** O intervalo que cada visão precisa buscar. Uma consulta por visão, não três. */
function rangeFor(view: View3, today: Date) {
  if (view === "dia") return { from: startOfDay(today), to: shift(startOfDay(today), 1) };
  if (view === "semana") {
    const from = shift(startOfDay(today), -today.getDay());
    return { from, to: shift(from, 7) };
  }
  return {
    from: new Date(today.getFullYear(), today.getMonth(), 1),
    to: new Date(today.getFullYear(), today.getMonth() + 1, 1),
  };
}

/**
 * Agenda.
 *
 * Três visões da mesma consulta. A do dia é a única que desenha grade de hora,
 * porque é a única em que a posição na coluna significa alguma coisa; semana e
 * mês viram densidade, que é o que se quer saber olhando para longe — "sábado
 * está cheio", não "sábado tem alguém às 14h15".
 */
export default function Agenda() {
  const router = useRouter();
  const { establishment } = useEstablishment();
  const [view, setView] = useState<View3>("dia");
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const range = useMemo(() => rangeFor(view, today), [view, today]);

  const id = establishment?.id ?? null;
  const professionals = useProfessionals(id);
  const hours = useBusinessHours(id);
  const appointments = useAppointments(
    id,
    range.from.toISOString(),
    range.to.toISOString(),
    professionalId,
  );

  const active = (professionals.data ?? []).filter((professional) => professional.isActive);
  const columns = professionalId
    ? active.filter((professional) => professional.id === professionalId)
    : active;

  const items = (appointments.data ?? []).filter(
    (appointment) =>
      appointment.status !== "cancelled_by_customer" &&
      appointment.status !== "cancelled_by_establishment",
  );

  // Faixa de horas do dia, tirada do funcionamento da loja. Sem funcionamento
  // cadastrado a grade não é inventada: cai numa faixa padrão e a tela diz.
  const todayHours = (hours.data ?? []).filter((hour) => hour.weekday === today.getDay());
  const firstHour =
    todayHours.length > 0
      ? Math.min(...todayHours.map((hour) => Number(hour.opensAt.slice(0, 2))))
      : 8;
  const lastHour =
    todayHours.length > 0
      ? Math.max(...todayHours.map((hour) => Number(hour.closesAt.slice(0, 2))))
      : 20;
  const hourLabels = Array.from({ length: Math.max(1, lastHour - firstHour) }, (_, index) =>
    String(firstHour + index).padStart(2, "0"),
  );

  return (
    <Screen>
      <PlainHeader
        title="Agenda"
        canGoBack={false}
        action="+ Novo"
        onAction={() => router.push("/novo-agendamento")}
      />

      <ScreenScroll>
        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 12 }}>
          <Segmented
            items={[
              { key: "dia", label: "Dia" },
              { key: "semana", label: "Semana" },
              { key: "mes", label: "Mês" },
            ]}
            value={view}
            onChange={setView}
          />

          {active.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 7 }}>
                <Pill
                  label="Todos"
                  active={professionalId === null}
                  onPress={() => setProfessionalId(null)}
                />
                {active.map((professional) => (
                  <Pill
                    key={professional.id}
                    label={professional.displayName}
                    active={professionalId === professional.id}
                    onPress={() => setProfessionalId(professional.id)}
                  />
                ))}
              </View>
            </ScrollView>
          ) : null}
        </View>

        {appointments.error ? (
          <ErrorNote message={appointments.error} onRetry={appointments.reload} />
        ) : null}

        {view === "dia" ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Text style={sans(15, 700)}>{longDate(today)}</Text>
              <Text style={mono(11, 500, { color: color.muted })}>
                {columns.length} {columns.length === 1 ? "PROFISSIONAL" : "PROFISSIONAIS"}
              </Text>
            </View>

            {columns.length === 0 ? (
              <Text style={sans(13.5, 400, { lh: 1.5, color: color.muted })}>
                Nenhum profissional ativo. Cadastre quem atende para a agenda existir.
              </Text>
            ) : (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={{ width: 36 }}>
                  <View style={{ height: 22 }} />
                  {hourLabels.map((label) => (
                    <View key={label} style={{ height: HOUR, alignItems: "flex-end" }}>
                      <Text style={mono(10.5, 500, { color: color.faint })}>{label}</Text>
                    </View>
                  ))}
                </View>

                {columns.map((professional) => (
                  <View key={professional.id} style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[sans(11, 700), { height: 22, textAlign: "center" }]}
                      numberOfLines={1}
                    >
                      {professional.displayName.toUpperCase()}
                    </Text>
                    <View
                      style={{
                        height: hourLabels.length * HOUR,
                        borderWidth: 1,
                        borderColor: color.line,
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      {hourLabels.map((label, index) => (
                        <View
                          key={label}
                          style={{
                            position: "absolute",
                            top: index * HOUR,
                            left: 0,
                            right: 0,
                            height: 1,
                            backgroundColor: index === 0 ? "transparent" : color.lineSoft,
                          }}
                        />
                      ))}

                      {items
                        .filter((item) => item.professionalId === professional.id)
                        .map((item) => {
                          const start = new Date(item.startsAt);
                          const end = new Date(item.endsAt);
                          // Um atendimento que começou antes da abertura (o
                          // encaixe das 8h numa loja que abre às 9h) teria topo
                          // negativo e sumiria acima da grade. Ele é ancorado no
                          // topo e perde a altura equivalente.
                          const offsetMinutes =
                            (start.getHours() - firstHour) * 60 + start.getMinutes();
                          const top = Math.max(0, offsetMinutes * (HOUR / 60));
                          const minutes = (end.getTime() - start.getTime()) / 60_000;
                          const height = Math.max(
                            18,
                            (minutes + Math.min(0, offsetMinutes)) * (HOUR / 60),
                          );
                          const look = presentation(item);
                          // Um atendimento de 15 minutos ocupa 11px de grade:
                          // não cabem duas linhas de texto. Nesse caso o nome
                          // fica, e a hora sai — ela já está na régua à
                          // esquerda, o nome não está em lugar nenhum.
                          const roomForTime = height >= 30;

                          return (
                            <Pressable
                              key={item.id}
                              onPress={() => router.push(`/agendamento/${item.id}`)}
                              style={{
                                position: "absolute",
                                left: 3,
                                right: 3,
                                top,
                                height,
                                borderRadius: 6,
                                backgroundColor: look.background,
                                borderLeftWidth: 3,
                                borderLeftColor: look.tint,
                                paddingHorizontal: 5,
                                paddingVertical: roomForTime ? 4 : 2,
                                justifyContent: "center",
                                overflow: "hidden",
                              }}
                            >
                              <Text
                                style={sans(10, 600, { lh: 1.2, color: look.tint })}
                                numberOfLines={1}
                              >
                                {item.name}
                              </Text>
                              {roomForTime ? (
                                <Text
                                  style={[mono(9, 500, { color: look.tint }), { opacity: 0.75 }]}
                                >
                                  {start.toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </Text>
                              ) : null}
                            </Pressable>
                          );
                        })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {todayHours.length === 0 ? (
              <Text style={[sans(12, 400, { lh: 1.5, color: color.muted }), { marginTop: 12 }]}>
                Sem funcionamento cadastrado para hoje: a grade mostra das {firstHour}h às{" "}
                {lastHour}h só para você conseguir ler o dia.
              </Text>
            ) : null}
          </View>
        ) : null}

        {view === "semana" ? <WeekView from={range.from} items={items} /> : null}
        {view === "mes" ? <MonthView today={today} items={items} /> : null}

        <View style={{ flexDirection: "row", gap: 9, paddingHorizontal: 20, paddingTop: 18 }}>
          <PrimaryButton
            label="Novo agendamento"
            style={{ flex: 1.5 }}
            onPress={() => router.push("/novo-agendamento")}
          />
          <OutlineButton
            label="Bloquear"
            height={52}
            style={{ flex: 1 }}
            onPress={() => router.push("/bloquear")}
          />
        </View>
      </ScreenScroll>
    </Screen>
  );
}

type Item = { startsAt: string; priceCents: number; status: string };

/** Sete dias em barras de densidade: a pergunta aqui é "que dia está cheio". */
function WeekView({ from, items }: { from: Date; items: Item[] }) {
  const names = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  const today = startOfDay(new Date()).getTime();

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shift(from, index);
    const dayItems = items.filter(
      (item) => startOfDay(new Date(item.startsAt)).getTime() === date.getTime(),
    );
    // Doze faixas de uma hora, das 8h às 20h — o desenho é sobre onde o dia
    // está cheio, não sobre a hora exata.
    const buckets = Array.from(
      { length: 12 },
      (_, hour) =>
        dayItems.filter((item) => new Date(item.startsAt).getHours() === 8 + hour).length,
    );
    return { date, count: dayItems.length, buckets };
  });

  const peak = Math.max(1, ...days.flatMap((day) => day.buckets));

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      <Text style={[sans(15, 700), { marginBottom: 12 }]}>
        {from.getDate()} a {shift(from, 6).getDate()} de {monthName(shift(from, 6).getMonth())}
      </Text>

      {days.map((day) => (
        <View
          key={day.date.toISOString()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: color.lineSoft,
          }}
        >
          <View style={{ width: 42 }}>
            <Text style={mono(10, 500, { color: color.muted })}>{names[day.date.getDay()]}</Text>
            <Text
              style={sans(17, 700, {
                lh: 1.1,
                color: day.date.getTime() === today ? color.coral : color.ink,
              })}
            >
              {day.date.getDate()}
            </Text>
          </View>

          <View style={{ flex: 1, flexDirection: "row", gap: 2, height: 26, alignItems: "center" }}>
            {day.buckets.map((value, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: value === 0 ? 3 : 4 + (value / peak) * 18,
                  borderRadius: 3,
                  backgroundColor:
                    value === 0
                      ? color.fill
                      : value / peak >= 0.7
                        ? color.green
                        : value / peak >= 0.4
                          ? color.amber
                          : color.track,
                }}
              />
            ))}
          </View>

          <View style={{ width: 58, alignItems: "flex-end" }}>
            <Text style={mono(13, 600)}>{day.count === 0 ? "—" : day.count}</Text>
            <Text style={sans(9.5, 500, { color: color.muted })}>
              {day.count === 0 ? "vazio" : "atend."}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** O mês em quadradinhos. A barra embaixo do número é a carga do dia. */
function MonthView({ today, items }: { today: Date; items: Item[] }) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const total = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const offset = first.getDay();
  const cells = Math.ceil((offset + total) / 7) * 7;

  const byDay = new Map<number, number>();
  for (const item of items) {
    const day = new Date(item.startsAt).getDate();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const peak = Math.max(1, ...byDay.values());

  const revenue = items
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + item.priceCents, 0);

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Text style={sans(15, 700)}>
          {monthName(today.getMonth()).replace(/^./, (letter) => letter.toUpperCase())}{" "}
          {today.getFullYear()}
        </Text>
        <Text style={mono(11, 500, { color: color.muted })}>
          {moneyShort(revenue).toUpperCase()} CONCLUÍDO
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((letter, index) => (
          <View
            key={index}
            style={{ width: `${100 / 7}%`, alignItems: "center", paddingBottom: 4 }}
          >
            <Text style={mono(10, 600, { color: color.faint })}>{letter}</Text>
          </View>
        ))}

        {Array.from({ length: cells }, (_, index) => {
          const day = index - offset + 1;
          const valid = day >= 1 && day <= total;
          const count = valid ? (byDay.get(day) ?? 0) : 0;
          const isToday = valid && day === today.getDate();

          return (
            <View key={index} style={{ width: `${100 / 7}%`, padding: 2 }}>
              <View
                style={{
                  aspectRatio: 1,
                  borderRadius: 8,
                  backgroundColor: isToday ? color.coralTint : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}
              >
                <Text
                  style={sans(12, 600, {
                    color: !valid ? "transparent" : isToday ? color.coral : color.ink,
                  })}
                >
                  {valid ? day : ""}
                </Text>
                <View
                  style={{
                    width: "60%",
                    height: 3,
                    borderRadius: 999,
                    backgroundColor: !valid
                      ? "transparent"
                      : count === 0
                        ? color.track
                        : count / peak >= 0.6
                          ? color.green
                          : color.amber,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        {[
          { tint: color.green, label: "dia cheio" },
          { tint: color.amber, label: "meia agenda" },
          { tint: color.track, label: "sem nada marcado" },
        ].map((entry) => (
          <View key={entry.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View
              style={{ width: 14, height: 3, borderRadius: 999, backgroundColor: entry.tint }}
            />
            <Text style={sans(11, 500, { color: color.muted })}>{entry.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
