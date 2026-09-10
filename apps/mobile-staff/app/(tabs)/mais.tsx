import { mono } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import { Banknote, Bell, CreditCard, LifeBuoy, ListOrdered, Rocket } from "lucide-react-native";
import { Text, View } from "react-native";

import { useProfessionals, useServices } from "../../src/data/catalog";
import { useEstablishment } from "../../src/data/establishment";
import { setupSteps } from "../../src/data/onboarding";
import { useBusinessHours, useProfessionalSchedules } from "../../src/data/schedule";
import { color } from "../../src/theme/tokens";
import { HubRow } from "../../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../../src/ui/Screen";
import { useToast } from "../../src/ui/Toast";

/** Tudo que não é o dia nem o cadastro da loja: dinheiro, conta e ajuda. */
export default function Mais() {
  const router = useRouter();
  const toast = useToast();
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
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <Screen>
      <PlainHeader title="Mais" canGoBack={false} />

      <ScreenScroll>
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <HubRow
            icon={<Banknote size={19} color={color.ink} strokeWidth={1.8} />}
            label="Financeiro"
            sub="Faturamento, ticket médio e o que mais sai"
            onPress={() => router.push("/financeiro")}
          />
          <HubRow
            icon={<CreditCard size={19} color={color.ink} strokeWidth={1.8} />}
            label="Assinatura e plano"
            sub="Quanto a plataforma cobra de você"
            tag={{ label: "a definir", tint: color.muted, background: color.rest }}
            onPress={() => router.push("/assinatura")}
          />
          <HubRow
            icon={<Bell size={19} color={color.ink} strokeWidth={1.8} />}
            label="Notificações e ajustes"
            sub="Avisos que você recebe, conta e sessão"
            onPress={() => router.push("/ajustes")}
          />
          <HubRow
            icon={<ListOrdered size={19} color={color.ink} strokeWidth={1.8} />}
            label="Configurações da fila"
            sub="Como sua fila funciona"
            onPress={() => router.push("/fila-config")}
          />
          <HubRow
            icon={<Rocket size={19} color={color.ink} strokeWidth={1.8} />}
            label="Começar do zero"
            sub="Os passos para a loja receber cliente"
            tag={
              steps.length > 0
                ? {
                    label: `${doneCount}/${steps.length}`,
                    tint: doneCount === steps.length ? color.green : color.coral,
                    background: doneCount === steps.length ? color.greenTint : color.coralTint,
                  }
                : undefined
            }
            onPress={() => router.push("/comecar")}
          />
          <HubRow
            icon={<LifeBuoy size={19} color={color.ink} strokeWidth={1.8} />}
            label="Ajuda e suporte"
            sub="Falar com a gente"
            onPress={() =>
              toast("Canal de suporte ainda não existe. Por enquanto, fale com quem te cadastrou.")
            }
            last
          />
        </View>

        <Text
          style={[
            mono(11, 500, { color: color.hint }),
            { textAlign: "center", paddingVertical: 22 },
          ]}
        >
          VEZ PARA ESTABELECIMENTOS · 0.1.0
        </Text>
      </ScreenScroll>
    </Screen>
  );
}
