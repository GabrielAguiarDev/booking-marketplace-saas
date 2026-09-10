import { moneyShort } from "@vez/mobile-kit/format";
import { sans } from "@vez/mobile-kit/theme";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import {
  approveAppointment,
  completeAppointment,
  markNoShow,
  presentation,
  refuseAppointment,
  rescheduleAppointment,
  useAppointment,
  useCustomerHistory,
} from "../../src/data/appointments";
import { useEstablishment } from "../../src/data/establishment";
import { color } from "../../src/theme/tokens";
import {
  Caveat,
  EmptyState,
  Initials,
  KeyRow,
  OutlineButton,
  PrimaryButton,
  StatusTag,
} from "../../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../../src/ui/Screen";
import { Sheet } from "../../src/ui/Sheet";
import { SlotPicker } from "../../src/ui/SlotPicker";
import { useToast } from "../../src/ui/Toast";

const REASONS = [
  "Agenda cheia nesse horário",
  "Profissional não estará",
  "Serviço indisponível",
  "Loja fechada nesse dia",
];

/**
 * Detalhe do agendamento — onde as decisões acontecem.
 *
 * As seis ações desta tela são as seis transições de `appointment_status` que a
 * loja pode fazer. Elas estão desenhadas em três níveis de peso, e o peso é a
 * consequência: aprovar é o botão cheio, remarcar e concluir são contorno, e
 * "não compareceu" e "recusar" ficam por último, em âmbar e vermelho. Nenhuma
 * pede confirmação; todas avisam por toast o que foi feito e o quê o cliente
 * recebe.
 */
export default function AgendamentoDetalhe() {
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { establishment } = useEstablishment();

  const query = useAppointment(id ?? null);
  const appointment = query.data;
  const history = useCustomerHistory(establishment?.id ?? null, appointment?.customerId ?? null);

  const [refuseOpen, setRefuseOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (query.loading) {
    return (
      <Screen>
        <PlainHeader title="Agendamento" />
      </Screen>
    );
  }

  if (!appointment) {
    return (
      <Screen>
        <PlainHeader title="Agendamento" />
        <EmptyState
          title="Agendamento não encontrado"
          body="Ele pode ter sido cancelado, ou pertencer a outra loja."
        />
      </Screen>
    );
  }

  const look = presentation(appointment);
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);
  const open = appointment.status === "scheduled" || appointment.status === "confirmed";

  async function run(action: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);

    if (!result.ok) {
      toast(result.message ?? "Não deu certo.", "bad");
      return;
    }
    toast(success);
    query.reload();
  }

  function call(scheme: "tel" | "whatsapp") {
    const digits = appointment?.phone?.replace(/\D/g, "");
    if (!digits) {
      toast("Este cliente não deixou telefone.", "bad");
      return;
    }
    const url = scheme === "tel" ? `tel:${digits}` : `https://wa.me/55${digits.replace(/^55/, "")}`;
    void Linking.openURL(url);
  }

  return (
    <Screen>
      <PlainHeader title="Agendamento" />

      <ScreenScroll bottom={40}>
        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: color.line }}>
          <View style={{ flexDirection: "row", gap: 13, alignItems: "center" }}>
            <Initials name={appointment.name} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={sans(20, 800, { lh: 1.2, ls: -0.3 / 20 })}>{appointment.name}</Text>
              <Text style={sans(13, 400, { color: color.muted })}>
                {appointment.hasAccount
                  ? history.data === null
                    ? "Cliente do app"
                    : history.data === 0
                      ? "Primeira vez aqui"
                      : `${history.data} ${history.data === 1 ? "atendimento" : "atendimentos"} aqui`
                  : "Cadastrado no balcão · sem conta no app"}
              </Text>
            </View>
            <StatusTag label={look.label} tint={look.tint} background={look.background} />
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            <ContactButton label="Ligar" onPress={() => call("tel")} />
            <ContactButton label="WhatsApp" onPress={() => call("whatsapp")} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <KeyRow label="Serviço" value={appointment.serviceName} />
          <KeyRow label="Profissional" value={appointment.professionalName} />
          <KeyRow
            label="Quando"
            valueMono
            value={`${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
          />
          <KeyRow label="Valor" valueMono value={moneyShort(appointment.priceCents)} />
          <KeyRow
            label="Sinal"
            valueMono={appointment.depositCents > 0}
            value={
              appointment.depositCents > 0 ? moneyShort(appointment.depositCents) : "não exigido"
            }
            valueColor={appointment.depositCents > 0 ? color.green : color.muted}
          />
          <KeyRow
            label="Telefone"
            valueMono
            value={appointment.phone ?? "não informado"}
            valueColor={appointment.phone ? color.ink : color.muted}
          />
          <KeyRow
            label="Pedido feito"
            valueMono
            value={new Date(appointment.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
            valueColor={color.muted}
          />
          {appointment.notes ? (
            <KeyRow label="Observação" value={appointment.notes} valueColor={color.muted} />
          ) : null}
          {appointment.cancellationReason ? (
            <KeyRow
              label="Motivo"
              value={appointment.cancellationReason}
              valueColor={color.danger}
              last
            />
          ) : null}
        </View>

        {open ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 9 }}>
            {appointment.status === "scheduled" ? (
              <PrimaryButton
                label="Aprovar agendamento"
                height={54}
                disabled={busy}
                onPress={() =>
                  run(
                    () => approveAppointment(appointment.id),
                    `${appointment.name} está confirmado.`,
                  )
                }
              />
            ) : null}

            <View style={{ flexDirection: "row", gap: 9 }}>
              <OutlineButton
                label="Remarcar"
                height={50}
                style={{ flex: 1 }}
                onPress={() => setRescheduleOpen(true)}
              />
              <OutlineButton
                label="Concluir"
                height={50}
                style={{ flex: 1 }}
                onPress={() =>
                  run(
                    () => completeAppointment(appointment.id),
                    `Atendimento de ${appointment.name} concluído.`,
                  )
                }
              />
            </View>

            <View style={{ flexDirection: "row", gap: 9 }}>
              <OutlineButton
                label="Não compareceu"
                height={50}
                tint={color.amber}
                style={{ flex: 1 }}
                onPress={() =>
                  run(() => markNoShow(appointment.id), `${appointment.name} marcado como falta.`)
                }
              />
              <OutlineButton
                label="Recusar"
                height={50}
                tint={color.danger}
                style={{ flex: 1 }}
                onPress={() => setRefuseOpen(true)}
              />
            </View>

            <Text
              style={[
                sans(11.5, 400, { lh: 1.45, color: color.faint }),
                { textAlign: "center", paddingHorizontal: 10, paddingTop: 4 },
              ]}
            >
              {appointment.hasAccount
                ? "O cliente vê a mudança no app dele."
                : "Este cliente não tem conta: avise por telefone, o app não alcança ele."}
            </Text>
          </View>
        ) : (
          <View style={{ paddingTop: 16 }}>
            <Caveat>
              Este agendamento está encerrado. Concluído, recusado, cancelado ou marcado como falta
              não volta atrás — se foi engano, crie um novo.
            </Caveat>
          </View>
        )}
      </ScreenScroll>

      <Sheet
        visible={refuseOpen}
        onClose={() => setRefuseOpen(false)}
        title="Por que está recusando?"
        subtitle="O motivo vai junto com o aviso. Recusar em silêncio é o que faz a pessoa não voltar."
      >
        <View style={{ gap: 8 }}>
          {REASONS.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => {
                setRefuseOpen(false);
                void run(
                  () => refuseAppointment(appointment.id, reason),
                  `Recusado. ${appointment.name} foi avisado.`,
                );
              }}
              style={{
                paddingVertical: 15,
                paddingHorizontal: 15,
                borderRadius: 12,
                backgroundColor: color.rest,
              }}
            >
              <Text style={sans(14.5, 600)}>{reason}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="Remarcar"
        subtitle={`${appointment.serviceName} com ${appointment.professionalName}. Só aparecem horários que estão realmente livres.`}
      >
        <View style={{ gap: 14 }}>
          <SlotPicker
            establishmentId={establishment?.id ?? null}
            serviceId={appointment.serviceId}
            professionalId={appointment.professionalId}
            selected={slot}
            onSelect={(picked) => setSlot(picked.startsAt)}
          />
          <PrimaryButton
            label="Mover para este horário"
            height={54}
            disabled={!slot || busy}
            onPress={() => {
              if (!slot) return;
              setRescheduleOpen(false);
              void run(
                () => rescheduleAppointment(appointment.id, slot, appointment.serviceMinutes),
                `${appointment.name} remarcado.`,
              );
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function ContactButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 11,
        borderRadius: 11,
        backgroundColor: color.rest,
        alignItems: "center",
      }}
    >
      <Text style={sans(13, 600)}>{label}</Text>
    </Pressable>
  );
}
