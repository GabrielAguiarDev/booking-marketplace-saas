import { sans } from "@vez/mobile-kit/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import {
  saveService,
  setServiceActive,
  useProfessionals,
  useServices,
} from "../../src/data/catalog";
import { useEstablishment } from "../../src/data/establishment";
import { color } from "../../src/theme/tokens";
import { Field } from "../../src/ui/Field";
import {
  Caveat,
  OutlineButton,
  Pill,
  PrimaryButton,
  SectionLabel,
  Toggle,
} from "../../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../../src/ui/Screen";
import { useToast } from "../../src/ui/Toast";

const DURATIONS = [15, 20, 30, 40, 45, 60, 80, 90];

/**
 * Criar ou editar serviço.
 *
 * Duração e preço estão na mesma tela e não em passos separados porque as duas
 * respondem juntas à mesma pergunta comercial. E a duração é destacada com
 * atalhos porque ela não é um detalhe do cadastro: é o que decide de quantos em
 * quantos minutos a agenda pode ser vendida.
 */
export default function ServicoEditor() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { establishment } = useEstablishment();

  const isNew = id === "novo";
  const services = useServices(establishment?.id ?? null);
  const professionals = useProfessionals(establishment?.id ?? null);
  const existing = (services.data ?? []).find((service) => service.id === id) ?? null;

  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    minutes: string;
    price: string;
    isActive: boolean;
    professionalIds: string[];
  } | null>(null);

  // O rascunho nasce do que veio do banco, uma vez só. Sem isto, cada recarga
  // da consulta apagaria o que a pessoa está digitando.
  const form =
    draft ??
    (isNew
      ? {
          name: "",
          description: "",
          minutes: "30",
          price: "",
          isActive: true,
          professionalIds: [] as string[],
        }
      : existing
        ? {
            name: existing.name,
            description: existing.description ?? "",
            minutes: String(existing.durationMinutes),
            price: (existing.priceCents / 100).toFixed(2).replace(".", ","),
            isActive: existing.isActive,
            professionalIds: existing.professionalIds,
          }
        : null);

  if (!form) {
    return (
      <Screen>
        <PlainHeader title={isNew ? "Novo serviço" : "Serviço"} />
      </Screen>
    );
  }

  function update(patch: Partial<NonNullable<typeof form>>) {
    setDraft({ ...form!, ...patch });
  }

  const priceCents = Math.round(Number(form.price.replace(/\./g, "").replace(",", ".")) * 100);
  const minutes = Number(form.minutes);
  const valid =
    form.name.trim().length > 1 &&
    Number.isFinite(priceCents) &&
    priceCents >= 0 &&
    Number.isFinite(minutes) &&
    minutes >= 5 &&
    minutes <= 480;

  async function submit() {
    if (!establishment || !valid) return;

    const result = await saveService({
      id: isNew ? null : (id ?? null),
      establishmentId: establishment.id,
      name: form!.name.trim(),
      description: form!.description.trim() || null,
      durationMinutes: minutes,
      priceCents,
      isActive: form!.isActive,
      professionalIds: form!.professionalIds,
    });

    if (!result.ok) {
      toast(result.message ?? "Não deu certo.", "bad");
      return;
    }
    toast(isNew ? "Serviço criado." : "Serviço salvo.");
    router.back();
  }

  return (
    <Screen>
      <PlainHeader title={isNew ? "Novo serviço" : "Editar serviço"} />

      <ScreenScroll bottom={40}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 20 }}>
          <Field
            label="Nome"
            placeholder="Ex.: Corte + barba"
            value={form.name}
            onChangeText={(next) => update({ name: next })}
          />

          <Field
            label="Descrição (opcional)"
            placeholder="O que está incluído"
            value={form.description}
            onChangeText={(next) => update({ description: next })}
          />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Preço"
                placeholder="0,00"
                value={form.price}
                onChangeText={(next) => update({ price: next })}
                keyboardType="decimal-pad"
                mono
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Duração (min)"
                placeholder="30"
                value={form.minutes}
                onChangeText={(next) => update({ minutes: next.replace(/\D/g, "") })}
                keyboardType="number-pad"
                mono
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -8 }}>
            {DURATIONS.map((value) => (
              <Pill
                key={value}
                size="sm"
                label={`${value} min`}
                active={form.minutes === String(value)}
                onPress={() => update({ minutes: String(value) })}
              />
            ))}
          </View>

          <View style={{ gap: 9 }}>
            <SectionLabel tint={color.muted}>Quem executa</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {(professionals.data ?? [])
                .filter((professional) => professional.isActive)
                .map((professional) => {
                  const on = form.professionalIds.includes(professional.id);
                  return (
                    <Pill
                      key={professional.id}
                      label={professional.displayName}
                      active={on}
                      onPress={() =>
                        update({
                          professionalIds: on
                            ? form.professionalIds.filter((value) => value !== professional.id)
                            : [...form.professionalIds, professional.id],
                        })
                      }
                    />
                  );
                })}
            </View>
            {form.professionalIds.length === 0 ? (
              <Text style={sans(12.5, 400, { lh: 1.45, color: color.amberDeep })}>
                Sem ninguém marcado, este serviço não gera horário nenhum para o cliente.
              </Text>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 4,
            }}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={sans(14.5, 600)}>Serviço ativo</Text>
              <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>
                Desligado, ele some da vitrine e da agenda — mas continua nas reservas antigas, com
                o nome certo.
              </Text>
            </View>
            <Toggle value={form.isActive} onChange={(next) => update({ isActive: next })} />
          </View>

          <PrimaryButton
            label={isNew ? "Criar serviço" : "Salvar"}
            height={56}
            disabled={!valid}
            onPress={submit}
          />

          {!isNew && existing?.isActive ? (
            <OutlineButton
              label="Tirar do ar"
              height={50}
              tint={color.danger}
              onPress={async () => {
                const result = await setServiceActive(existing.id, false);
                toast(
                  result.ok ? "Serviço fora do ar." : "Não deu certo.",
                  result.ok ? "ok" : "bad",
                );
                if (result.ok) router.back();
              }}
            />
          ) : null}

          <Caveat>
            Mudar a duração muda a grade de horários daqui para a frente. Quem já marcou continua
            com o horário e o preço que combinou — o preço da reserva é congelado no ato.
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}
