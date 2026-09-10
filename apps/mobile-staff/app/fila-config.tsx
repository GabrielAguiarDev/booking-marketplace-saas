import { sans } from "@vez/mobile-kit/theme";
import { Text, View } from "react-native";

import { useEstablishment } from "../src/data/establishment";
import { color } from "../src/theme/tokens";
import { Caveat, EmptyState, Pill, ToggleRow } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";
import { useToast } from "../src/ui/Toast";

const ARRIVAL: { key: "qr" | "staff" | "location"; label: string }[] = [
  { key: "qr", label: "QR no balcão" },
  { key: "staff", label: "Você confirma" },
  { key: "location", label: "Localização" },
];

const CHANNEL: { key: "push" | "sms" | "whatsapp"; label: string }[] = [
  { key: "push", label: "Push" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
];

const CLOSE_AFTER = [30, 60, 90];

/**
 * Configurações da fila.
 *
 * Cada barbearia trabalha de um jeito, e o produto não escolhe por elas. O que
 * o produto faz é ser honesto sobre o que já vale: os ajustes marcados como
 * "ainda não atua" são gravados no banco e nenhuma superfície os lê ainda.
 * Escondê-los seria mais limpo e menos verdadeiro — quem opera precisa saber
 * onde ainda não pode confiar.
 */
export default function FilaConfig() {
  const toast = useToast();
  const { establishment, settings, isManager, patchEstablishment, patchSettings } =
    useEstablishment();

  if (!establishment || !settings) {
    return (
      <Screen>
        <PlainHeader title="Configurações da fila" />
      </Screen>
    );
  }

  if (!isManager) {
    return (
      <Screen>
        <PlainHeader title="Configurações da fila" />
        <EmptyState
          title="Só dono ou gerência muda isso"
          body="Seu acesso é de equipe. Você opera a fila, mas as regras dela são de quem responde pela loja."
        />
      </Screen>
    );
  }

  const usesQueue = establishment.booking_mode !== "scheduled";

  async function save(run: () => Promise<boolean>, message: string) {
    const ok = await run();
    toast(ok ? message : "Não foi possível salvar.", ok ? "ok" : "bad");
  }

  return (
    <Screen>
      <PlainHeader title="Configurações da fila" />

      <ScreenScroll bottom={40}>
        <Text
          style={[
            sans(13.5, 400, { lh: 1.5, color: color.muted }),
            { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
          ]}
        >
          Cada barbearia trabalha de um jeito. Ligue só o que faz sentido para a sua.
        </Text>

        <ToggleRow
          first
          label="Usar fila de espera aqui"
          help="Atender por ordem de chegada, além dos horários marcados."
          value={usesQueue}
          onChange={(next) =>
            save(
              () => patchEstablishment({ booking_mode: next ? "both" : "scheduled" }),
              next ? "Fila ligada." : "Fila desligada.",
            )
          }
        />

        <ToggleRow
          label="Cliente pode entrar na fila antes de chegar"
          help="Ele pega posição pelo celular e vem depois."
          value={settings.queue_remote_join}
          pending
          onChange={(next) =>
            save(() => patchSettings({ queue_remote_join: next }), "Ajuste salvo.")
          }
        />

        <ToggleRow
          label="Pedir confirmação de chegada"
          help="Quem entrou de longe só ocupa posição depois de confirmar que chegou. Este é o único ajuste que muda a ordem da fila de verdade."
          value={settings.queue_require_arrival}
          onChange={(next) =>
            save(
              () => patchSettings({ queue_require_arrival: next }),
              next
                ? "Quem não confirmar chegada não segura a fila."
                : "Todo mundo passa a pegar posição de onde estiver.",
            )
          }
          options={ARRIVAL.map((item) => (
            <Pill
              key={item.key}
              size="sm"
              label={item.label}
              active={settings.queue_arrival_method === item.key}
              onPress={() =>
                save(() => patchSettings({ queue_arrival_method: item.key }), "Ajuste salvo.")
              }
            />
          ))}
        />

        <ToggleRow
          label="Entrada por QR code no balcão"
          help="Um cartaz com QR na recepção; o cliente entra sozinho."
          value={settings.queue_qr_enabled}
          pending
          onChange={(next) =>
            save(() => patchSettings({ queue_qr_enabled: next }), "Ajuste salvo.")
          }
        />

        <ToggleRow
          label="Uma fila por profissional"
          help="Desligado, todos esperam na mesma fila da loja."
          value={settings.queue_per_professional}
          pending
          onChange={(next) =>
            save(() => patchSettings({ queue_per_professional: next }), "Ajuste salvo.")
          }
        />

        <ToggleRow
          label="Fechar a fila quando encher"
          help="Para de aceitar gente nova se a espera passar do tempo abaixo."
          value={settings.queue_auto_close}
          pending
          onChange={(next) =>
            save(() => patchSettings({ queue_auto_close: next }), "Ajuste salvo.")
          }
          options={CLOSE_AFTER.map((minutes) => (
            <Pill
              key={minutes}
              size="sm"
              label={`${minutes} min`}
              active={settings.queue_close_after_minutes === minutes}
              onPress={() =>
                save(() => patchSettings({ queue_close_after_minutes: minutes }), "Ajuste salvo.")
              }
            />
          ))}
        />

        <ToggleRow
          label="Pular quem não responde"
          help="Depois de dois minutos sem aparecer, passa para o próximo."
          value={settings.queue_auto_skip}
          pending
          onChange={(next) => save(() => patchSettings({ queue_auto_skip: next }), "Ajuste salvo.")}
        />

        <ToggleRow
          label="Avisar o cliente na vez dele"
          help="Como o aviso chega quando você chama."
          value={settings.queue_notify_enabled}
          pending
          onChange={(next) =>
            save(() => patchSettings({ queue_notify_enabled: next }), "Ajuste salvo.")
          }
          options={CHANNEL.map((item) => (
            <Pill
              key={item.key}
              size="sm"
              label={item.label}
              active={settings.queue_notify_channel === item.key}
              onPress={() =>
                save(() => patchSettings({ queue_notify_channel: item.key }), "Ajuste salvo.")
              }
            />
          ))}
        />

        <View style={{ paddingTop: 22 }}>
          <Caveat>
            Os ajustes marcados como “ainda não atua” estão gravados na sua loja, mas nenhuma tela
            os obedece por enquanto — inclusive o aviso na vez, que depende de notificação push, e
            ela não existe em nenhum dos dois apps ainda. Deixamos ligáveis para você já dizer como
            quer trabalhar; quando a peça chegar, ela vem ligada do jeito que você deixou.
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}
