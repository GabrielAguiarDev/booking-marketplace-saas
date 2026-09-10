import { moneyShort } from "@vez/mobile-kit/format";
import { mono, sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import { AlertTriangle, Check } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  type Appointment,
  approveAppointment,
  presentation,
  refuseAppointment,
  useAppointments,
  usePending,
} from "../../src/data/appointments";
import { onTheWayRows, useEstablishment, waitingRows } from "../../src/data/establishment";
import { useTodayRevenue } from "../../src/data/finance";
import { callEntry, finishEntry, type QueueRow } from "../../src/data/queue";
import { buildRail, type RailItem } from "../../src/data/rail";
import { openingLabel, useBusinessHours, useExceptions } from "../../src/data/schedule";
import { clock, headerDate, minutesLabel, moneyPlain, secondsSince } from "../../src/format";
import { color } from "../../src/theme/tokens";
import { AccountSheet } from "../../src/ui/AccountSheet";
import {
  Card,
  ErrorNote,
  Hatch,
  Initials,
  PulseDot,
  SectionHeader,
  StatusTag,
  Tag,
} from "../../src/ui/primitives";
import { Screen, ScreenScroll, TodayHeader } from "../../src/ui/Screen";
import { useToast } from "../../src/ui/Toast";

function dayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start,
    end,
    isoDay: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
  };
}

/** Instante truncado ao minuto ou ao dia, para servir de dependência estável. */
function truncate(date: Date, unit: "minute" | "day"): number {
  const copy = new Date(date);
  if (unit === "day") copy.setHours(0, 0, 0, 0);
  else copy.setSeconds(0, 0);
  return copy.getTime();
}

/**
 * Hoje — a tela que responde "o que está acontecendo agora".
 *
 * A ordem das seções é a ordem da urgência de quem está atrás do balcão: o que
 * exige ação imediata (atrasado, cadeira parada), o que exige decisão hoje
 * (pedido esperando sim), e só então o desenho do dia inteiro. É por isso que o
 * trilho — o elemento mais bonito da tela — vem por último.
 */
export default function Hoje() {
  const router = useRouter();
  const toast = useToast();
  const { establishment, settings, queue, queueError } = useEstablishment();
  const [accountOpen, setAccountOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Três relógios com granularidades diferentes, e a diferença importa: o
  // segundo move o cronômetro na tela, o minuto refaz o trilho, e o dia refaz
  // as consultas. Um relógio só, de segundo, refaria a consulta do dia inteiro
  // uma vez por segundo.
  const [minuteMs, setMinuteMs] = useState(() => truncate(new Date(), "minute"));
  const [dayMs, setDayMs] = useState(() => truncate(new Date(), "day"));

  useEffect(() => {
    const timer = setInterval(() => {
      const next = new Date();
      setNow(next);
      setMinuteMs((previous) => {
        const value = truncate(next, "minute");
        return value === previous ? previous : value;
      });
      setDayMs((previous) => {
        const value = truncate(next, "day");
        return value === previous ? previous : value;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const bounds = useMemo(() => dayBounds(new Date(dayMs)), [dayMs]);

  const id = establishment?.id ?? null;
  const appointments = useAppointments(id, bounds.start.toISOString(), bounds.end.toISOString());
  const pending = usePending(id);
  const hours = useBusinessHours(id);
  const exceptions = useExceptions(id, bounds.isoDay, bounds.isoDay);
  const revenue = useTodayRevenue(id);

  const waiting = useMemo(() => waitingRows(queue), [queue]);
  const onTheWay = useMemo(() => onTheWayRows(queue), [queue]);
  const serving = queue.find((row) => row.status === "in_service") ?? null;
  const called = queue.find((row) => row.status === "called") ?? null;

  const usesQueue =
    establishment?.booking_mode === "queue" || establishment?.booking_mode === "both";

  const today = useMemo(() => appointments.data ?? [], [appointments.data]);
  const servedCount = today.filter((item) => item.status === "completed").length;

  const liveAppointment =
    serving === null
      ? (today.find((item) => {
          const start = new Date(item.startsAt).getTime();
          const end = new Date(item.endsAt).getTime();
          return (
            now.getTime() >= start &&
            now.getTime() < end &&
            (item.status === "confirmed" || item.status === "scheduled")
          );
        }) ?? null)
      : null;

  const waitingCount = waiting.length;
  const slotInterval = establishment?.slot_interval_minutes ?? 15;
  const railHours = hours.data;
  const railExceptions = exceptions.data;

  const rail = useMemo(
    () =>
      buildRail({
        appointments: today,
        hours: railHours ?? [],
        exceptions: railExceptions ?? [],
        queueWaiting: usesQueue ? waitingCount : 0,
        // Minuto, não segundo: a faixa da fila e o cálculo de buraco não mudam
        // de desenho dentro do mesmo minuto.
        now: new Date(minuteMs),
        minimumGapMinutes: Math.max(15, slotInterval),
      }),
    [today, railHours, railExceptions, waitingCount, usesQueue, minuteMs, slotInterval],
  );

  const late = today.filter((item) => {
    const end = new Date(item.endsAt).getTime();
    return (
      (item.status === "confirmed" || item.status === "scheduled") &&
      now.getTime() > end + 5 * 60_000
    );
  });

  const averageWait =
    waiting.length === 0
      ? 0
      : Math.round(
          waiting.reduce((sum, row) => sum + row.estimatedWaitMinutes, 0) / waiting.length,
        );

  async function decide(appointment: Appointment, approve: boolean) {
    const result = approve
      ? await approveAppointment(appointment.id)
      : await refuseAppointment(appointment.id, "Recusado pela loja");

    if (!result.ok) {
      toast(result.message ?? "Não deu certo.", "bad");
      return;
    }
    toast(
      approve
        ? `${appointment.name} está confirmado.`
        : `Recusado. ${appointment.name} foi avisado pelo app.`,
    );
    pending.reload();
    appointments.reload();
  }

  return (
    <Screen>
      <TodayHeader
        name={establishment?.name ?? "—"}
        status={`${headerDate(now).toUpperCase()} · ${openingLabel(hours.data ?? [], now)}`}
        served={String(servedCount)}
        queueCount={usesQueue ? String(waiting.length) : "—"}
        revenue={moneyPlain(revenue.data?.cents ?? 0)}
        onPressAccount={() => setAccountOpen(true)}
      />

      <ScreenScroll>
        {appointments.error ? (
          <ErrorNote message={appointments.error} onRetry={appointments.reload} />
        ) : null}
        {queueError ? <ErrorNote message={queueError} /> : null}

        {establishment && establishment.status !== "active" ? (
          <Alert
            tint={color.amber}
            background={color.amberTint}
            title="A loja ainda não aparece nas buscas"
            body="Ela está como pendente. Termine a configuração; a publicação depende da aprovação da plataforma."
            cta="Ver o que falta"
            onPress={() => router.push("/comecar")}
          />
        ) : null}

        {/* Dois alertas, no máximo. Uma pilha de avisos idênticos no fim do dia
            deixa de ser alerta e vira ruído — e aí o atendente para de ler. */}
        {late.slice(0, 2).map((item) => (
          <Alert
            key={item.id}
            tint={color.amber}
            background={color.amberTint}
            title={`${item.name} está em aberto desde as ${new Date(item.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            body={`${item.serviceName} com ${item.professionalName}. Concluir, marcar falta ou ligar?`}
            cta="Abrir"
            onPress={() => router.push(`/agendamento/${item.id}`)}
          />
        ))}

        {late.length > 2 ? (
          <Alert
            tint={color.amber}
            background={color.amberTint}
            title={`Mais ${late.length - 2} atendimentos de hoje em aberto`}
            body="Nenhum deles foi concluído nem marcado como falta. Enquanto ficarem assim, não entram no faturamento."
            cta="Ver dia"
            onPress={() => router.navigate("/agenda")}
          />
        ) : null}

        {/* ── AGORA ─────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 }}>
          <SectionHeader label="Agora" />
        </View>

        {serving ? (
          <ServingCard
            row={serving}
            now={now}
            onFinish={async () => {
              const result = await finishEntry(serving.id);
              toast(
                result.ok ? `Atendimento de ${serving.name} concluído.` : "Não deu certo.",
                result.ok ? "ok" : "bad",
              );
            }}
          />
        ) : liveAppointment ? (
          <AppointmentNowCard
            appointment={liveAppointment}
            now={now}
            onOpen={() => router.push(`/agendamento/${liveAppointment.id}`)}
          />
        ) : (
          <IdleCard
            usesQueue={usesQueue}
            waiting={waiting.length}
            called={called}
            onCallNext={async () => {
              const next = waiting[0];
              if (!next) return;
              const result = await callEntry(next.id);
              toast(
                result.ok ? `${next.name} foi chamado.` : (result.message ?? "Não deu certo."),
                result.ok ? "ok" : "bad",
              );
            }}
            onOpenQueue={() => router.navigate("/fila")}
          />
        )}

        {/* ── PRECISA DA SUA DECISÃO ────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 26, paddingBottom: 8 }}>
          <SectionHeader
            label="Precisa da sua decisão"
            count={pending.data?.length ? pending.data.length : undefined}
          />
        </View>

        {pending.data && pending.data.length > 0 ? (
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {pending.data.map((item) => (
              <PendingCard
                key={item.id}
                appointment={item}
                onOpen={() => router.push(`/agendamento/${item.id}`)}
                onApprove={() => decide(item, true)}
                onRefuse={() => decide(item, false)}
              />
            ))}
          </View>
        ) : (
          <View
            style={{
              marginHorizontal: 20,
              padding: 16,
              borderRadius: 14,
              backgroundColor: color.rest,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                backgroundColor: color.green,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={13} color="#fff" strokeWidth={3} />
            </View>
            <Text style={[sans(13.5, 600, { lh: 1.4 }), { flex: 1 }]}>
              {settings?.auto_approve
                ? "Aprovação automática ligada. Nada espera por você."
                : "Nada aguardando aprovação. Tudo respondido."}
            </Text>
          </View>
        )}

        {/* ── TRILHO DO DIA ─────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 10 }}>
          <SectionHeader
            label="Trilho do dia"
            meta={
              rail.freeMinutes > 0
                ? `${minutesLabel(rail.freeMinutes)} SEM NINGUÉM NA CADEIRA`
                : "DIA CHEIO"
            }
          />
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {rail.items.length === 0 ? (
            <Text style={sans(13.5, 400, { lh: 1.5, color: color.muted })}>
              Nada marcado hoje. Quando alguém agendar, aparece aqui em ordem de horário.
            </Text>
          ) : (
            rail.items.map((item, index) => (
              <RailRow
                key={`${item.kind}-${item.start.toISOString()}-${index}`}
                item={item}
                last={index === rail.items.length - 1}
                now={now}
                queueWaiting={waiting.length}
                onPress={() => {
                  if (item.kind === "appointment") {
                    router.push(`/agendamento/${item.appointment.id}`);
                  } else if (item.kind === "queue") {
                    router.navigate("/fila");
                  } else if (item.kind === "gap") {
                    router.push("/novo-agendamento");
                  } else {
                    router.push("/bloquear");
                  }
                }}
              />
            ))
          )}
        </View>

        {/* ── RESUMO DA FILA ────────────────────────────────────────────── */}
        {usesQueue ? (
          <Pressable onPress={() => router.navigate("/fila")} style={{ margin: 20, marginTop: 14 }}>
            <Card radius={16} padding={15} shadow>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <PulseDot />
                  <Text style={sans(14, 700)}>Fila de espera agora</Text>
                </View>
                <Text style={sans(13, 700, { color: color.coral })}>Abrir ›</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
                <MiniStat value={String(waiting.length)} label="esperando" />
                <MiniStat
                  value={minutesLabel(averageWait)}
                  label="espera média"
                  tint={color.amber}
                />
                <MiniStat value={waiting[0]?.name.split(" ")[0] ?? "—"} label="próximo" />
              </View>
            </Card>
          </Pressable>
        ) : null}

        {onTheWay.length > 0 ? (
          <Text
            style={[
              sans(12.5, 400, { lh: 1.5, color: color.muted }),
              { paddingHorizontal: 20, paddingTop: 4 },
            ]}
          >
            {onTheWay.length === 1 ? "Uma pessoa entrou" : `${onTheWay.length} pessoas entraram`}{" "}
            pelo app e ainda não confirmaram chegada. Elas não seguram a fila.
          </Text>
        ) : null}
      </ScreenScroll>

      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </Screen>
  );
}

function MiniStat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View>
      <Text style={mono(18, 600, { color: tint ?? color.ink })} numberOfLines={1}>
        {value}
      </Text>
      <Text style={sans(10.5, 500, { color: color.muted })}>{label}</Text>
    </View>
  );
}

function Alert({
  tint,
  background,
  title,
  body,
  cta,
  onPress,
}: {
  tint: string;
  background: string;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        gap: 10,
        alignItems: "flex-start",
        paddingVertical: 13,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: color.line,
        backgroundColor: background,
      }}
    >
      <View style={{ marginTop: 1 }}>
        <AlertTriangle size={17} color={tint} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={sans(13, 700, { lh: 1.3, color: tint })}>{title}</Text>
        <Text style={sans(12.5, 400, { lh: 1.4, color: color.muted })}>{body}</Text>
      </View>
      <Text style={sans(12, 600, { color: tint })}>{cta}</Text>
    </Pressable>
  );
}

/** A cadeira ocupada por alguém que veio da fila. */
function ServingCard({ row, now, onFinish }: { row: QueueRow; now: Date; onFinish: () => void }) {
  const elapsed = secondsSince(row.servedAt ?? row.joinedAt, now.getTime());
  const total = (row.serviceMinutes ?? 30) * 60;
  const percent = Math.min(100, Math.round((elapsed / total) * 100));

  return (
    <View style={{ marginHorizontal: 20, marginTop: 6 }}>
      <Card radius={16} shadow>
        <View style={{ flexDirection: "row", gap: 13, padding: 15, alignItems: "flex-start" }}>
          <Initials name={row.name} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={sans(16, 700, { lh: 1.25 })}>{row.name}</Text>
            <Text style={sans(13, 400, { lh: 1.4, color: color.muted })}>
              {row.serviceName ?? "Sem serviço escolhido"} · da fila
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={mono(21, 600, { lh: 1, ls: -0.5 / 21 })}>{clock(elapsed)}</Text>
            <Text style={[sans(10, 500, { ls: 0.3 / 10, color: color.muted }), { marginTop: 3 }]}>
              DE {row.serviceMinutes ?? 30} MIN
            </Text>
          </View>
        </View>

        <View style={{ height: 3, backgroundColor: color.lineSoft }}>
          <View
            style={{
              height: 3,
              width: `${percent}%`,
              backgroundColor: percent >= 100 ? color.amber : color.green,
            }}
          />
        </View>

        <Pressable
          onPress={onFinish}
          style={{ paddingVertical: 14, alignItems: "center", backgroundColor: color.bg }}
        >
          <Text style={sans(14, 700, { color: color.green })}>Concluir atendimento</Text>
        </Pressable>
      </Card>
    </View>
  );
}

/** A cadeira ocupada por quem tinha hora marcada. */
function AppointmentNowCard({
  appointment,
  now,
  onOpen,
}: {
  appointment: Appointment;
  now: Date;
  onOpen: () => void;
}) {
  const elapsed = secondsSince(appointment.startsAt, now.getTime());
  const total = appointment.serviceMinutes * 60;
  const percent = Math.min(100, Math.round((elapsed / total) * 100));

  return (
    <View style={{ marginHorizontal: 20, marginTop: 6 }}>
      <Card radius={16} shadow>
        <View style={{ flexDirection: "row", gap: 13, padding: 15, alignItems: "flex-start" }}>
          <Initials name={appointment.name} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={sans(16, 700, { lh: 1.25 })}>{appointment.name}</Text>
            <Text style={sans(13, 400, { lh: 1.4, color: color.muted })}>
              {appointment.serviceName} · com {appointment.professionalName}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={mono(21, 600, { lh: 1, ls: -0.5 / 21 })}>{clock(elapsed)}</Text>
            <Text style={[sans(10, 500, { ls: 0.3 / 10, color: color.muted }), { marginTop: 3 }]}>
              DE {appointment.serviceMinutes} MIN
            </Text>
          </View>
        </View>

        <View style={{ height: 3, backgroundColor: color.lineSoft }}>
          <View
            style={{
              height: 3,
              width: `${percent}%`,
              backgroundColor: percent >= 100 ? color.amber : color.green,
            }}
          />
        </View>

        <Pressable
          onPress={onOpen}
          style={{ paddingVertical: 14, alignItems: "center", backgroundColor: color.bg }}
        >
          <Text style={sans(14, 700, { color: color.coral })}>Abrir atendimento</Text>
        </Pressable>
      </Card>
    </View>
  );
}

/** Ninguém na cadeira. O convite muda conforme haja ou não fila. */
function IdleCard({
  usesQueue,
  waiting,
  called,
  onCallNext,
  onOpenQueue,
}: {
  usesQueue: boolean;
  waiting: number;
  called: QueueRow | null;
  onCallNext: () => void;
  onOpenQueue: () => void;
}) {
  const body = called
    ? `${called.name} já foi chamado e ainda não sentou.`
    : usesQueue && waiting > 0
      ? `Ninguém em atendimento. ${waiting === 1 ? "Uma pessoa espera" : `${waiting} pessoas esperam`} na fila.`
      : "Ninguém em atendimento agora.";

  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 6,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: color.track,
        borderRadius: 16,
        backgroundColor: color.rest,
        paddingVertical: 20,
        paddingHorizontal: 16,
        alignItems: "center",
      }}
    >
      <Text style={sans(14, 700)}>Cadeira livre</Text>
      <Text
        style={[
          sans(12.5, 400, { lh: 1.45, color: color.muted }),
          { textAlign: "center", marginTop: 4, marginBottom: 12 },
        ]}
      >
        {body}
      </Text>
      {usesQueue && (waiting > 0 || called) ? (
        <Pressable
          onPress={called ? onOpenQueue : onCallNext}
          style={{
            paddingVertical: 11,
            paddingHorizontal: 18,
            borderRadius: 999,
            backgroundColor: color.coral,
          }}
        >
          <Text style={sans(13, 700, { color: "#fff" })}>
            {called ? "Ver a fila" : "Chamar próximo"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PendingCard({
  appointment,
  onOpen,
  onApprove,
  onRefuse,
}: {
  appointment: Appointment;
  onOpen: () => void;
  onApprove: () => void;
  onRefuse: () => void;
}) {
  const when = new Date(appointment.startsAt);
  const today = new Date();
  const sameDay = when.toDateString() === today.toDateString();

  return (
    <Card radius={16} shadow>
      <Pressable
        onPress={onOpen}
        style={{ paddingHorizontal: 15, paddingTop: 14, paddingBottom: 12 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={sans(15.5, 700, { lh: 1.25 })}>{appointment.name}</Text>
            <Text style={sans(13, 400, { lh: 1.4, color: color.muted })}>
              {appointment.serviceName} · {appointment.professionalName}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 3 }}>
            <Text style={mono(13, 600)}>
              {sameDay
                ? "hoje"
                : when.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              {" · "}
              {when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </Text>
            <Text style={mono(13, 600, { color: color.muted })}>
              {moneyShort(appointment.priceCents)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {appointment.depositCents > 0 ? (
            <StatusTag
              label={`sinal de ${moneyShort(appointment.depositCents)}`}
              tint={color.green}
              background={color.greenTint}
            />
          ) : (
            <StatusTag label="aguardando você" tint={color.amber} background={color.amberTint} />
          )}
          <Tag label={appointment.hasAccount ? "cliente do app" : "cadastrado no balcão"} />
        </View>
      </Pressable>

      <View style={{ flexDirection: "row", gap: 1, backgroundColor: color.line }}>
        <Pressable
          onPress={onRefuse}
          style={{ flex: 1, paddingVertical: 13, alignItems: "center", backgroundColor: color.bg }}
        >
          <Text style={sans(14, 600, { color: color.muted })}>Recusar</Text>
        </Pressable>
        <Pressable
          onPress={onApprove}
          style={{
            flex: 1.6,
            paddingVertical: 13,
            alignItems: "center",
            backgroundColor: color.coral,
          }}
        >
          <Text style={sans(14, 700, { color: "#fff" })}>Aprovar</Text>
        </Pressable>
      </View>
    </Card>
  );
}

/** Uma linha do trilho: hora, marcador, e o que ocupa a faixa. */
function RailRow({
  item,
  last,
  now,
  queueWaiting,
  onPress,
}: {
  item: RailItem;
  last: boolean;
  now: Date;
  queueWaiting: number;
  onPress: () => void;
}) {
  const time = item.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const marker =
    item.kind === "queue"
      ? { dot: color.coral, size: 9, line: color.coralBorder, width: 3, timeTint: color.coral }
      : item.kind === "appointment"
        ? {
            dot: presentation(item.appointment, now.getTime()).tint,
            size: presentation(item.appointment, now.getTime()).live ? 12 : 9,
            line: color.line,
            width: 2,
            timeTint: presentation(item.appointment, now.getTime()).live
              ? color.coral
              : color.muted,
          }
        : item.kind === "block"
          ? { dot: color.track, size: 7, line: color.fill, width: 2, timeTint: color.hint }
          : { dot: color.bg, size: 7, line: color.fill, width: 2, timeTint: color.hint };

  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", gap: 11 }}>
      <View style={{ width: 44, paddingTop: 1 }}>
        <Text style={mono(12, 500, { ls: -0.2 / 12, color: marker.timeTint })}>{time}</Text>
      </View>

      <View style={{ width: 13, alignItems: "center" }}>
        <View
          style={{
            width: marker.size,
            height: marker.size,
            borderRadius: 999,
            backgroundColor: marker.dot,
            borderWidth: item.kind === "gap" ? 2 : 0,
            borderColor: color.stroke,
            marginTop: 3,
          }}
        />
        {!last ? (
          <View
            style={{ flex: 1, width: marker.width, backgroundColor: marker.line, marginTop: 3 }}
          />
        ) : null}
      </View>

      <View style={{ flex: 1, paddingBottom: 10 }}>
        {item.kind === "appointment" ? <RailAppointment item={item} now={now} /> : null}
        {item.kind === "gap" ? <RailGap minutes={item.minutes} /> : null}
        {item.kind === "block" ? <RailBlock label={item.label} /> : null}
        {item.kind === "queue" ? <RailQueue waiting={queueWaiting} /> : null}
      </View>
    </Pressable>
  );
}

function RailAppointment({
  item,
  now,
}: {
  item: Extract<RailItem, { kind: "appointment" }>;
  now: Date;
}) {
  const look = presentation(item.appointment, now.getTime());
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: look.live ? color.coralBorder : color.line,
        borderRadius: 13,
        paddingVertical: 11,
        paddingHorizontal: 12,
        backgroundColor: look.live ? color.coralPale : color.bg,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[
              sans(14.5, 700, {
                lh: 1.25,
                color:
                  look.strike || item.appointment.status === "completed" ? color.muted : color.ink,
              }),
              look.strike ? { textDecorationLine: "line-through" } : null,
            ]}
          >
            {item.appointment.name}
          </Text>
          <Text style={sans(12.5, 400, { lh: 1.35, color: color.muted })}>
            {item.appointment.serviceName} · {item.appointment.serviceMinutes} min ·{" "}
            {item.appointment.professionalName}
          </Text>
        </View>
        <StatusTag label={look.label} tint={look.tint} background={look.background} />
      </View>
    </View>
  );
}

function RailGap({ minutes }: { minutes: number }) {
  return (
    <View
      style={{
        borderRadius: 13,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: color.stroke,
        overflow: "hidden",
      }}
    >
      <Hatch />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 9,
          paddingHorizontal: 12,
        }}
      >
        <Text style={mono(12, 500, { color: color.faint })}>
          LIVRE · {minutesLabel(minutes).toUpperCase()}
        </Text>
        <Text style={sans(12, 700, { color: color.coral })}>+ preencher</Text>
      </View>
    </View>
  );
}

function RailBlock({ label }: { label: string }) {
  return (
    <View
      style={{
        borderRadius: 13,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: color.rest,
        borderWidth: 1,
        borderColor: color.line,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={sans(13, 600, { color: color.muted })}>{label}</Text>
      <Text style={mono(11, 500, { color: color.faint })}>BLOQUEADO</Text>
    </View>
  );
}

function RailQueue({ waiting }: { waiting: number }) {
  return (
    <View
      style={{
        borderRadius: 13,
        padding: 12,
        backgroundColor: color.coralSoft,
        borderWidth: 1,
        borderColor: color.coralBorder,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={sans(13.5, 700, { color: color.coral })}>Fila viva ocupa esta faixa</Text>
        <Text style={mono(12, 600, { color: color.coral })}>{waiting} NA FILA</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: 9 }}>
        {Array.from({ length: Math.min(waiting, 10) }, (_, index) => (
          <View
            key={index}
            style={{
              height: 6,
              flex: 1,
              borderRadius: 999,
              backgroundColor: index === 0 ? color.coral : color.coralFaded,
            }}
          />
        ))}
      </View>
      <Text style={[sans(12, 400, { lh: 1.4, color: color.coralDeep }), { marginTop: 8 }]}>
        Sem hora marcada: ordem de chegada. Abrir a fila →
      </Text>
    </View>
  );
}
