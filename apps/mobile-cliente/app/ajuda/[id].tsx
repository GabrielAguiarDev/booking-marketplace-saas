import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";

import {
  CATEGORY_LABEL,
  replyTicket,
  STATUS_LABEL,
  useTicketThread,
  whenLabel,
} from "../../src/data/support";
import { color, radius } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { BackHeader, Card, OutlineButton, PrimaryButton, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";

/**
 * A conversa de um chamado.
 *
 * Recarrega ao ganhar foco e depois de cada resposta enviada: sem notificação,
 * abrir a tela é o único momento em que a resposta da equipe pode chegar.
 */
export default function Chamado() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ticketId = id ?? null;

  const { data, loading, error, reload } = useTicketThread(ticketId);
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  async function responder() {
    if (!ticketId || resposta.trim() === "") return;
    setAviso(null);
    setEnviando(true);
    const result = await replyTicket(ticketId, resposta.trim());
    setEnviando(false);

    if (!result.ok) {
      setAviso(result.message);
      return;
    }
    setResposta("");
    reload();
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenScroll gap={18}>
          <BackHeader title="Chamado" onBack={() => router.back()} />

          {loading ? (
            <View style={{ gap: 11 }}>
              <Shimmer width="100%" height={80} radius={18} />
              <Shimmer width="100%" height={110} radius={18} />
            </View>
          ) : null}

          {error ? (
            <Card radius={16} padding={15} style={{ gap: 11 }}>
              <Text style={sans(14, 500, { lh: 1.45, color: color.body })}>
                Não conseguimos carregar esta conversa.
              </Text>
              <OutlineButton label="Tentar de novo" height={42} onPress={reload} />
            </Card>
          ) : null}

          {!loading && !error && !data ? (
            <Card radius={18} padding={20} style={{ gap: 10 }}>
              <Text style={sans(18, 800, { ls: -0.03 })}>Chamado não encontrado</Text>
              <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
                Ele pode ter sido aberto em outra conta.
              </Text>
            </Card>
          ) : null}

          {data ? (
            <>
              <View style={{ gap: 7 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={mono(9.5, 600, { ls: 0.08, color: color.muted })}>
                    #{String(data.ticket.number).padStart(4, "0")} ·{" "}
                    {CATEGORY_LABEL[data.ticket.category]}
                  </Text>
                  <Text
                    style={mono(9, 600, {
                      ls: 0.08,
                      color:
                        data.ticket.status === "waiting_customer"
                          ? color.coral
                          : data.ticket.status === "resolved"
                            ? color.green
                            : color.muted,
                    })}
                  >
                    {STATUS_LABEL[data.ticket.status]}
                  </Text>
                </View>
                <Text style={sans(21, 800, { ls: -0.03 })}>{data.ticket.subject}</Text>
                {data.ticket.establishmentName ? (
                  <Text style={mono(10, 400, { ls: 0.05, color: color.muted })}>
                    {data.ticket.establishmentName.toUpperCase()}
                  </Text>
                ) : null}
              </View>

              {data.ticket.status === "waiting_customer" ? (
                <Card radius={16} padding={14} style={{ backgroundColor: color.amberTint }}>
                  <Text style={sans(13.5, 500, { lh: 1.45, color: color.amberDeep })}>
                    A equipe está esperando a sua resposta para continuar.
                  </Text>
                </Card>
              ) : null}

              <View style={{ gap: 11 }}>
                {data.messages.map((message) => (
                  <View key={message.id} style={{ gap: 5 }}>
                    <Text style={mono(9, 600, { ls: 0.08, color: color.muted })}>
                      {message.fromStaff ? "EQUIPE VEZ" : "VOCÊ"} · {whenLabel(message.createdAt)}
                    </Text>
                    <View
                      style={{
                        borderRadius: 16,
                        padding: 14,
                        backgroundColor: message.fromStaff ? color.rest : color.bg,
                        borderWidth: message.fromStaff ? 0 : 1,
                        borderColor: color.line,
                      }}
                    >
                      <Text style={sans(14.5, 400, { lh: 1.5, color: color.body })}>
                        {message.body}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Chamado resolvido não recebe resposta pela RPC; oferecer o campo
                  seria prometer um envio que o banco recusa. */}
              {data.ticket.status === "resolved" ? (
                <Card radius={16} padding={15} style={{ gap: 11 }}>
                  <Text style={sans(14, 500, { lh: 1.45, color: color.body })}>
                    Este chamado foi encerrado pela equipe. Se o problema voltar, abra um novo.
                  </Text>
                  <OutlineButton
                    label="Abrir outro chamado"
                    height={42}
                    onPress={() => router.push("/ajuda/novo")}
                  />
                </Card>
              ) : (
                <View style={{ gap: 11 }}>
                  <Text style={mono(10, 600, { ls: 0.12, color: color.muted })}>SUA RESPOSTA</Text>
                  <TextInput
                    value={resposta}
                    onChangeText={setResposta}
                    multiline
                    textAlignVertical="top"
                    maxLength={4000}
                    placeholder="Escreva aqui"
                    placeholderTextColor={color.chevron}
                    style={[
                      sans(15, 500, { ls: -0.01, lh: 1.45 }),
                      {
                        minHeight: 110,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: color.line,
                        backgroundColor: color.bg,
                        padding: 14,
                      },
                    ]}
                  />
                  {aviso ? (
                    <Text style={sans(13, 500, { lh: 1.4, color: color.coral })}>{aviso}</Text>
                  ) : null}
                  <PrimaryButton
                    label={enviando ? "Enviando…" : "Responder"}
                    height={50}
                    onPress={enviando || resposta.trim() === "" ? undefined : responder}
                    background={resposta.trim() === "" ? color.chevron : color.coral}
                  />
                  <Text style={sans(12.5, 400, { lh: 1.5, color: color.muted })}>
                    A resposta da equipe aparece nesta tela. Ainda não enviamos aviso no celular.
                  </Text>
                </View>
              )}
            </>
          ) : null}
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
