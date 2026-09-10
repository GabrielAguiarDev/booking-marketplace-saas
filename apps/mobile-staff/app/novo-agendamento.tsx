import { moneyShort } from "@vez/mobile-kit/format";
import { sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { createAppointment } from "../src/data/appointments";
import { useProfessionals, useServices } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishment";
import { color } from "../src/theme/tokens";
import { Field } from "../src/ui/Field";
import { Caveat, Pill, PrimaryButton } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";
import { SlotPicker } from "../src/ui/SlotPicker";
import { useToast } from "../src/ui/Toast";

/**
 * Agendamento para quem ligou ou chegou sem o app.
 *
 * Quatro passos numa tela só, e não num assistente de quatro telas: o telefone
 * está no ouvido de quem está preenchendo, e voltar um passo para conferir o
 * nome não pode custar uma navegação.
 *
 * O cliente aqui é um nome escrito à mão — `guest_name`. Não vira conta e não
 * recebe aviso; a tela diz isso antes de salvar, porque o atendente precisa
 * saber que a confirmação vai ter que sair da boca dele.
 */
export default function NovoAgendamento() {
  const router = useRouter();
  const toast = useToast();
  const { establishment } = useEstablishment();

  const id = establishment?.id ?? null;
  const services = useServices(id, false);
  const professionals = useProfessionals(id);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ startsAt: string; professionalId: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const service = (services.data ?? []).find((item) => item.id === serviceId) ?? null;
  const eligible = (professionals.data ?? []).filter(
    (professional) =>
      professional.isActive && (!serviceId || professional.serviceIds.includes(serviceId)),
  );

  const ready = Boolean(name.trim() && service && slot && establishment);

  async function submit() {
    if (!establishment || !service || !slot) return;

    setBusy(true);
    const result = await createAppointment({
      establishmentId: establishment.id,
      // O profissional é o que a função de disponibilidade devolveu junto com o
      // horário: pedir "qualquer um" e depois escolher no cliente reabriria a
      // corrida que a RPC acabou de fechar.
      professionalId: slot.professionalId,
      serviceId: service.id,
      startsAt: slot.startsAt,
      minutes: service.durationMinutes,
      priceCents: service.priceCents,
      name: name.trim(),
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    });
    setBusy(false);

    if (!result.ok) {
      toast(result.message ?? "Não deu certo.", "bad");
      return;
    }
    toast(`${name.trim()} agendado.`);
    router.back();
  }

  return (
    <Screen>
      <PlainHeader title="Novo agendamento" />

      <ScreenScroll bottom={40}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 22 }}>
          <Text style={sans(13.5, 400, { lh: 1.5, color: color.muted })}>
            Para quem ligou ou chegou sem usar o app. O horário sai da mesma agenda que o cliente vê
            — não dá para vender duas vezes o mesmo.
          </Text>

          <Step number={1} label="Cliente">
            <View style={{ gap: 10 }}>
              <Field placeholder="Nome" value={name} onChangeText={setName} returnKeyType="next" />
              <Field
                placeholder="Telefone (opcional)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                mono
              />
            </View>
          </Step>

          <Step number={2} label="Serviço">
            {(services.data ?? []).length === 0 ? (
              <Text style={sans(13, 400, { lh: 1.5, color: color.muted })}>
                Nenhum serviço ativo. Cadastre um serviço antes: é a duração dele que define o
                horário.
              </Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {(services.data ?? []).map((item) => (
                  <Pill
                    key={item.id}
                    label={`${item.name} · ${moneyShort(item.priceCents)}`}
                    active={serviceId === item.id}
                    onPress={() => {
                      setServiceId(item.id);
                      setSlot(null);
                    }}
                  />
                ))}
              </View>
            )}
          </Step>

          <Step number={3} label="Profissional">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              <Pill
                label="Qualquer um"
                active={professionalId === null}
                onPress={() => {
                  setProfessionalId(null);
                  setSlot(null);
                }}
              />
              {eligible.map((professional) => (
                <Pill
                  key={professional.id}
                  label={professional.displayName}
                  active={professionalId === professional.id}
                  onPress={() => {
                    setProfessionalId(professional.id);
                    setSlot(null);
                  }}
                />
              ))}
            </View>
          </Step>

          <Step number={4} label="Quando">
            <SlotPicker
              establishmentId={id}
              serviceId={serviceId}
              professionalId={professionalId}
              selected={slot?.startsAt ?? null}
              onSelect={setSlot}
            />
          </Step>

          <Field
            label="Observação (opcional)"
            placeholder="Ex.: chega 10 minutos antes"
            value={notes}
            onChangeText={setNotes}
          />

          <PrimaryButton
            label={busy ? "Criando…" : "Criar agendamento"}
            height={56}
            disabled={!ready || busy}
            onPress={submit}
          />

          <Caveat>
            Agendamento criado aqui nasce confirmado e sem sinal. Como o cliente não tem conta, ele
            não recebe lembrete nem confirmação pelo app — quem avisa é você.
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}

function Step({
  number,
  label,
  children,
}: {
  number: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 9 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            backgroundColor: color.ink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "IBMPlexMono_600SemiBold", fontSize: 10, color: "#fff" }}>
            {number}
          </Text>
        </View>
        <Text style={sans(13, 700)}>{label}</Text>
      </View>
      {children}
    </View>
  );
}
