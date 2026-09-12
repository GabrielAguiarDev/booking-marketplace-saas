import { mono, sans } from "@vez/mobile-kit/theme";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import {
  CATEGORY_LABEL,
  replyTicket,
  stamp,
  STATUS_LABEL,
  useTicketThread,
} from "../../src/data/support";
import { color } from "../../src/theme/tokens";
import { Field } from "../../src/ui/Field";
import { Card, ErrorNote, PrimaryButton, StatusTag } from "../../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll, StickyFooter } from "../../src/ui/Screen";
import { useToast } from "../../src/ui/Toast";

/**
 * A conversa de um chamado.
 *
 * Responder um chamado resolvido reabre — a RPC `reply_support_ticket` devolve
 * a vez à equipe. Por isso a caixa continua na tela depois de resolvido: o
 * problema que volta é o mesmo problema, e abrir outro chamado faria a equipe
 * recomeçar do zero.
 */
export default function Chamado() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const thread = useTicketThread(id ?? null);

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const ticket = thread.data?.ticket ?? null;
  const messages = thread.data?.messages ?? [];

  const tone =
    ticket?.status === "resolved"
      ? { tint: color.greenDeep, background: color.greenTint }
      : ticket?.status === "waiting_customer"
        ? { tint: color.coralDeep, background: color.coralTint }
        : { tint: color.muted, background: color.rest };

  async function send() {
    if (!ticket) return;
    setBusy(true);
    const result = await replyTicket(ticket.id, body);
    setBusy(false);
    if (!result.ok) {
      toast(result.message, "bad");
      return;
    }
    setBody("");
    thread.reload();
    toast("Mensagem enviada.");
  }

  return (
    <Screen>
      <PlainHeader title={ticket ? `Chamado #${ticket.number}` : "Chamado"} />

      {thread.error ? <ErrorNote message={thread.error} onRetry={thread.reload} /> : null}

      <ScreenScroll bottom={24}>
        {thread.loading ? (
          <Text
            style={[
              sans(13, 400, { color: color.muted }),
              { paddingHorizontal: 20, paddingTop: 24 },
            ]}
          >
            Carregando…
          </Text>
        ) : !ticket ? (
          <Text
            style={[
              sans(13.5, 400, { lh: 1.5, color: color.muted }),
              { paddingHorizontal: 20, paddingTop: 24 },
            ]}
          >
            Este chamado não existe mais ou não é da sua loja.
          </Text>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 16 }}>
            <View style={{ gap: 8 }}>
              <Text style={sans(19, 800, { lh: 1.25, ls: -0.3 / 19 })}>{ticket.subject}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <StatusTag
                  label={STATUS_LABEL[ticket.status]}
                  tint={tone.tint}
                  background={tone.background}
                />
                <Text style={mono(11, 500, { color: color.muted })}>
                  {CATEGORY_LABEL[ticket.category]} · aberto em {stamp(ticket.createdAt)}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              {messages.map((message) => (
                <Card
                  key={message.id}
                  radius={14}
                  padding={14}
                  background={message.fromStaff ? color.rest : color.bg}
                  borderColor={message.fromStaff ? color.rest : color.line}
                  style={{ gap: 6 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text
                      style={sans(11, 700, {
                        ls: 1.1 / 11,
                        color: message.fromStaff ? color.coralDeep : color.muted,
                      })}
                    >
                      {message.fromStaff ? "EQUIPE VEZ" : message.authorName.toUpperCase()}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text style={mono(10.5, 500, { color: color.muted })}>
                      {stamp(message.createdAt)}
                    </Text>
                  </View>
                  <Text style={sans(13.5, 400, { lh: 1.55 })}>{message.body}</Text>
                </Card>
              ))}
            </View>

            {ticket.status === "resolved" ? (
              <Text style={sans(12.5, 400, { lh: 1.5, color: color.muted })}>
                A equipe marcou este chamado como resolvido. Se o problema voltar, responda aqui
                mesmo — o chamado reabre.
              </Text>
            ) : null}
          </View>
        )}
      </ScreenScroll>

      {ticket ? (
        <StickyFooter>
          <View style={{ gap: 10 }}>
            <Field
              placeholder={
                ticket.status === "resolved" ? "Reabrir com uma mensagem" : "Escreva uma mensagem"
              }
              value={body}
              onChangeText={setBody}
              multiline
            />
            <PrimaryButton
              label={busy ? "Enviando…" : "Enviar"}
              height={48}
              disabled={busy || body.trim().length === 0}
              onPress={send}
            />
          </View>
        </StickyFooter>
      ) : null}
    </Screen>
  );
}
