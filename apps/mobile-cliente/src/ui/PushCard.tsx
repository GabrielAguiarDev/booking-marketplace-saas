import {
  CHANNEL_LABEL,
  deliveryLabel,
  deliveryNotice,
  pushStateCopy,
} from "@vez/mobile-kit/push/rules";
import { sans } from "@vez/mobile-kit/theme";
import { Text, View } from "react-native";

import { useDeliveries, usePush } from "../push";
import { whenLabel } from "../data/support";
import { color } from "../theme/tokens";
import { Card, Label, OutlineButton, PrimaryButton } from "./primitives";

const TONE = {
  ok: { ink: color.greenDeep, tint: color.greenTint },
  wait: { ink: color.muted, tint: color.rest },
  warn: { ink: color.amberDeep, tint: color.amberTint },
  muted: { ink: color.muted, tint: color.rest },
} as const;

/**
 * Este aparelho recebe? E os últimos avisos saíram?
 *
 * A preferência só diz o que a pessoa quer receber; sem permissão do sistema,
 * sem o envio configurado pela plataforma, nada chega. A tela mostra os dois
 * lados em vez de deixar a pessoa descobrir quando perder a vez na fila.
 */
export function PushCard() {
  const { state, enable, retry, openSettings } = usePush();
  const copy = pushStateCopy(state);
  const deliveries = useDeliveries(true);
  const rows = deliveries.data ?? [];
  const notice = deliveryNotice(rows);

  return (
    <>
      <View style={{ gap: 11 }}>
        <Label>ESTE APARELHO</Label>
        <Card radius={16} style={{ padding: 15, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  copy.tone === "ok" ? color.green : copy.tone === "warn" ? color.amber : color.dotIdle,
              }}
            />
            <Text style={sans(14.5, 600, { ls: -0.01 })}>{copy.title}</Text>
          </View>
          {copy.text ? (
            <Text style={sans(12.5, 400, { lh: 1.4, color: color.muted })}>{copy.text}</Text>
          ) : null}
          {copy.action === "ask" ? (
            <PrimaryButton label="Permitir notificações" height={44} onPress={() => void enable()} />
          ) : copy.action === "settings" ? (
            <OutlineButton label="Abrir ajustes do aparelho" height={44} onPress={openSettings} />
          ) : copy.action === "retry" ? (
            <OutlineButton label="Tentar de novo" height={44} onPress={() => void retry()} />
          ) : null}
        </Card>
      </View>

      {rows.length > 0 ? (
        <View style={{ gap: 11 }}>
          <Label>ÚLTIMOS AVISOS</Label>
          {notice ? (
            <Text style={sans(12.5, 500, { lh: 1.4, color: color.amberDeep })}>{notice}</Text>
          ) : null}
          <Card radius={16}>
            {rows.map((row, index) => {
              const status = deliveryLabel(row.status);
              const tone = TONE[status.tone];
              return (
                <View
                  key={row.id}
                  style={{
                    padding: 14,
                    gap: 5,
                    borderBottomWidth: index === rows.length - 1 ? 0 : 1,
                    borderBottomColor: color.lineSoft,
                  }}
                >
                  <Text style={sans(13.5, 600)} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: tone.tint,
                      }}
                    >
                      <Text style={sans(11, 600, { color: tone.ink })}>{status.label}</Text>
                    </View>
                    <Text style={sans(11.5, 400, { color: color.muted })}>
                      {CHANNEL_LABEL[row.channel]} · {whenLabel(row.created_at)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}
    </>
  );
}
