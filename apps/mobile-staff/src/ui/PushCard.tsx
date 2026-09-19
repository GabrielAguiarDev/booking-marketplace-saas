import {
  CHANNEL_LABEL,
  deliveryLabel,
  deliveryNotice,
  pushStateCopy,
} from "@vez/mobile-kit/push/rules";
import { sans } from "@vez/mobile-kit/theme";
import { Text, View } from "react-native";

import { stamp } from "../data/support";
import { useDeliveries, usePush } from "../push";
import { color } from "../theme/tokens";
import { Card, OutlineButton, PrimaryButton, SectionLabel, Tag } from "./primitives";

const TONE = {
  ok: { tint: color.greenDeep, background: color.greenTint },
  wait: { tint: color.muted, background: color.rest },
  warn: { tint: color.amberDeep, background: color.amberTint },
  muted: { tint: color.muted, background: color.rest },
} as const;

/**
 * Este aparelho recebe? E os últimos avisos saíram?
 *
 * As preferências acima só dizem o que tocar. Sem a permissão do sistema, ou
 * com o envio ainda não ligado pela plataforma, nada toca — e o balcão precisa
 * saber disso antes de confiar no aviso de "entrou na fila".
 */
export function PushCard() {
  const { state, enable, retry, openSettings } = usePush();
  const copy = pushStateCopy(state);
  const deliveries = useDeliveries(true);
  const rows = deliveries.data ?? [];
  const notice = deliveryNotice(rows);

  return (
    <View style={{ paddingHorizontal: 20, gap: 12 }}>
      <SectionLabel>Este aparelho</SectionLabel>
      <Card padding={15} style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                copy.tone === "ok" ? color.green : copy.tone === "warn" ? color.amber : color.track,
            }}
          />
          <Text style={sans(14.5, 600)}>{copy.title}</Text>
        </View>
        {copy.text ? (
          <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>{copy.text}</Text>
        ) : null}
        {copy.action === "ask" ? (
          <PrimaryButton label="Permitir notificações" height={44} onPress={() => void enable()} />
        ) : copy.action === "settings" ? (
          <OutlineButton label="Abrir ajustes do aparelho" height={44} onPress={openSettings} />
        ) : copy.action === "retry" ? (
          <OutlineButton label="Tentar de novo" height={44} onPress={() => void retry()} />
        ) : null}
      </Card>

      {rows.length > 0 ? (
        <>
          <SectionLabel>Últimos avisos</SectionLabel>
          {notice ? (
            <Text style={sans(12.5, 500, { lh: 1.45, color: color.amberDeep })}>{notice}</Text>
          ) : null}
          <Card>
            {rows.map((row, index) => {
              const status = deliveryLabel(row.status);
              return (
                <View
                  key={row.id}
                  style={{
                    padding: 14,
                    gap: 6,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: color.lineSoft,
                  }}
                >
                  <Text style={sans(13.5, 600)} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Tag label={status.label} {...TONE[status.tone]} />
                    <Text style={sans(11.5, 400, { color: color.muted })}>
                      {CHANNEL_LABEL[row.channel]} · {stamp(row.created_at)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}
    </View>
  );
}
