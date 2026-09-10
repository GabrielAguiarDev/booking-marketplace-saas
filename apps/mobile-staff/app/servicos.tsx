import { moneyShort } from "@vez/mobile-kit/format";
import { mono, sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useProfessionals, useServices } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishment";
import { color } from "../src/theme/tokens";
import { Card, EmptyState, ErrorNote, Tag } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";

/**
 * Serviços.
 *
 * A lista mostra quem executa cada um porque é o par serviço + profissional que
 * gera horário: um serviço sem ninguém marcado não aparece para o cliente,
 * mesmo estando ativo. Esse é o erro de configuração mais comum e mais mudo do
 * produto, e ele fica visível aqui em vez de virar "por que ninguém agenda".
 */
export default function Servicos() {
  const router = useRouter();
  const { establishment, isManager } = useEstablishment();

  const id = establishment?.id ?? null;
  const services = useServices(id);
  const professionals = useProfessionals(id);

  const nameOf = new Map(
    (professionals.data ?? []).map((professional) => [professional.id, professional.displayName]),
  );

  return (
    <Screen>
      <PlainHeader
        title="Serviços"
        action={isManager ? "+ Serviço" : undefined}
        onAction={() => router.push("/servico/novo")}
      />

      <ScreenScroll bottom={40}>
        {services.error ? <ErrorNote message={services.error} onRetry={services.reload} /> : null}

        {services.data && services.data.length === 0 ? (
          <EmptyState
            title="Nenhum serviço ainda"
            body="Um nome, um preço, uma duração. É a duração que fatia a agenda — sem serviço não existe horário para vender."
            action={isManager ? "Cadastrar o primeiro" : undefined}
            onAction={() => router.push("/servico/novo")}
          />
        ) : null}

        <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 10 }}>
          {(services.data ?? []).map((service) => (
            <Pressable
              key={service.id}
              onPress={() => isManager && router.push(`/servico/${service.id}`)}
            >
              <Card radius={14} padding={14}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1, gap: 7 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <Text
                        style={sans(15.5, 700, {
                          color: service.isActive ? color.ink : color.faint,
                        })}
                      >
                        {service.name}
                      </Text>
                      {service.isActive ? null : <Tag label="fora do ar" />}
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {service.professionalIds.length === 0 ? (
                        <Tag
                          label="ninguém executa"
                          tint={color.danger}
                          background={color.dangerTint}
                        />
                      ) : (
                        service.professionalIds.map((professionalId) => (
                          <Tag key={professionalId} label={nameOf.get(professionalId) ?? "—"} />
                        ))
                      )}
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Text style={mono(16, 600)}>{moneyShort(service.priceCents)}</Text>
                    <Text style={mono(11.5, 500, { color: color.muted })}>
                      {service.durationMinutes} min
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}

          {isManager && services.data && services.data.length > 0 ? (
            <Pressable
              onPress={() => router.push("/servico/novo")}
              style={{
                paddingVertical: 15,
                borderRadius: 14,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: color.track,
                alignItems: "center",
              }}
            >
              <Text style={sans(14, 700, { color: color.coral })}>+ Novo serviço</Text>
            </Pressable>
          ) : null}
        </View>

        {(services.data ?? []).some((service) => service.professionalIds.length === 0) ? (
          <Text
            style={[
              sans(12.5, 400, { lh: 1.5, color: color.muted }),
              { paddingHorizontal: 20, paddingTop: 18 },
            ]}
          >
            Serviço sem ninguém marcado não aparece para o cliente, mesmo ativo. A vaga nasce do
            encontro entre o serviço e a escala de quem faz.
          </Text>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}
