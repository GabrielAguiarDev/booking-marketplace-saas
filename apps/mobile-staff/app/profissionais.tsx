import { moneyShort } from "@vez/mobile-kit/format";
import { mono, sans } from "@vez/mobile-kit/theme";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { useAppointments } from "../src/data/appointments";
import { useProfessionals, useServices, useTeam } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishment";
import { useProfessionalSchedules } from "../src/data/schedule";
import { clockFromTime } from "../src/format";
import { color } from "../src/theme/tokens";
import { Card, Caveat, EmptyState, Initials, Tag } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";

const ACCESS = {
  owner: { label: "acesso total", tint: color.greenDeep, background: color.greenTint },
  manager: { label: "acesso total", tint: color.greenDeep, background: color.greenTint },
  staff: { label: "só a própria agenda", tint: color.amberDeep, background: color.amberTint },
} as const;

/**
 * Profissionais.
 *
 * Duas coisas diferentes aparecem juntas aqui de propósito: quem atende
 * (`professionals`) e quem tem login (`establishment_members`). Elas não
 * coincidem — existe barbeiro na vitrine que nunca abriu o app, e existe
 * recepcionista com acesso e sem cadeira. Mostrar as duas na mesma linha é o
 * que deixa visível quem consegue entrar e o que essa pessoa consegue ver.
 */
export default function Profissionais() {
  const { establishment } = useEstablishment();

  const id = establishment?.id ?? null;
  const professionals = useProfessionals(id);
  const services = useServices(id);
  const team = useTeam(id);
  const schedules = useProfessionalSchedules(id);

  const bounds = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);
  const today = useAppointments(id, bounds.from, bounds.to);

  const serviceName = new Map((services.data ?? []).map((service) => [service.id, service.name]));
  const roleOf = new Map((team.data ?? []).map((member) => [member.userId, member.role]));

  return (
    <Screen>
      <PlainHeader title="Profissionais" />

      <ScreenScroll bottom={40}>
        {professionals.data && professionals.data.length === 0 ? (
          <EmptyState
            title="Ninguém cadastrado"
            body="Cadastro de profissional ainda não existe no app. Por enquanto ele é feito no portal web da loja — que também está por vir."
          />
        ) : null}

        <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 10 }}>
          {(professionals.data ?? []).map((professional) => {
            const role = professional.userId ? roleOf.get(professional.userId) : undefined;
            const access = role ? ACCESS[role] : null;

            const mine = (today.data ?? []).filter(
              (item) => item.professionalId === professional.id && item.status === "completed",
            );
            const revenue = mine.reduce((sum, item) => sum + item.priceCents, 0);

            const days = (schedules.data ?? []).filter(
              (schedule) => schedule.professionalId === professional.id,
            );
            const range =
              days.length === 0
                ? "sem escala"
                : `${clockFromTime(days.reduce((min, d) => (d.startsAt < min ? d.startsAt : min), days[0]!.startsAt))}–${clockFromTime(days.reduce((max, d) => (d.endsAt > max ? d.endsAt : max), days[0]!.endsAt))}`;

            return (
              <Card key={professional.id} radius={14} padding={14}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Initials name={professional.displayName} size={46} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={sans(15.5, 700, {
                        color: professional.isActive ? color.ink : color.faint,
                      })}
                    >
                      {professional.displayName}
                    </Text>
                    <Text style={sans(12.5, 400, { color: color.muted })}>
                      {professional.title ?? "Profissional"} · {range}
                    </Text>
                  </View>
                  {access ? (
                    <Tag label={access.label} tint={access.tint} background={access.background} />
                  ) : (
                    <Tag label="sem login" />
                  )}
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
                  {professional.serviceIds.length === 0 ? (
                    <Tag
                      label="não executa nenhum serviço"
                      tint={color.danger}
                      background={color.dangerTint}
                    />
                  ) : (
                    professional.serviceIds.map((serviceId) => (
                      <Tag key={serviceId} label={serviceName.get(serviceId) ?? "—"} />
                    ))
                  )}
                </View>

                <View
                  style={{
                    marginTop: 11,
                    paddingTop: 11,
                    borderTopWidth: 1,
                    borderTopColor: color.lineSoft,
                  }}
                >
                  <Text style={mono(11.5, 500, { color: color.muted })}>
                    HOJE: {mine.length} {mine.length === 1 ? "ATENDIMENTO" : "ATENDIMENTOS"}
                    {revenue > 0 ? ` · ${moneyShort(revenue).toUpperCase()}` : ""}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>

        <View style={{ paddingTop: 20, gap: 12 }}>
          <Caveat>
            Acesso de equipe vê só a agenda dele e conclui os atendimentos dele. Não vê financeiro
            nem muda cadastro da loja. Quem dá e tira acesso é o dono, e isso ainda não tem tela em
            nenhuma superfície — hoje sai por SQL.
          </Caveat>
          <Caveat>
            Cadastrar profissional, editar escala e ligar serviços a pessoas também não têm tela
            aqui. Esta é uma tela de leitura: o cadastro é trabalho do portal web da loja.
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}
