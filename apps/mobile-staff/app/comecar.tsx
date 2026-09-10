import { sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { useProfessionals, useServices } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishment";
import { setupSteps } from "../src/data/onboarding";
import { useBusinessHours, useProfessionalSchedules } from "../src/data/schedule";
import { color } from "../src/theme/tokens";
import { Card, Caveat, SectionLabel } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";

/**
 * Começar do zero.
 *
 * Nenhum passo aqui é uma coluna de progresso: cada um é uma pergunta feita ao
 * estado real da loja. Guardar "já fez o passo 1" permitiria a coluna dizer sim
 * com a loja sem serviço nenhum — e o dono ficaria olhando para um check verde
 * sem entender por que ninguém agenda.
 */
export default function Comecar() {
  const router = useRouter();
  const { establishment } = useEstablishment();

  const id = establishment?.id ?? null;
  const services = useServices(id);
  const professionals = useProfessionals(id);
  const hours = useBusinessHours(id);
  const schedules = useProfessionalSchedules(id);

  const steps =
    establishment && services.data && professionals.data && hours.data && schedules.data
      ? setupSteps({
          establishment,
          services: services.data,
          professionals: professionals.data,
          hours: hours.data,
          schedules: schedules.data,
        })
      : [];
  const done = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done) ?? null;

  return (
    <Screen>
      <PlainHeader title="Começar" />

      <ScreenScroll bottom={40}>
        <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 8 }}>
          <Text style={sans(24, 800, { lh: 1.2, ls: -0.6 / 24 })}>
            {done === steps.length && steps.length > 0
              ? `${establishment?.name ?? "Sua loja"} está pronta para receber cliente.`
              : `Vamos deixar ${establishment?.name ?? "sua loja"} pronta para receber cliente.`}
          </Text>
          <Text style={sans(14, 400, { lh: 1.55, color: color.muted })}>
            Três passos. Dá para fazer entre um corte e outro.
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
            <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
              {steps.map((step) => (
                <View
                  key={step.key}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: step.done ? color.coral : color.coralBorder,
                  }}
                />
              ))}
            </View>
            <Text
              style={{ fontFamily: "IBMPlexMono_600SemiBold", fontSize: 12, color: color.muted }}
            >
              {done}/{steps.length || 3}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 11 }}>
          {steps.map((step) => {
            const open = step === next;
            return (
              <Pressable key={step.key} onPress={() => router.push(step.route as never)}>
                <Card
                  radius={16}
                  padding={15}
                  borderColor={open ? color.coralBorder : color.line}
                  background={open ? color.coralPale : color.bg}
                >
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        backgroundColor: step.done ? color.greenTint : color.coral,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {step.done ? (
                        <Check size={14} color={color.green} strokeWidth={3} />
                      ) : (
                        <Text
                          style={{
                            fontFamily: "IBMPlexMono_600SemiBold",
                            fontSize: 12,
                            color: "#fff",
                          }}
                        >
                          {steps.indexOf(step) + 1}
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={sans(15.5, 700)}>{step.title}</Text>
                      <Text style={sans(13, 400, { lh: 1.5, color: color.muted })}>
                        {step.body}
                      </Text>
                      {open ? (
                        <View
                          style={{
                            alignSelf: "flex-start",
                            marginTop: 11,
                            paddingVertical: 11,
                            paddingHorizontal: 16,
                            borderRadius: 999,
                            backgroundColor: color.coral,
                          }}
                        >
                          <Text style={sans(13, 700, { color: "#fff" })}>{step.cta}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 26, gap: 10 }}>
          <SectionLabel>Enquanto isso</SectionLabel>
          <Card radius={16} padding={16} background={color.rest} borderColor={color.rest}>
            <Text style={sans(13, 700)}>
              {establishment?.status === "active"
                ? "Sua loja já aparece nas buscas do app do cliente."
                : "Ninguém consegue agendar ainda."}
            </Text>
            <Text style={[sans(12.5, 400, { lh: 1.45, color: color.muted }), { marginTop: 4 }]}>
              {establishment?.status === "active"
                ? "Cada passo acima que faltar tira horários da sua grade — sem escala, por exemplo, a agenda nasce vazia."
                : "A loja está como pendente. Publicar depende de aprovação da plataforma, e essa etapa ainda não existe em nenhuma superfície."}
            </Text>
          </Card>
        </View>

        <View style={{ paddingTop: 18 }}>
          <Caveat>
            Os passos 1 e 2 dependem de cadastro que ainda não tem tela aqui — serviço já dá para
            criar, mas profissional e escala ainda são trabalho do portal web da loja. Este roteiro
            existe para você saber o que falta, mesmo quando a ferramenta ainda não é esta.
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}
