import { sans } from "@vez/mobile-kit/theme";
import { Text, View } from "react-native";

import { useProfessionals } from "../src/data/catalog";
import { useEstablishment } from "../src/data/establishment";
import { usePlanCatalog } from "../src/data/plan";
import {
  percentLabel,
  PLAN_KIND_LABEL,
  planLines,
  professionalsOverLimit,
} from "../src/data/plan-rules";
import { color } from "../src/theme/tokens";
import { Card, EmptyState, ErrorNote, SectionLabel, Tag } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";

const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

/**
 * Assinatura e plano.
 *
 * Lê o plano de verdade: `establishments.plan_id`, definido pela equipe da Vez
 * na aprovação, e o catálogo ativo de `plans`. É a mesma leitura da seção
 * Plano do portal, e pelo mesmo motivo é só leitura — o gatilho
 * `guard_establishment_status` recusa troca de plano ou desconto que não venha
 * de admin da plataforma.
 *
 * Fatura, cartão e histórico de cobrança continuam fora: `payments` não tem
 * linha porque o provedor de pagamento não foi escolhido, e inventar número
 * aqui seria a pior mentira do produto (R7).
 */
export default function Assinatura() {
  const { establishment, role } = useEstablishment();
  const catalog = usePlanCatalog();
  const professionals = useProfessionals(establishment?.id ?? null);

  if (!establishment) {
    return (
      <Screen>
        <PlainHeader title="Assinatura e plano" />
      </Screen>
    );
  }

  if (role !== "owner") {
    return (
      <Screen>
        <PlainHeader title="Assinatura e plano" />
        <EmptyState
          title="Só o dono vê o plano"
          body="Plano e cobrança da loja são assunto de quem responde por ela. Peça ao dono, ou fale com o suporte da Vez."
        />
      </Screen>
    );
  }

  const plans = catalog.data ?? [];
  const plan = plans.find((item) => item.id === establishment.plan_id) ?? null;
  const active = (professionals.data ?? []).filter((item) => item.isActive).length;
  const discount = establishment.discount_percent ?? 0;

  return (
    <Screen>
      <PlainHeader title="Assinatura e plano" />

      <ScreenScroll bottom={40}>
        {catalog.error ? <ErrorNote message={catalog.error} onRetry={catalog.reload} /> : null}

        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 16 }}>
          <Card radius={16} padding={16}>
            <Text style={sans(12, 600, { color: color.muted })}>PLANO ATUAL</Text>
            <Text style={[sans(20, 800, { ls: -0.3 / 20 }), { marginTop: 6 }]}>
              {catalog.loading ? "…" : plan ? plan.name : "Sem plano definido"}
            </Text>
            <Text style={[sans(13, 400, { lh: 1.5, color: color.muted }), { marginTop: 4 }]}>
              {plan
                ? `${PLAN_KIND_LABEL[plan.kind]}${
                    plan.kind === "commission"
                      ? ` · ${percentLabel(plan.commissionPercent)} por atendimento concluído`
                      : " · valor combinado com a Vez"
                  }`
                : catalog.loading
                  ? ""
                  : "O plano é escolhido pela equipe da Vez na aprovação da loja."}
            </Text>
            {establishment.plan_changed_at ? (
              <Text style={[sans(12, 400, { color: color.faint }), { marginTop: 8 }]}>
                Desde {longDate.format(new Date(establishment.plan_changed_at))}
              </Text>
            ) : null}
            {discount > 0 ? (
              <View style={{ flexDirection: "row", marginTop: 10 }}>
                <Tag
                  label={`${discount}% de desconto${
                    establishment.discount_until
                      ? ` até ${longDate.format(new Date(`${establishment.discount_until}T12:00:00`))}`
                      : ""
                  }`}
                  tint={color.greenDeep}
                  background={color.greenTint}
                />
              </View>
            ) : null}
          </Card>

          {plan ? (
            <View style={{ gap: 10 }}>
              <SectionLabel>O que o seu plano inclui</SectionLabel>
              <Card radius={14} padding={14}>
                {planLines(plan).map((line) => (
                  <Text key={line} style={sans(13, 400, { lh: 1.7, color: color.ink })}>
                    · {line}
                  </Text>
                ))}
                {professionalsOverLimit(plan, active) > 0 ? (
                  <Text
                    style={[sans(12.5, 500, { lh: 1.5, color: color.amberDeep }), { marginTop: 8 }]}
                  >
                    A loja tem {active} profissionais ativos; este plano cabe{" "}
                    {plan.maxProfessionals}. Fale com o suporte para ajustar.
                  </Text>
                ) : null}
              </Card>
            </View>
          ) : null}

          {plans.length > 1 ? (
            <View style={{ gap: 10 }}>
              <SectionLabel>Os planos da Vez</SectionLabel>
              {plans.map((item) => (
                <Card key={item.id} radius={14} padding={14}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[sans(14.5, 700), { flex: 1 }]}>{item.name}</Text>
                    {item.id === plan?.id ? (
                      <Tag label="o seu" tint={color.green} background={color.greenTint} />
                    ) : null}
                  </View>
                  <Text
                    style={[sans(12.5, 400, { lh: 1.5, color: color.muted }), { marginTop: 5 }]}
                  >
                    {planLines(item).join(" · ")}
                  </Text>
                </Card>
              ))}
              <Text style={sans(12.5, 400, { lh: 1.55, color: color.muted })}>
                Trocar de plano é pedido à equipe da Vez, pelo suporte. A loja não troca sozinha.
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <SectionLabel>Cobrança</SectionLabel>
            <Card radius={14} padding={14} background={color.rest} borderColor={color.rest}>
              <Text style={sans(14, 700)}>Nenhuma cobrança foi emitida</Text>
              <Text style={[sans(12.5, 400, { lh: 1.5, color: color.muted }), { marginTop: 5 }]}>
                A cobrança automática ainda não roda: não há fatura, cartão nem repasse. Nada é
                suspenso por falta de pagamento enquanto isso — e esta tela não mostra número
                inventado no lugar.
              </Text>
            </Card>
          </View>
        </View>
      </ScreenScroll>
    </Screen>
  );
}
