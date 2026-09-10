import { moneyShort } from "@vez/mobile-kit/format";
import { mono, sans } from "@vez/mobile-kit/theme";
import { useState } from "react";
import { Text, View } from "react-native";

import { useEstablishment } from "../src/data/establishment";
import { type Period, useFinance } from "../src/data/finance";
import { color } from "../src/theme/tokens";
import { Card, Caveat, EmptyState, ErrorNote, SectionLabel, Segmented } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";

/**
 * Financeiro.
 *
 * Tudo que está aqui é a soma de atendimento concluído — preço congelado no
 * ato, que é o número que a loja reconhece. Nada vem de `payments`: aquela
 * tabela existe como esquema e nunca recebeu uma linha, porque não há provedor
 * de pagamento escolhido. Mostrar "repasses" com valores seria inventar
 * dinheiro que não existe (regra R7), então a seção diz o que ela é.
 */
export default function Financeiro() {
  const { establishment, isManager } = useEstablishment();
  const [period, setPeriod] = useState<Period>("semana");
  const finance = useFinance(establishment?.id ?? null, period);

  if (!isManager) {
    return (
      <Screen>
        <PlainHeader title="Financeiro" />
        <EmptyState
          title="Financeiro é de quem responde pela loja"
          body="Seu acesso é de equipe: você vê a sua agenda e conclui os seus atendimentos."
        />
      </Screen>
    );
  }

  const data = finance.data;
  const delta =
    data && data.previousCents > 0
      ? Math.round(((data.totalCents - data.previousCents) / data.previousCents) * 100)
      : null;
  const peak = Math.max(1, ...(data?.bars ?? []).map((bar) => bar.cents));

  return (
    <Screen>
      <PlainHeader title="Financeiro" />

      <ScreenScroll bottom={40}>
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <Segmented
            items={[
              { key: "dia", label: "Hoje" },
              { key: "semana", label: "7 dias" },
              { key: "mes", label: "Mês" },
            ]}
            value={period}
            onChange={setPeriod}
          />
        </View>

        {finance.error ? <ErrorNote message={finance.error} onRetry={finance.reload} /> : null}

        {data ? (
          <>
            <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
              <Text style={sans(11, 500, { ls: 0.4 / 11, color: color.muted })}>
                FATURAMENTO {data.periodLabel}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: 10,
                  marginTop: 5,
                  flexWrap: "wrap",
                }}
              >
                <Text style={mono(34, 600, { lh: 1, ls: -1.2 / 34 })}>
                  {moneyShort(data.totalCents)}
                </Text>
                {delta !== null ? (
                  <View
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 7,
                      backgroundColor: delta >= 0 ? color.greenTint : color.dangerTint,
                    }}
                  >
                    <Text style={sans(11, 700, { color: delta >= 0 ? color.green : color.danger })}>
                      {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={[sans(12.5, 400, { color: color.muted }), { marginTop: 6 }]}>
                {data.compareLabel}: {moneyShort(data.previousCents)}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: 6,
                  height: 118,
                  marginTop: 20,
                }}
              >
                {data.bars.map((bar, index) => (
                  <View key={index} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                    <View
                      style={{
                        width: "100%",
                        height: Math.max(3, (bar.cents / peak) * 96),
                        borderTopLeftRadius: 5,
                        borderTopRightRadius: 5,
                        backgroundColor:
                          bar.cents === 0
                            ? color.fill
                            : bar.cents / peak >= 0.8
                              ? color.ink
                              : bar.cents / peak >= 0.4
                                ? color.muted
                                : color.track,
                      }}
                    />
                    <Text style={mono(9.5, 500, { color: color.faint })} numberOfLines={1}>
                      {bar.label}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
                <Card
                  radius={13}
                  padding={13}
                  style={{ flex: 1 }}
                  background={color.rest}
                  borderColor={color.rest}
                >
                  <Text style={mono(20, 600)}>{moneyShort(data.ticketCents)}</Text>
                  <Text style={[sans(11, 500, { color: color.muted }), { marginTop: 3 }]}>
                    ticket médio
                  </Text>
                </Card>
                <Card
                  radius={13}
                  padding={13}
                  style={{ flex: 1 }}
                  background={color.rest}
                  borderColor={color.rest}
                >
                  <Text style={mono(20, 600)}>{data.count}</Text>
                  <Text style={[sans(11, 500, { color: color.muted }), { marginTop: 3 }]}>
                    atendimentos
                  </Text>
                </Card>
              </View>
            </View>

            {data.topServices.length > 0 ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 26, gap: 12 }}>
                <SectionLabel>Mais vendidos</SectionLabel>
                {data.topServices.map((service) => (
                  <View key={service.name} style={{ gap: 5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={sans(13.5, 600)}>{service.name}</Text>
                      <Text style={mono(12.5, 600, { color: color.muted })}>
                        {moneyShort(service.cents)}
                      </Text>
                    </View>
                    <View style={{ height: 7, borderRadius: 999, backgroundColor: color.fill }}>
                      <View
                        style={{
                          height: 7,
                          borderRadius: 999,
                          backgroundColor: color.ink,
                          width: `${(service.cents / (data.topServices[0]?.cents ?? 1)) * 100}%`,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ paddingTop: 24 }}>
                <EmptyState
                  title="Nada concluído neste período"
                  body="O faturamento conta atendimento marcado como concluído. Se você atendeu e não concluiu na tela, ele não entra aqui."
                />
              </View>
            )}
          </>
        ) : null}

        <View style={{ paddingTop: 26, gap: 12 }}>
          <Caveat>
            Este número é a soma dos atendimentos que você marcou como concluídos, pelo preço
            combinado em cada um. Quem foi atendido pela fila não entra: entrada de fila não guarda
            preço, e somar uma média seria inventar.
          </Caveat>
          <Caveat>
            Recebimentos e repasses não aparecem porque não existem: nenhum pagamento passa pela
            plataforma ainda, e o provedor não foi escolhido. Quando existir, é aqui que fica.
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}
