import { moneyShort } from "@vez/mobile-kit/format";
import { mono, sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import { CalendarClock, Scissors, SlidersHorizontal, Store, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { useProfessionals, useServices } from "../../src/data/catalog";
import { useEstablishment } from "../../src/data/establishment";
import { setupSteps } from "../../src/data/onboarding";
import { useBusinessHours, useProfessionalSchedules } from "../../src/data/schedule";
import { color } from "../../src/theme/tokens";
import { HubRow } from "../../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../../src/ui/Screen";

/** O hub de tudo que é cadastro da loja. Cinco portas, nenhuma decisão aqui. */
export default function Loja() {
  const router = useRouter();
  const { establishment, settings, isManager } = useEstablishment();

  const id = establishment?.id ?? null;
  const services = useServices(id);
  const professionals = useProfessionals(id);
  const hours = useBusinessHours(id);
  const schedules = useProfessionalSchedules(id);

  const activeServices = (services.data ?? []).filter((service) => service.isActive);
  const activeProfessionals = (professionals.data ?? []).filter(
    (professional) => professional.isActive,
  );

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

  const priceRange =
    activeServices.length === 0
      ? "nenhum ativo"
      : `${activeServices.length} ${activeServices.length === 1 ? "ativo" : "ativos"} · de ${moneyShort(Math.min(...activeServices.map((s) => s.priceCents)))} a ${moneyShort(Math.max(...activeServices.map((s) => s.priceCents)))}`;

  return (
    <Screen>
      <PlainHeader title="Sua loja" canGoBack={false} />

      <ScreenScroll>
        {steps.length > 0 && doneCount < steps.length ? (
          <Pressable
            onPress={() => router.push("/comecar")}
            style={{
              marginHorizontal: 20,
              marginTop: 16,
              marginBottom: 4,
              padding: 16,
              borderRadius: 16,
              backgroundColor: color.coralSoft,
              borderWidth: 1,
              borderColor: color.coralBorder,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={sans(14.5, 700)}>Termine de configurar a loja</Text>
              <Text style={mono(12, 600, { color: color.coral })}>
                {doneCount}/{steps.length}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 4, marginTop: 11 }}>
              {steps.map((step) => (
                <View
                  key={step.key}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 999,
                    backgroundColor: step.done ? color.coral : color.coralBorder,
                  }}
                />
              ))}
            </View>
            <Text style={[sans(12.5, 400, { lh: 1.4, color: color.coralDeep }), { marginTop: 9 }]}>
              {steps.find((step) => !step.done)?.body ?? ""}
            </Text>
          </Pressable>
        ) : null}

        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <HubRow
            icon={<Scissors size={19} color={color.ink} strokeWidth={1.8} />}
            label="Serviços"
            sub={priceRange}
            onPress={() => router.push("/servicos")}
          />
          <HubRow
            icon={<Users size={19} color={color.ink} strokeWidth={1.8} />}
            label="Profissionais"
            sub={
              activeProfessionals.length === 0
                ? "ninguém cadastrado"
                : activeProfessionals.map((professional) => professional.displayName).join(", ")
            }
            onPress={() => router.push("/profissionais")}
          />
          <HubRow
            icon={<CalendarClock size={19} color={color.ink} strokeWidth={1.8} />}
            label="Horários e escalas"
            sub={
              (hours.data ?? []).length === 0
                ? "sem funcionamento cadastrado"
                : `${new Set((hours.data ?? []).map((hour) => hour.weekday)).size} dias abertos · escalas e folgas`
            }
            onPress={() => router.push("/horarios")}
          />
          <HubRow
            icon={<SlidersHorizontal size={19} color={color.ink} strokeWidth={1.8} />}
            label="Regras de agendamento"
            sub={`${settings?.auto_approve ? "Aprovação automática" : "Aprovação manual"} · ${establishment && establishment.deposit_percent > 0 ? `sinal de ${establishment.deposit_percent}%` : "sem sinal"}`}
            onPress={() => router.push("/regras")}
          />
          <HubRow
            icon={<Store size={19} color={color.ink} strokeWidth={1.8} />}
            label="Perfil público"
            sub="Como o cliente vê a loja dentro do app"
            onPress={() => router.push("/perfil-publico")}
            last
          />
        </View>

        {!isManager ? (
          <Text
            style={[
              sans(12.5, 400, { lh: 1.5, color: color.muted }),
              { paddingHorizontal: 20, paddingTop: 18 },
            ]}
          >
            Seu acesso é de equipe: você vê estes cadastros, mas quem altera é o dono ou a gerência.
          </Text>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}
