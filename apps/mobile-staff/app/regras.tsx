import { sans } from "@vez/mobile-kit/theme";
import { Text, View } from "react-native";

import { useEstablishment } from "../src/data/establishment";
import { minutesLabel } from "../src/format";
import { color } from "../src/theme/tokens";
import { Caveat, EmptyState, KeyRow, Pill, SectionLabel, ToggleRow } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";
import { useToast } from "../src/ui/Toast";

const DEPOSIT_OPTIONS = [30, 50];
const LEAD_OPTIONS = [30, 60, 120, 240];
const CANCEL_OPTIONS = [60, 120, 360, 1440];

/**
 * Regras de agendamento.
 *
 * Ao contrário da tela da fila, aqui quase tudo já vale: aprovação automática é
 * lida pela Edge Function que cria a reserva, o sinal é calculado por ela,
 * antecedência mínima entra em `available_slots()` e a janela de cancelamento
 * governa a função de cancelar. Mudar qualquer um destes números muda o que o
 * app do cliente mostra no próximo toque.
 *
 * É por isso que a tela avisa sobre reserva já vendida (R9): mexer em prazo não
 * derruba o que já foi marcado, e quem edita precisa saber disso.
 */
export default function Regras() {
  const toast = useToast();
  const { establishment, settings, isManager, patchEstablishment, patchSettings } =
    useEstablishment();

  if (!establishment || !settings) {
    return (
      <Screen>
        <PlainHeader title="Regras de agendamento" />
      </Screen>
    );
  }

  if (!isManager) {
    return (
      <Screen>
        <PlainHeader title="Regras de agendamento" />
        <EmptyState
          title="Só dono ou gerência muda isso"
          body="Estas regras valem para todo agendamento feito pelo app do cliente."
        />
      </Screen>
    );
  }

  async function save(run: () => Promise<boolean>, message: string) {
    const ok = await run();
    toast(ok ? message : "Não foi possível salvar.", ok ? "ok" : "bad");
  }

  const requiresDeposit = establishment.deposit_percent > 0;

  return (
    <Screen>
      <PlainHeader title="Regras de agendamento" />

      <ScreenScroll bottom={40}>
        <Text
          style={[
            sans(13.5, 400, { lh: 1.5, color: color.muted }),
            { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
          ]}
        >
          Valem para todo agendamento feito pelo app do cliente. O que você cria no balcão não passa
          por elas.
        </Text>

        <ToggleRow
          first
          label="Aprovar agendamentos automaticamente"
          help="Desligado, todo pedido espera o seu sim e aparece em Hoje."
          value={settings.auto_approve}
          onChange={(next) =>
            save(
              () => patchSettings({ auto_approve: next }),
              next
                ? "Pedidos passam a nascer confirmados."
                : "Pedidos voltam a esperar sua aprovação.",
            )
          }
        />

        <ToggleRow
          label="Exigir sinal para reservar"
          help="O cliente paga uma parte na hora de agendar. O valor é calculado sobre o preço do serviço."
          value={requiresDeposit}
          onChange={(next) =>
            save(
              () => patchEstablishment({ deposit_percent: next ? 30 : 0 }),
              next ? "Sinal de 30% ligado." : "Sinal desligado.",
            )
          }
          options={DEPOSIT_OPTIONS.map((percent) => (
            <Pill
              key={percent}
              size="sm"
              label={`${percent}% do valor`}
              active={establishment.deposit_percent === percent}
              onPress={() =>
                save(() => patchEstablishment({ deposit_percent: percent }), "Sinal atualizado.")
              }
            />
          ))}
        />

        <ToggleRow
          label="Sinal reembolsável"
          help="Devolvido se o cliente cancelar dentro do prazo abaixo."
          value={settings.deposit_refundable}
          pending
          onChange={(next) =>
            save(() => patchSettings({ deposit_refundable: next }), "Ajuste salvo.")
          }
        />

        <ToggleRow
          label="Aceitar pagamento pelo app"
          help="Desligado, o cliente sempre paga no balcão."
          value={settings.accept_app_payment}
          pending
          onChange={(next) =>
            save(() => patchSettings({ accept_app_payment: next }), "Ajuste salvo.")
          }
        />

        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 4,
            borderTopWidth: 1,
            borderTopColor: color.lineSoft,
            marginTop: 8,
          }}
        >
          <SectionLabel>Prazos</SectionLabel>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <KeyRow
            label="Antecedência mínima"
            help="Tempo mínimo entre o pedido e o horário. Fecha o encaixe de última hora."
            value={minutesLabel(establishment.min_lead_minutes)}
            valueMono
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 14 }}>
            {LEAD_OPTIONS.map((minutes) => (
              <Pill
                key={minutes}
                size="sm"
                label={minutesLabel(minutes)}
                active={establishment.min_lead_minutes === minutes}
                onPress={() =>
                  save(
                    () => patchEstablishment({ min_lead_minutes: minutes }),
                    "Antecedência atualizada.",
                  )
                }
              />
            ))}
          </View>

          <KeyRow
            label="Cancelar sem custo até"
            help="Depois disso, o cliente vê o aviso de que cancelou fora do prazo."
            value={`${minutesLabel(establishment.cancellation_window_minutes)} antes`}
            valueMono
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 14 }}>
            {CANCEL_OPTIONS.map((minutes) => (
              <Pill
                key={minutes}
                size="sm"
                label={minutesLabel(minutes)}
                active={establishment.cancellation_window_minutes === minutes}
                onPress={() =>
                  save(
                    () => patchEstablishment({ cancellation_window_minutes: minutes }),
                    "Janela de cancelamento atualizada.",
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={{ paddingTop: 12, gap: 12 }}>
          <Caveat>
            Mudar prazo não mexe em reserva já vendida: quem marcou ontem continua com o horário e
            com a regra de ontem. O novo valor vale do próximo pedido em diante.
          </Caveat>
          <Caveat>
            Sinal e pagamento pelo app dependem de provedor de pagamento, que ainda não foi
            escolhido. O valor do sinal já é calculado e guardado em cada reserva; nenhuma cobrança
            sai de lugar nenhum. Por isso “sinal reembolsável” e “aceitar pagamento pelo app” estão
            marcados como não atuantes.
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}
