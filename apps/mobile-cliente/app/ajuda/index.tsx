import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";

import { useSession } from "../../src/auth/session";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  type Ticket,
  useMyTickets,
  whenLabel,
} from "../../src/data/support";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { BackHeader, Card, OutlineButton, PrimaryButton, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";

/**
 * Ajuda: os chamados da pessoa.
 *
 * Empilhada, não aba (R5): é um desvio do perfil, com começo e fim. Recarrega
 * ao ganhar foco porque não existe notificação — quem volta para cá depois de
 * responder ou de abrir um chamado precisa ver o estado novo sem truque.
 */
export default function Ajuda() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const { data, loading, error, reload } = useMyTickets(Boolean(session));

  useFocusEffect(
    useCallback(() => {
      if (session) reload();
    }, [session, reload]),
  );

  if (sessionLoading) {
    return (
      <Screen>
        <ScreenScroll gap={20}>
          <BackHeader title="Ajuda" onBack={() => router.back()} />
          <Shimmer width="100%" height={96} radius={18} />
        </ScreenScroll>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <ScreenScroll gap={20}>
          <BackHeader title="Ajuda" onBack={() => router.back()} />
          <Card radius={18} padding={20} style={{ gap: 9 }}>
            <Text style={sans(19, 800, { ls: -0.03 })}>Entre para falar com a gente</Text>
            <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
              O chamado fica ligado à sua conta: é por ele que a equipe responde e por ele que você
              acompanha a conversa.
            </Text>
          </Card>
          <PrimaryButton label="Entrar" height={54} onPress={() => router.push("/entrar")} />
        </ScreenScroll>
      </Screen>
    );
  }

  const tickets = data ?? [];

  return (
    <Screen>
      <ScreenScroll gap={20}>
        <BackHeader title="Ajuda" onBack={() => router.back()} />

        <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
          Conte o que aconteceu e a equipe do Vez responde por aqui mesmo. A resposta aparece nesta
          tela — ainda não enviamos aviso no celular.
        </Text>

        <PrimaryButton
          label="Abrir chamado"
          height={52}
          onPress={() => router.push("/ajuda/novo")}
        />

        {error ? (
          <Card radius={16} padding={15} style={{ gap: 11 }}>
            <Text style={sans(14, 500, { lh: 1.45, color: color.body })}>
              Não conseguimos carregar seus chamados.
            </Text>
            <OutlineButton label="Tentar de novo" height={42} onPress={reload} />
          </Card>
        ) : null}

        {loading ? (
          <View style={{ gap: 11 }}>
            <Shimmer width="100%" height={96} radius={18} />
            <Shimmer width="100%" height={96} radius={18} />
          </View>
        ) : null}

        {!loading && !error && tickets.length === 0 ? (
          <Card radius={18} padding={20} style={{ gap: 10 }}>
            <Text style={sans(18, 800, { ls: -0.03 })}>Nenhum chamado ainda</Text>
            <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
              Problema com uma reserva, com um pagamento ou com o app: abra um chamado e a gente
              responde.
            </Text>
          </Card>
        ) : null}

        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onPress={() => router.push(`/ajuda/${ticket.id}`)}
          />
        ))}
      </ScreenScroll>
    </Screen>
  );
}

function TicketCard({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  // Só destaca o que pede ação de quem está olhando: chamado esperando a equipe
  // não é urgência do cliente.
  const esperandoVoce = ticket.status === "waiting_customer";
  const resolvido = ticket.status === "resolved";

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card radius={18} padding={15} style={{ gap: 11, opacity: pressed ? 0.9 : 1 }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={mono(9.5, 600, { ls: 0.08, color: color.muted })}>
              #{String(ticket.number).padStart(4, "0")} · {CATEGORY_LABEL[ticket.category]}
            </Text>
            <Text
              style={mono(9, 600, {
                ls: 0.08,
                color: esperandoVoce ? color.coral : resolvido ? color.green : color.muted,
              })}
            >
              {STATUS_LABEL[ticket.status]}
            </Text>
          </View>

          <Text style={sans(15.5, 700, { ls: -0.02 })} numberOfLines={2}>
            {ticket.subject}
          </Text>

          {ticket.establishmentName ? (
            <Text style={mono(10, 400, { ls: 0.05, color: color.muted })} numberOfLines={1}>
              {ticket.establishmentName.toUpperCase()}
            </Text>
          ) : null}

          {ticket.preview ? (
            <Text style={sans(13.5, 400, { lh: 1.45, color: color.muted })} numberOfLines={2}>
              {ticket.lastMessageFromStaff ? "Equipe Vez: " : "Você: "}
              {ticket.preview}
            </Text>
          ) : null}

          <Text style={mono(9.5, 500, { ls: 0.06, color: color.chevron })}>
            {whenLabel(ticket.lastMessageAt)}
          </Text>
        </Card>
      )}
    </Pressable>
  );
}
