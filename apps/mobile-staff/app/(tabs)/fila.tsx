import { mono, sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronUp, Users, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useServices } from "../../src/data/catalog";
import { onTheWayRows, useEstablishment, waitingRows } from "../../src/data/establishment";
import {
  addWalkIn,
  callEntry,
  confirmEntryArrival,
  markEntryAbsent,
  type QueueRow,
  seatEntry,
  swapQueueOrder,
} from "../../src/data/queue";
import { clock, minutesLabel, secondsSince } from "../../src/format";
import { color } from "../../src/theme/tokens";
import {
  Card,
  EmptyState,
  ErrorNote,
  Pill,
  PrimaryButton,
  SectionHeader,
} from "../../src/ui/primitives";
import { QueueHeader, Screen, ScreenScroll } from "../../src/ui/Screen";
import { Field } from "../../src/ui/Field";
import { Sheet } from "../../src/ui/Sheet";
import { useToast } from "../../src/ui/Toast";

const SOURCE = {
  counter: { label: "balcão", glyph: "B", tint: color.muted, background: color.neutralTint },
  qr: { label: "QR no local", glyph: "Q", tint: color.green, background: color.greenTint },
  app: { label: "pelo app", glyph: "A", tint: color.coral, background: color.coralTint },
} as const;

/**
 * A fila ao vivo.
 *
 * É a tela mais operacional do produto: alguém está de pé no balcão enquanto
 * ela é usada. Duas decisões vêm daí. A ação principal — chamar o próximo —
 * flutua acima do conteúdo e não rola junto, porque ela é usada dezenas de
 * vezes por dia e não pode depender de onde a lista está. E a espera de cada
 * pessoa corre em tempo real, porque "há quanto tempo o cara está sentado ali"
 * é a pergunta que decide se alguém vai embora.
 */
export default function Fila() {
  const router = useRouter();
  const toast = useToast();
  const { establishment, settings, queue, queueError } = useEstablishment();
  const services = useServices(establishment?.id ?? null, false);

  const [now, setNow] = useState(() => Date.now());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const waiting = useMemo(() => waitingRows(queue), [queue]);
  const onTheWay = useMemo(() => onTheWayRows(queue), [queue]);
  const called = queue.filter((row) => row.status === "called");
  const serving = queue.filter((row) => row.status === "in_service");

  const usesQueue =
    establishment?.booking_mode === "queue" || establishment?.booking_mode === "both";

  const averageWait =
    waiting.length === 0
      ? 0
      : Math.round(
          waiting.reduce((sum, row) => sum + row.estimatedWaitMinutes, 0) / waiting.length,
        );

  async function act(run: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    const result = await run();
    toast(result.ok ? success : (result.message ?? "Não deu certo."), result.ok ? "ok" : "bad");
  }

  async function commitWalkIn() {
    const trimmed = name.trim();
    if (!trimmed || !establishment) return;

    setSaving(true);
    const result = await addWalkIn({
      establishmentId: establishment.id,
      name: trimmed,
      phone: phone.trim() || null,
      serviceId,
    });
    setSaving(false);

    if (!result.ok) {
      toast(result.message ?? "Não deu certo.", "bad");
      return;
    }
    toast(`${trimmed} entrou na fila.`);
    setName("");
    setPhone("");
    setServiceId(null);
    setSheetOpen(false);
  }

  return (
    <Screen>
      <QueueHeader
        live={usesQueue}
        waiting={String(waiting.length)}
        averageWait={minutesLabel(averageWait)}
        onTheWay={String(onTheWay.length)}
        onAdjust={() => router.push("/fila-config")}
      />

      <ScreenScroll bottom={usesQueue ? 210 : 120}>
        {queueError ? <ErrorNote message={queueError} /> : null}

        {!usesQueue ? (
          <EmptyState
            glyph={<Users size={26} color={color.faint} strokeWidth={1.7} />}
            title="Esta loja não usa fila"
            body="Vocês atendem só com hora marcada. Se quiser receber por ordem de chegada também, ligue a fila nas configurações."
            action="Ligar a fila"
            onAction={() => router.push("/fila-config")}
          />
        ) : null}

        {usesQueue && serving.length > 0 ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 8 }}>
            <SectionHeader label="Na cadeira" />
            {serving.map((row) => (
              <Card
                key={row.id}
                radius={13}
                padding={13}
                background={color.greenTint}
                borderColor={color.greenTint}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={sans(14.5, 700, { color: color.greenDeep })}>{row.name}</Text>
                    <Text style={sans(12, 400, { color: color.greenDeep })}>
                      {row.serviceName ?? "sem serviço"} · há{" "}
                      {clock(secondsSince(row.servedAt ?? row.joinedAt, now))}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {usesQueue && called.length > 0 ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 8 }}>
            <SectionHeader label="Chamados" meta="ESPERANDO SENTAR" />
            {called.map((row) => (
              <Card
                key={row.id}
                radius={13}
                padding={13}
                background={color.coralSoft}
                borderColor={color.coralBorder}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={sans(14.5, 700)}>{row.name}</Text>
                    <Text style={sans(12, 400, { color: color.coralDeep })}>
                      chamado há {clock(secondsSince(row.calledAt ?? row.joinedAt, now))}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => act(() => seatEntry(row.id), `${row.name} sentou.`)}
                    style={{
                      paddingVertical: 9,
                      paddingHorizontal: 13,
                      borderRadius: 999,
                      backgroundColor: color.ink,
                    }}
                  >
                    <Text style={sans(12, 700, { color: "#fff" })}>Sentou</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      act(() => markEntryAbsent(row.id), `${row.name} marcado como ausente.`)
                    }
                    hitSlop={8}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      backgroundColor: color.bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={15} color={color.danger} strokeWidth={2.2} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {usesQueue && waiting.length > 0 ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
            <SectionHeader label="Esperando" meta={`${waiting.length} NA FILA`} />
            {waiting.map((row, index) => (
              <QueueLine
                key={row.id}
                row={row}
                index={index}
                now={now}
                onUp={
                  index === 0
                    ? undefined
                    : () => {
                        const above = waiting[index - 1];
                        if (!above) return;
                        void act(
                          () =>
                            swapQueueOrder(
                              { id: row.id, joinedAt: row.joinedAt },
                              { id: above.id, joinedAt: above.joinedAt },
                            ),
                          `${row.name} subiu uma posição.`,
                        );
                      }
                }
                onAbsent={() =>
                  act(() => markEntryAbsent(row.id), `${row.name} marcado como ausente.`)
                }
              />
            ))}
          </View>
        ) : null}

        {usesQueue && waiting.length === 0 && called.length === 0 ? (
          <EmptyState
            glyph={<Text style={mono(20, 600, { color: color.faint })}>0</Text>}
            title="Fila vazia"
            body="Quem chegar entra aqui. Você também pode colocar alguém pelo balcão agora."
            action="Adicionar pelo balcão"
            onAction={() => setSheetOpen(true)}
          />
        ) : null}

        {/* ── PRÉ-FILA ──────────────────────────────────────────────────── */}
        {onTheWay.length > 0 ? (
          <View
            style={{
              marginTop: 18,
              backgroundColor: color.rest,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 8,
              borderTopWidth: 1,
              borderTopColor: color.line,
            }}
          >
            <SectionHeader label="Pré-fila · a caminho" count={onTheWay.length} />
            <Text style={[sans(12, 400, { lh: 1.45, color: color.muted }), { marginTop: 5 }]}>
              Entraram pelo app e ainda não confirmaram chegada. Como vocês pedem confirmação, eles
              não ocupam posição — a fila só conta quem está aqui.
            </Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              {onTheWay.map((row) => (
                <Card key={row.id} radius={12} padding={12}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={sans(14, 700)}>{row.name}</Text>
                      <Text style={sans(12, 400, { color: color.muted })}>
                        {row.serviceName ?? "sem serviço"} · entrou há{" "}
                        {minutesLabel(secondsSince(row.joinedAt, now) / 60)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        act(() => confirmEntryArrival(row.id), `${row.name} entrou na fila.`)
                      }
                      style={{
                        paddingVertical: 9,
                        paddingHorizontal: 13,
                        borderRadius: 999,
                        backgroundColor: color.ink,
                      }}
                    >
                      <Text style={sans(12, 700, { color: "#fff" })}>Chegou</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        {usesQueue ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 14,
              paddingHorizontal: 20,
              paddingTop: 16,
            }}
          >
            {(["counter", "qr", "app"] as const).map((key) => (
              <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <SourceGlyph source={key} />
                <Text style={sans(11, 500, { color: color.muted })}>{SOURCE[key].label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {usesQueue && settings && !settings.queue_require_arrival ? (
          <Text
            style={[
              sans(12, 400, { lh: 1.5, color: color.muted }),
              { paddingHorizontal: 20, paddingTop: 14 },
            ]}
          >
            Confirmação de chegada está desligada: quem entra pelo app já pega posição de onde
            estiver.
          </Text>
        ) : null}
      </ScreenScroll>

      {/* ── AÇÃO PRIMÁRIA FLUTUANTE ──────────────────────────────────────── */}
      {usesQueue ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            // A aba central sobe 22px por cima da barra; sem esta folga o
            // quadrado coral encosta no botão coral e os dois viram um borrão.
            paddingBottom: 30,
          }}
          pointerEvents="box-none"
        >
          <LinearGradient
            colors={["rgba(255,255,255,0)", color.bg]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 90 }}
            pointerEvents="none"
          />
          <View style={{ flexDirection: "row", gap: 9 }}>
            <PrimaryButton
              label={waiting.length === 0 ? "Ninguém para chamar" : "Chamar próximo"}
              height={58}
              radius={16}
              disabled={waiting.length === 0}
              style={{ flex: 1 }}
              onPress={() => {
                const next = waiting[0];
                if (!next) return;
                void act(() => callEntry(next.id), `${next.name} foi chamado.`);
              }}
            />
            <Pressable
              onPress={() => setSheetOpen(true)}
              style={{
                width: 62,
                height: 58,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: color.line,
                backgroundColor: color.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={sans(26, 600)}>+</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Quem chegou?"
        subtitle="Nome e telefone. O resto pode ficar para depois."
      >
        <View style={{ gap: 10 }}>
          <Field
            placeholder="Nome do cliente"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
          />
          <Field
            placeholder="Telefone (opcional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            mono
          />

          {services.data && services.data.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 2 }}>
              {services.data.map((service) => (
                <Pill
                  key={service.id}
                  label={service.name}
                  active={serviceId === service.id}
                  onPress={() => setServiceId(serviceId === service.id ? null : service.id)}
                />
              ))}
            </View>
          ) : null}

          <Text style={sans(12, 400, { lh: 1.45, color: color.muted })}>
            Sem serviço escolhido, a espera é estimada por 30 minutos.
          </Text>

          <PrimaryButton
            label={saving ? "Colocando…" : "Colocar na fila"}
            height={56}
            disabled={saving || name.trim().length === 0}
            onPress={commitWalkIn}
            style={{ marginTop: 6 }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function SourceGlyph({ source }: { source: keyof typeof SOURCE }) {
  const look = SOURCE[source];
  return (
    <View
      style={{
        width: 13,
        height: 13,
        borderRadius: 3,
        backgroundColor: look.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={mono(8, 600, { color: look.tint })}>{look.glyph}</Text>
    </View>
  );
}

function QueueLine({
  row,
  index,
  now,
  onUp,
  onAbsent,
}: {
  row: QueueRow;
  index: number;
  now: number;
  onUp?: () => void;
  onAbsent: () => void;
}) {
  const seconds = secondsSince(row.arrivedAt ?? row.joinedAt, now);
  const waitTint = seconds > 1800 ? color.danger : seconds > 900 ? color.amber : color.ink;
  const since = new Date(row.arrivedAt ?? row.joinedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: color.lineSoft,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          backgroundColor: index === 0 ? color.coral : color.rest,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={mono(13, 600, { color: index === 0 ? "#fff" : color.ink })}>
          {row.position}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={sans(15, 700, { lh: 1.25 })} numberOfLines={1}>
          {row.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
          <Text style={sans(12.5, 400, { color: color.muted })} numberOfLines={1}>
            {row.serviceName ?? "sem serviço"}
          </Text>
          <View style={{ width: 3, height: 3, borderRadius: 999, backgroundColor: color.track }} />
          <SourceGlyph source={row.source} />
          <Text style={sans(11, 600, { color: SOURCE[row.source].tint })}>
            {SOURCE[row.source].label}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={mono(15, 600, { ls: -0.3 / 15, color: waitTint })}>{clock(seconds)}</Text>
        <Text style={[mono(9.5, 500, { color: color.faint }), { marginTop: 2 }]}>
          DESDE {since}
        </Text>
      </View>

      <View style={{ gap: 3 }}>
        <Pressable
          onPress={onUp}
          disabled={!onUp}
          hitSlop={6}
          style={{
            width: 26,
            height: 20,
            borderRadius: 5,
            backgroundColor: color.rest,
            alignItems: "center",
            justifyContent: "center",
            opacity: onUp ? 1 : 0.35,
          }}
        >
          <ChevronUp size={13} color={color.muted} strokeWidth={2.4} />
        </Pressable>
        <Pressable
          onPress={onAbsent}
          hitSlop={6}
          style={{
            width: 26,
            height: 20,
            borderRadius: 5,
            backgroundColor: color.rest,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={12} color={color.danger} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}
