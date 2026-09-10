import { mono, sans } from "@vez/mobile-kit/theme";
import { Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useProfessionals } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishment";
import { createBlock, removeBlock, useBusinessHours, useExceptions } from "../src/data/schedule";
import { clockFromTime, weekdayLong } from "../src/format";
import { color } from "../src/theme/tokens";
import { Field } from "../src/ui/Field";
import { Card, Caveat, Pill, PrimaryButton, SectionLabel } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";
import { useToast } from "../src/ui/Toast";

type Preset = {
  key: string;
  label: string;
  date: Date;
  startsAt: string | null;
  endsAt: string | null;
  reason: string;
};

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Bloquear período.
 *
 * A tabela por trás se chama `schedule_exceptions`, e não "bloqueios", porque
 * ela guarda os dois sentidos — o almoço de hoje e o sábado extra que alguém
 * resolveu abrir. Esta tela cobre só o lado do bloqueio, que é o que acontece
 * de véspera e com pressa.
 *
 * Os atalhos são calculados a partir do funcionamento real da loja: "resto do
 * dia" termina na hora em que ela fecha de verdade, não às 18h por convenção.
 */
export default function Bloquear() {
  const toast = useToast();
  const { establishment } = useEstablishment();

  const id = establishment?.id ?? null;
  const hours = useBusinessHours(id);
  const professionals = useProfessionals(id);

  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => {
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    return next;
  }, [today]);

  const exceptions = useExceptions(
    id,
    isoDate(today),
    isoDate(new Date(today.getTime() + 30 * 86_400_000)),
  );

  const [selected, setSelected] = useState<string>("almoco");
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const todayHours = (hours.data ?? []).filter((hour) => hour.weekday === today.getDay());
  const closesToday =
    todayHours.length > 0
      ? todayHours.reduce((latest, hour) => (hour.closesAt > latest ? hour.closesAt : latest), "")
      : "19:00:00";
  const nowTime = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}:00`;

  const presets: Preset[] = [
    {
      key: "almoco",
      label: "Almoço hoje",
      date: today,
      startsAt: "12:00:00",
      endsAt: "13:00:00",
      reason: "Almoço",
    },
    {
      key: "resto",
      label: "Resto do dia",
      date: today,
      startsAt: nowTime,
      endsAt: closesToday,
      reason: "Fechamos mais cedo",
    },
    {
      key: "hoje",
      label: "Hoje inteiro",
      date: today,
      startsAt: null,
      endsAt: null,
      reason: "Fechado hoje",
    },
    {
      key: "amanha",
      label: "Amanhã inteiro",
      date: tomorrow,
      startsAt: null,
      endsAt: null,
      reason: "Fechado",
    },
  ];

  const preset = presets.find((item) => item.key === selected) ?? presets[0]!;
  const scope =
    professionalId === null
      ? "toda a loja"
      : ((professionals.data ?? []).find((item) => item.id === professionalId)?.displayName ??
        "toda a loja");

  async function submit() {
    if (!establishment) return;

    setBusy(true);
    const result = await createBlock({
      establishmentId: establishment.id,
      professionalId,
      date: isoDate(preset.date),
      startsAt: preset.startsAt,
      endsAt: preset.endsAt,
      reason: reason.trim() || preset.reason,
    });
    setBusy(false);

    if (!result.ok) {
      toast(result.message ?? "Não deu certo.", "bad");
      return;
    }
    toast("Período bloqueado.");
    exceptions.reload();
    setReason("");
  }

  return (
    <Screen>
      <PlainHeader title="Bloquear período" />

      <ScreenScroll bottom={40}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 18 }}>
          <Text style={sans(13.5, 400, { lh: 1.5, color: color.muted })}>
            O período some da grade do cliente na hora. Quem já tinha marcado continua marcado —
            bloquear não cancela reserva vendida.
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {presets.map((item) => (
              <Pill
                key={item.key}
                label={item.label}
                active={selected === item.key}
                onPress={() => setSelected(item.key)}
              />
            ))}
          </View>

          <View style={{ gap: 9 }}>
            <SectionLabel tint={color.muted}>Quem fica bloqueado</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              <Pill
                label="Toda a loja"
                active={professionalId === null}
                onPress={() => setProfessionalId(null)}
              />
              {(professionals.data ?? [])
                .filter((professional) => professional.isActive)
                .map((professional) => (
                  <Pill
                    key={professional.id}
                    label={professional.displayName}
                    active={professionalId === professional.id}
                    onPress={() => setProfessionalId(professional.id)}
                  />
                ))}
            </View>
          </View>

          <Card radius={14}>
            <Row
              label="Dia"
              value={`${weekdayLong(preset.date.getDay())}, ${preset.date.getDate()}`}
            />
            <Row
              label="Das"
              value={preset.startsAt ? clockFromTime(preset.startsAt) : "00:00 (dia inteiro)"}
            />
            <Row
              label="Até"
              value={preset.endsAt ? clockFromTime(preset.endsAt) : "23:59 (dia inteiro)"}
              last
            />
          </Card>

          <Field
            label="Motivo (opcional)"
            placeholder={preset.reason}
            value={reason}
            onChangeText={setReason}
          />

          <PrimaryButton
            label={busy ? "Bloqueando…" : `Bloquear para ${scope}`}
            height={56}
            disabled={busy}
            onPress={submit}
          />
        </View>

        {(exceptions.data ?? []).length > 0 ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 28, gap: 10 }}>
            <SectionLabel>Bloqueios dos próximos 30 dias</SectionLabel>
            {(exceptions.data ?? [])
              .filter((exception) => !exception.isAvailable)
              .map((exception) => {
                const owner = exception.professionalId
                  ? ((professionals.data ?? []).find(
                      (professional) => professional.id === exception.professionalId,
                    )?.displayName ?? "profissional")
                  : "toda a loja";

                return (
                  <Card key={exception.id} radius={13} padding={13}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={sans(14, 700)}>{exception.reason ?? "Bloqueado"}</Text>
                        <Text style={mono(11.5, 500, { color: color.muted })}>
                          {exception.date.split("-").reverse().slice(0, 2).join("/")} ·{" "}
                          {exception.startsAt
                            ? `${clockFromTime(exception.startsAt)}–${clockFromTime(exception.endsAt ?? "23:59")}`
                            : "dia inteiro"}{" "}
                          · {owner}
                        </Text>
                      </View>
                      <Pressable
                        hitSlop={8}
                        onPress={async () => {
                          const result = await removeBlock(exception.id);
                          toast(
                            result.ok ? "Período liberado." : (result.message ?? "Não deu certo."),
                            result.ok ? "ok" : "bad",
                          );
                          exceptions.reload();
                        }}
                      >
                        <Trash2 size={17} color={color.danger} strokeWidth={1.8} />
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
          </View>
        ) : null}

        <View style={{ paddingTop: 24 }}>
          <Caveat>
            Bloquear não avisa ninguém: quem já tinha reserva dentro do período continua com ela, e
            a tela do cliente segue mostrando o horário confirmado. Se precisar desmarcar alguém,
            abra o agendamento e recuse — aí sim o cliente é avisado.
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.lineSoft,
      }}
    >
      <Text style={sans(13.5, 500, { color: color.muted })}>{label}</Text>
      <Text style={mono(13.5, 600)}>{value}</Text>
    </View>
  );
}
