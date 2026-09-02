import { useRouter } from "expo-router";
import { ArrowUp, Sparkles } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSession } from "../../src/auth/session";
import {
  ask,
  type Card as AssistantCard,
  type ChatMessage,
  useAssistantUsage,
} from "../../src/data/assistant";
import { accentOf, CATEGORY, initialsOfName, shade } from "../../src/data/catalog";
import { useCurrentCity } from "../../src/data/use-cities";
import { hourMinute, slotLabel } from "../../src/format";
import { useAppState } from "../../src/state/app-state";
import { color, radius } from "../../src/theme/tokens";
import { mono, sans } from "../../src/theme/type";
import { duo2, Photo } from "../../src/ui/Photo";
import { Card, PrimaryButton } from "../../src/ui/primitives";
import { Screen } from "../../src/ui/Screen";

const SUGESTOES = [
  "Tem corte masculino hoje à tarde?",
  "Quero um dermatologista essa semana",
  "Qual barbearia tem fila agora?",
];

export default function Assistente() {
  const router = useRouter();
  const { session } = useSession();
  const { cityId } = useCurrentCity();
  const state = useAppState();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const scroller = useRef<ScrollView>(null);

  const { data: usage } = useAssistantUsage(Boolean(session));
  const restantes = remaining ?? usage?.remaining ?? null;

  if (!session) return <AssistenteDeslogado onEntrar={() => router.push("/entrar")} />;

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || busy) return;

    setDraft("");
    setError(null);
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: pergunta, cards: [] },
    ]);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));

    const result = await ask({ message: pergunta, conversationId, cityId });
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setConversationId(result.conversationId);
    setRemaining(result.remaining);
    setMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, role: "assistant", content: result.reply, cards: result.cards },
    ]);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  }

  function abrirHorario(card: Extract<AssistantCard, { kind: "slot" }>) {
    // O cartão já traz loja, serviço, profissional e horário: a escolha está
    // completa, então vai direto para a confirmação.
    state.startBooking(card.establishment_id, card.service_id);
    state.setProfessional(card.professional_id);
    state.setSlot(card.slot_start);
    router.push("/pagamento");
  }

  const vazio = messages.length === 0;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: color.rest,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={18} color={color.coral} strokeWidth={2} />
          </View>
          <Text style={[sans(24, 800, { ls: -0.04 }), { flex: 1 }]}>Assistente</Text>
          {restantes !== null ? (
            <Text style={mono(9, 600, { ls: 0.08, color: color.muted })}>{restantes} HOJE</Text>
          ) : null}
        </View>

        <ScrollView
          ref={scroller}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 14 }}
        >
          {vazio ? (
            <View style={{ gap: 16, paddingTop: 8 }}>
              <Text style={sans(15, 400, { lh: 1.5, color: color.muted })}>
                Descreva o que você precisa. Eu procuro nas lojas da sua cidade e mostro os horários
                que estão realmente livres.
              </Text>
              <View style={{ gap: 9 }}>
                {SUGESTOES.map((sugestao) => (
                  <Pressable
                    key={sugestao}
                    onPress={() => enviar(sugestao)}
                    style={{
                      borderWidth: 1,
                      borderColor: color.line,
                      borderRadius: radius.lg,
                      paddingVertical: 13,
                      paddingHorizontal: 15,
                    }}
                  >
                    <Text style={sans(14.5, 500, { ls: -0.01 })}>{sugestao}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {messages.map((message) => (
            <View key={message.id} style={{ gap: 11 }}>
              <View
                style={{
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  backgroundColor: message.role === "user" ? color.ink : color.rest,
                  borderRadius: 18,
                  paddingVertical: 12,
                  paddingHorizontal: 15,
                }}
              >
                <Text
                  style={sans(14.5, 400, {
                    lh: 1.45,
                    color: message.role === "user" ? "#fff" : color.ink,
                  })}
                >
                  {message.content}
                </Text>
              </View>

              {message.cards.map((card, index) =>
                card.kind === "establishment" ? (
                  <LojaSugerida
                    key={`${message.id}-${index}`}
                    card={card}
                    onPress={() => router.push(`/loja/${card.id}`)}
                  />
                ) : null,
              )}

              {message.cards.some((c) => c.kind === "slot") ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {message.cards
                    .filter((c): c is Extract<AssistantCard, { kind: "slot" }> => c.kind === "slot")
                    .map((card) => (
                      <Pressable
                        key={card.slot_start}
                        onPress={() => abrirHorario(card)}
                        style={{
                          borderWidth: 1,
                          borderColor: color.line,
                          borderRadius: 12,
                          paddingVertical: 11,
                          paddingHorizontal: 14,
                        }}
                      >
                        <Text style={mono(12.5, 600)}>{hourMinute(card.slot_start)}</Text>
                        <Text style={mono(8.5, 400, { ls: 0.06, color: color.muted })}>
                          {slotLabel(card.slot_start).split(" · ")[0]}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              ) : null}
            </View>
          ))}

          {busy ? (
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: color.rest,
                borderRadius: 18,
                paddingVertical: 12,
                paddingHorizontal: 15,
              }}
            >
              <Text style={sans(14.5, 400, { color: color.muted })}>Consultando as agendas…</Text>
            </View>
          ) : null}

          {error ? (
            <Card radius={14} padding={14}>
              <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{error}</Text>
            </Card>
          ) : null}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: color.line,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 14,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="O que você precisa?"
            placeholderTextColor={color.chevron}
            multiline
            maxLength={1000}
            onSubmitEditing={() => enviar(draft)}
            style={[
              sans(15, 400, { lh: 1.35 }),
              {
                flex: 1,
                maxHeight: 100,
                minHeight: 46,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: color.line,
                paddingHorizontal: 15,
                paddingTop: 13,
                paddingBottom: 13,
              },
            ]}
          />
          <Pressable
            onPress={() => enviar(draft)}
            disabled={busy || !draft.trim()}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: busy || !draft.trim() ? color.rest : color.coral,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowUp
              size={20}
              color={busy || !draft.trim() ? color.chevron : "#fff"}
              strokeWidth={2.4}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function LojaSugerida({
  card,
  onPress,
}: {
  card: Extract<AssistantCard, { kind: "establishment" }>;
  onPress: () => void;
}) {
  const accent = accentOf({ category: card.category, accent_color: null });
  const category = CATEGORY[card.category];

  return (
    <Pressable onPress={onPress}>
      <Card
        radius={16}
        padding={12}
        style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
      >
        <Photo
          duotone={duo2(shade(accent, -0.4), shade(accent, 0.35))}
          size={46}
          radius={13}
          mono={initialsOfName(card.name)}
          monoSize={13}
          center
        />
        <View style={{ gap: 3, flex: 1 }}>
          <Text style={sans(14.5, 700, { ls: -0.02 })} numberOfLines={1}>
            {card.name}
          </Text>
          <Text style={mono(9, 400, { ls: 0.05, color: color.muted })} numberOfLines={1}>
            {category.label.toUpperCase()}
            {card.neighborhood ? ` · ${card.neighborhood.toUpperCase()}` : ""}
            {card.rating_count > 0 ? ` · ★ ${card.rating_avg?.toFixed(1).replace(".", ",")}` : ""}
          </Text>
        </View>
        <Text style={sans(17, 400, { lh: 1, color: color.chevron })}>›</Text>
      </Card>
    </Pressable>
  );
}

function AssistenteDeslogado({ onEntrar }: { onEntrar: () => void }) {
  return (
    <Screen>
      <View style={{ padding: 20, gap: 22 }}>
        <Text style={sans(30, 800, { ls: -0.04 })}>Assistente</Text>
        <Card radius={18} padding={20} style={{ gap: 9 }}>
          <Text style={sans(19, 800, { ls: -0.03 })}>Entre para conversar</Text>
          <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
            O assistente consulta as agendas reais das lojas da sua cidade. Para isso ele precisa
            saber quem é você.
          </Text>
        </Card>
        <PrimaryButton label="Entrar" height={54} onPress={onEntrar} />
      </View>
    </Screen>
  );
}
