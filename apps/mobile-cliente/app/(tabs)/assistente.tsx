import { useFocusEffect, useRouter } from "expo-router";
import { ArrowUp, Clock, Sparkles, SquarePen, Trash2 } from "lucide-react-native";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
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
  type ChatMessage,
  type ConversationSummary,
  deleteConversation,
  type EstablishmentCard,
  loadConversation,
  type SlotCard,
  useAssistantUsage,
  useConversations,
} from "../../src/data/assistant";
import { accentOf, CATEGORY, initialsOfName, shade } from "../../src/data/catalog";
import { useConnected } from "../../src/data/connectivity";
import { useCityId } from "../../src/data/use-cities";
import {
  assistantFailure,
  conversationTitle,
  conversationWhen,
  establishmentNames,
  type Failure,
  groupSlots,
  quotaView,
} from "../../src/domain/assistant";
import { hourMinute, slotLabel } from "@vez/mobile-kit/format";
import { useReducedMotion } from "@vez/mobile-kit/motion";
import { useAppState } from "../../src/state/app-state";
import { color, radius } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { duo2, Photo } from "../../src/ui/Photo";
import { Card, OutlineButton, PrimaryButton, PulseDot, Shimmer } from "../../src/ui/primitives";
import { Screen } from "../../src/ui/Screen";
import { Sheet } from "../../src/ui/Sheet";

/**
 * Só o que as ferramentas do assistente sabem responder: loja, serviço com
 * preço e horário livre. Sugerir "qual tem fila agora?" seria prometer uma
 * consulta que ele não tem como fazer.
 */
const SUGESTOES = [
  "Tem corte masculino hoje à tarde?",
  "Quero um dermatologista essa semana",
  "Quanto custa fazer as unhas por aqui?",
];

export default function Assistente() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const cityId = useCityId();
  const state = useAppState();
  const connected = useConnected();
  const reduced = useReducedMotion();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  /** A pergunta que está indo. Vira mensagem só quando a resposta chega. */
  const [pending, setPending] = useState<string | null>(null);
  /** A pergunta que não foi, e por quê. O servidor não gravou nada dela. */
  const [failed, setFailed] = useState<{ text: string; failure: Failure } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);
  const turn = useRef(0);

  const signedIn = Boolean(session);
  const usage = useAssistantUsage(signedIn);
  const conversations = useConversations(signedIn);

  // Voltar para a aba no dia seguinte não pode mostrar a cota de ontem: o
  // número guardado da última resposta sai, e vale o que o servidor disser.
  const reloadUsage = usage.reload;
  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      setRemaining(null);
      void reloadUsage();
    }, [signedIn, reloadUsage]),
  );

  const quota = quotaView(remaining ?? usage.data?.remaining ?? null, usage.data?.dayLimit ?? null);
  const names = useMemo(() => establishmentNames(messages), [messages]);
  const busy = pending !== null;

  if (sessionLoading) {
    return (
      <Screen>
        <Cabecalho />
      </Screen>
    );
  }
  if (!session) return <AssistenteDeslogado onEntrar={() => router.push("/entrar")} />;

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || busy || quota?.blocked) return;

    setDraft("");
    setFailed(null);
    setPending(pergunta);

    const result = await ask({ message: pergunta, conversationId, cityId });
    setPending(null);

    if (!result.ok) {
      const failure = assistantFailure(result.code, connected);
      setFailed({ text: pergunta, failure });
      // O servidor recusou por cota: o contador da tela passa a dizer o mesmo.
      if (failure.kind === "quota") setRemaining(0);
      AccessibilityInfo.announceForAccessibility(`${failure.title}. ${failure.message}`);
      return;
    }

    // Chave de lista, não horário: basta ser única dentro desta tela.
    turn.current += 1;
    const stamp = turn.current;
    setConversationId(result.conversationId);
    setRemaining(result.remaining);
    setMessages((prev) => [
      ...prev,
      { id: `u-${stamp}`, role: "user", content: pergunta, cards: [] },
      { id: `a-${stamp}`, role: "assistant", content: result.reply, cards: result.cards },
    ]);
    AccessibilityInfo.announceForAccessibility(result.reply);
  }

  function novaConversa() {
    setMessages([]);
    setConversationId(null);
    setFailed(null);
    setDraft("");
  }

  function abrirHistorico() {
    setHistoryNotice(null);
    setHistoryOpen(true);
    void conversations.reload();
  }

  async function abrirConversa(summary: ConversationSummary) {
    if (opening) return;
    setOpening(summary.id);
    setHistoryNotice(null);
    const result = await loadConversation(summary.id);
    setOpening(null);

    if (!result.ok) {
      setHistoryNotice(
        connected === false
          ? "Você está sem internet. Conecte-se para abrir a conversa."
          : "Não foi possível abrir esta conversa. Tente de novo.",
      );
      return;
    }

    setMessages(result.messages);
    setConversationId(summary.id);
    setFailed(null);
    setHistoryOpen(false);
  }

  async function apagarConversa(id: string) {
    setHistoryNotice(null);
    const ok = await deleteConversation(id);
    if (!ok) {
      setHistoryNotice("Não foi possível apagar a conversa. Tente de novo.");
      return;
    }
    if (id === conversationId) novaConversa();
    setRemaining(null);
    void usage.reload();
    void conversations.reload();
  }

  function abrirHorario(card: SlotCard) {
    // O cartão já traz loja, serviço, profissional e horário: a escolha está
    // completa, então vai direto para a confirmação — que é quem reserva.
    state.startBooking(card.establishment_id, card.service_id);
    state.setProfessional(card.professional_id);
    state.setSlot(card.slot_start);
    router.push({ pathname: "/pagamento", params: { origem: "assistente" } });
  }

  const vazio = messages.length === 0 && !busy && !failed;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <Cabecalho
          onHistory={abrirHistorico}
          onNew={messages.length > 0 || failed ? novaConversa : undefined}
        />

        <ScrollView
          ref={scroller}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!vazio) scroller.current?.scrollToEnd({ animated: !reduced });
          }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 14 }}
        >
          {vazio ? (
            <View style={{ gap: 16, paddingTop: 8 }}>
              <Text style={sans(15, 400, { lh: 1.5, color: color.muted })}>
                Descreva o que você precisa. Eu procuro nas lojas perto de você e mostro os horários
                que estão realmente livres. Quem confirma a reserva é você.
              </Text>
              <View style={{ gap: 9 }}>
                {SUGESTOES.map((sugestao) => (
                  <Pressable
                    key={sugestao}
                    onPress={() => void enviar(sugestao)}
                    disabled={quota?.blocked}
                    accessibilityRole="button"
                    accessibilityHint="Envia esta pergunta ao assistente"
                    accessibilityState={{ disabled: quota?.blocked ?? false }}
                    style={({ pressed }) => ({
                      borderWidth: 1,
                      borderColor: pressed ? color.ink : color.line,
                      borderRadius: radius.lg,
                      paddingVertical: 14,
                      paddingHorizontal: 15,
                      opacity: quota?.blocked ? 0.5 : 1,
                    })}
                  >
                    <Text style={sans(14.5, 500, { ls: -0.01 })}>{sugestao}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {messages.map((message) => (
            <Mensagem
              key={message.id}
              message={message}
              names={names}
              onOpenShop={(id) => router.push(`/loja/${id}`)}
              onOpenSlot={abrirHorario}
            />
          ))}

          {pending ? (
            <>
              <Balao role="user" text={pending} />
              <View
                accessible
                accessibilityLiveRegion="polite"
                accessibilityLabel="Consultando as agendas"
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  backgroundColor: color.rest,
                  borderRadius: 18,
                  paddingVertical: 12,
                  paddingHorizontal: 15,
                }}
              >
                <PulseDot dotColor={color.muted} />
                <Text style={sans(14.5, 400, { color: color.muted })}>Consultando as agendas…</Text>
              </View>
            </>
          ) : null}

          {failed ? (
            <>
              <Balao role="user" text={failed.text} unsent />
              <Card
                radius={16}
                padding={15}
                style={{ gap: 11, borderColor: color.coralBorder, backgroundColor: "#FFF4F1" }}
              >
                <View accessible accessibilityRole="alert" style={{ gap: 5 }}>
                  <Text style={mono(9.5, 600, { ls: 0.1, color: "#B33A1F" })}>
                    {failed.failure.title.toUpperCase()}
                  </Text>
                  <Text style={sans(14, 400, { lh: 1.45, color: color.body })}>
                    {failed.failure.message}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 9 }}>
                  {failed.failure.retryable ? (
                    <PrimaryButton
                      label="Tentar de novo"
                      height={44}
                      style={{ flex: 1 }}
                      onPress={() => void enviar(failed.text)}
                    />
                  ) : null}
                  {failed.failure.kind === "session" ? (
                    <PrimaryButton
                      label="Entrar"
                      height={44}
                      style={{ flex: 1 }}
                      onPress={() => router.push("/entrar")}
                    />
                  ) : null}
                  {failed.failure.kind === "not_configured" ||
                  failed.failure.kind === "out_of_credit" ? (
                    <PrimaryButton
                      label="Explorar lojas"
                      height={44}
                      style={{ flex: 1 }}
                      onPress={() => router.navigate("/explorar")}
                    />
                  ) : null}
                  <OutlineButton
                    label="Editar pergunta"
                    height={44}
                    style={{ flex: 1, backgroundColor: color.bg }}
                    onPress={() => {
                      // Nada se perde: o texto volta para o campo.
                      setDraft(failed.text);
                      setFailed(null);
                    }}
                  />
                </View>
              </Card>
            </>
          ) : null}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: color.line,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 14,
            gap: 9,
          }}
        >
          {quota ? (
            <Text
              style={mono(9.5, 600, {
                ls: 0.1,
                color:
                  quota.tone === "normal"
                    ? color.muted
                    : quota.tone === "low"
                      ? color.amberDeep
                      : "#B33A1F",
              })}
            >
              {quota.label}
            </Text>
          ) : null}

          {quota?.blocked ? (
            <Text style={sans(13.5, 400, { lh: 1.45, color: color.body })}>
              Você usou todas as perguntas de hoje. A cota é renovada a cada dia; enquanto isso, a
              aba Explorar mostra as lojas e os horários.
            </Text>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="O que você precisa?"
                placeholderTextColor={color.muted}
                accessibilityLabel="Pergunta para o assistente"
                multiline
                maxLength={1000}
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
                onPress={() => void enviar(draft)}
                disabled={busy || !draft.trim()}
                accessibilityRole="button"
                accessibilityLabel="Enviar pergunta"
                accessibilityState={{ disabled: busy || !draft.trim(), busy }}
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
          )}
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title="Conversas">
        <Historico
          loading={conversations.loading}
          error={conversations.error}
          items={conversations.data ?? []}
          currentId={conversationId}
          opening={opening}
          notice={historyNotice}
          onRetry={() => void conversations.reload()}
          onOpen={(summary) => void abrirConversa(summary)}
          onDelete={apagarConversa}
        />
      </Sheet>
    </Screen>
  );
}

function Cabecalho({ onHistory, onNew }: { onHistory?: () => void; onNew?: () => void }) {
  return (
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
      <Text accessibilityRole="header" style={[sans(24, 800, { ls: -0.04 }), { flex: 1 }]}>
        Assistente
      </Text>
      {onNew ? (
        <BotaoIcone label="Nova conversa" onPress={onNew}>
          <SquarePen size={18} color={color.ink} strokeWidth={1.9} />
        </BotaoIcone>
      ) : null}
      {onHistory ? (
        <BotaoIcone label="Conversas anteriores" onPress={onHistory}>
          <Clock size={18} color={color.ink} strokeWidth={1.9} />
        </BotaoIcone>
      ) : null}
    </View>
  );
}

function BotaoIcone({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: pressed ? color.ink : color.line,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      {children}
    </Pressable>
  );
}

function Balao({
  role,
  text,
  unsent = false,
}: {
  role: "user" | "assistant";
  text: string;
  unsent?: boolean;
}) {
  const mine = role === "user";
  return (
    <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%", gap: 4 }}>
      <View
        accessible
        accessibilityLabel={`${mine ? "Você" : "Assistente"}: ${text}`}
        style={{
          backgroundColor: mine ? color.ink : color.rest,
          borderRadius: 18,
          paddingVertical: 12,
          paddingHorizontal: 15,
          opacity: unsent ? 0.45 : 1,
        }}
      >
        <Text style={sans(14.5, 400, { lh: 1.45, color: mine ? "#fff" : color.ink })}>{text}</Text>
      </View>
      {unsent ? (
        <Text style={[mono(9, 600, { ls: 0.08, color: "#B33A1F" }), { alignSelf: "flex-end" }]}>
          NÃO ENVIADA
        </Text>
      ) : null}
    </View>
  );
}

function Mensagem({
  message,
  names,
  onOpenShop,
  onOpenSlot,
}: {
  message: ChatMessage;
  names: ReadonlyMap<string, string>;
  onOpenShop: (id: string) => void;
  onOpenSlot: (card: SlotCard) => void;
}) {
  const shops = message.cards.filter((c): c is EstablishmentCard => c.kind === "establishment");
  const groups = groupSlots(message.cards, names);

  return (
    <View style={{ gap: 11 }}>
      <Balao role={message.role} text={message.content} />

      {shops.map((card) => (
        <LojaSugerida key={card.id} card={card} onPress={() => onOpenShop(card.id)} />
      ))}

      {groups.length > 0 && message.restoredAt ? (
        // Horário de uma conversa antiga não é oferta: pode ter sido vendido
        // minutos depois. Mostrar os botões seria a tela afirmando uma
        // disponibilidade que só o banco pode afirmar (R1).
        <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>
          Os horários desta resposta foram consultados em {slotLabel(message.restoredAt)}. Pergunte
          de novo para ver o que está livre agora.
        </Text>
      ) : (
        groups.map((group) => {
          const title = [group.establishmentName, group.serviceName].filter(Boolean).join(" · ");

          return (
            <View key={group.key} style={{ gap: 8 }}>
              <Text style={mono(9.5, 600, { ls: 0.1, color: color.muted })} numberOfLines={1}>
                {(title || "Horários livres").toUpperCase()}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {group.slots.map((card) => {
                  const day = slotLabel(card.slot_start).split(" · ")[0];
                  return (
                    <Pressable
                      key={card.slot_start}
                      onPress={() => onOpenSlot(card)}
                      accessibilityRole="button"
                      accessibilityLabel={`${day}, ${hourMinute(card.slot_start)}${title ? `, ${title}` : ""}`}
                      accessibilityHint="Abre a confirmação da reserva"
                      style={({ pressed }) => ({
                        minWidth: 64,
                        minHeight: 44,
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: pressed ? color.ink : color.line,
                        borderRadius: 12,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                      })}
                    >
                      <Text style={mono(12.5, 600)}>{hourMinute(card.slot_start)}</Text>
                      <Text style={mono(8.5, 400, { ls: 0.06, color: color.muted })}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function Historico({
  loading,
  error,
  items,
  currentId,
  opening,
  notice,
  onRetry,
  onOpen,
  onDelete,
}: {
  loading: boolean;
  error: string | null;
  items: ConversationSummary[];
  currentId: string | null;
  opening: string | null;
  notice: string | null;
  onRetry: () => void;
  onOpen: (summary: ConversationSummary) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  // Apagar pede um segundo toque na própria linha, e não um alerta por cima
  // da folha: a pergunta fica ao lado do que vai sumir.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={{ gap: 10, paddingBottom: 8 }}>
        <Shimmer width="100%" height={54} radius={14} />
        <Shimmer width="100%" height={54} radius={14} />
        <Shimmer width="100%" height={54} radius={14} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ gap: 12, paddingBottom: 8 }}>
        <Text style={sans(14.5, 400, { lh: 1.5, color: color.body })}>
          Não conseguimos carregar suas conversas.
        </Text>
        <OutlineButton label="Tentar de novo" height={44} onPress={onRetry} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <Text style={[sans(14.5, 400, { lh: 1.5, color: color.muted }), { paddingBottom: 8 }]}>
        Você ainda não conversou com o assistente. As conversas ficam guardadas aqui, e você pode
        apagar qualquer uma.
      </Text>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {notice ? (
        <Text
          accessibilityRole="alert"
          style={[sans(13, 500, { lh: 1.4, color: "#B33A1F" }), { paddingBottom: 8 }]}
        >
          {notice}
        </Text>
      ) : null}

      {items.map((item, index) => {
        const title = conversationTitle(item.title);
        const when = conversationWhen(item.updatedAt);
        const current = item.id === currentId;
        const last = index === items.length - 1;

        if (confirming === item.id) {
          return (
            <View
              key={item.id}
              style={{
                paddingVertical: 12,
                gap: 10,
                borderBottomWidth: last ? 0 : 1,
                borderBottomColor: color.lineSoft,
              }}
            >
              <Text style={sans(14, 500, { lh: 1.4 })} numberOfLines={2}>
                Apagar “{title}”? As mensagens somem e não voltam.
              </Text>
              <View style={{ flexDirection: "row", gap: 9 }}>
                <OutlineButton
                  label="Manter"
                  height={44}
                  style={{ flex: 1 }}
                  onPress={deleting ? undefined : () => setConfirming(null)}
                />
                <PrimaryButton
                  label={deleting === item.id ? "Apagando…" : "Apagar"}
                  height={44}
                  background={deleting ? color.chevron : color.ink}
                  style={{ flex: 1 }}
                  onPress={
                    deleting
                      ? undefined
                      : async () => {
                          setDeleting(item.id);
                          await onDelete(item.id);
                          setDeleting(null);
                          setConfirming(null);
                        }
                  }
                />
              </View>
            </View>
          );
        }

        return (
          <View
            key={item.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderBottomWidth: last ? 0 : 1,
              borderBottomColor: color.lineSoft,
            }}
          >
            <Pressable
              onPress={() => onOpen(item)}
              disabled={opening !== null}
              accessibilityRole="button"
              accessibilityLabel={`${title}, ${when.toLowerCase()}${current ? ", conversa aberta" : ""}`}
              accessibilityState={{ busy: opening === item.id, selected: current }}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 13,
                gap: 4,
                opacity: pressed || (opening !== null && opening !== item.id) ? 0.55 : 1,
              })}
            >
              <Text style={sans(14.5, current ? 700 : 600, { ls: -0.01 })} numberOfLines={1}>
                {title}
              </Text>
              <Text
                style={mono(9.5, 500, { ls: 0.06, color: current ? color.coral : color.muted })}
              >
                {opening === item.id ? "ABRINDO…" : current ? `ABERTA · ${when}` : when}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirming(item.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Apagar conversa ${title}`}
              style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
            >
              <Trash2 size={17} color={color.muted} strokeWidth={1.8} />
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

function LojaSugerida({ card, onPress }: { card: EstablishmentCard; onPress: () => void }) {
  const accent = accentOf({ category: card.category, accent_color: null });
  const category = CATEGORY[card.category];
  const rating =
    card.rating_count > 0 && card.rating_avg !== null
      ? card.rating_avg.toFixed(1).replace(".", ",")
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${category.label}${rating ? `, nota ${rating}` : ""}`}
      accessibilityHint="Abre a página da loja"
    >
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
            {rating ? ` · ★ ${rating}` : ""}
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
        <Text accessibilityRole="header" style={sans(30, 800, { ls: -0.04 })}>
          Assistente
        </Text>
        <Card radius={18} padding={20} style={{ gap: 9 }}>
          <Text style={sans(19, 800, { ls: -0.03 })}>Entre para conversar</Text>
          <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
            O assistente consulta as agendas reais das lojas perto de você. Para isso ele precisa
            saber quem é você.
          </Text>
        </Card>
        <PrimaryButton label="Entrar" height={54} onPress={onEntrar} />
      </View>
    </Screen>
  );
}
