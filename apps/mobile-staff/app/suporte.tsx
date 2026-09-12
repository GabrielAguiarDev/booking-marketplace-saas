import { mono, sans } from "@vez/mobile-kit/theme";
import { useRouter } from "expo-router";
import { LifeBuoy } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useAppointments } from "../src/data/appointments";
import { useEstablishment } from "../src/data/establishment";
import {
  CATEGORY_LABEL,
  openTicket,
  stamp,
  STATUS_LABEL,
  type Ticket,
  type TicketCategory,
  TICKET_CATEGORIES,
  useTickets,
} from "../src/data/support";
import { color } from "../src/theme/tokens";
import { Field } from "../src/ui/Field";
import {
  Card,
  EmptyState,
  ErrorNote,
  Pill,
  PrimaryButton,
  SectionHeader,
  StatusTag,
} from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";
import { Sheet } from "../src/ui/Sheet";
import { useToast } from "../src/ui/Toast";

/**
 * Ajuda e suporte.
 *
 * O chamado é da loja, não da pessoa que abriu: qualquer membro acompanha e
 * responde, porque quem abriu pode estar de folga quando a equipe voltar. Isso
 * é a política `support_tickets_select_member`, e a tela diz isso em uma linha.
 *
 * Citar uma reserva é opcional e vira a primeira linha da mensagem. Não existe
 * campo de reserva no chamado, e inventar um só para isso deixaria o suporte da
 * plataforma com dois lugares para procurar o mesmo atendimento.
 */
export default function Suporte() {
  const router = useRouter();
  const toast = useToast();
  const { establishment } = useEstablishment();
  const tickets = useTickets(establishment?.id ?? null);

  const [opening, setOpening] = useState(false);

  const rows = tickets.data ?? [];
  const waiting = rows.filter((row) => row.status !== "resolved");
  const done = rows.filter((row) => row.status === "resolved");

  return (
    <Screen>
      <PlainHeader
        title="Ajuda e suporte"
        action="Abrir chamado"
        onAction={() => setOpening(true)}
      />

      {tickets.error ? <ErrorNote message={tickets.error} onRetry={tickets.reload} /> : null}

      <ScreenScroll bottom={40}>
        <Text
          style={[
            sans(13.5, 400, { lh: 1.5, color: color.muted }),
            { paddingHorizontal: 20, paddingTop: 16 },
          ]}
        >
          O chamado é da loja: qualquer pessoa da equipe vê a conversa e pode responder. A resposta
          chega aqui — não por e-mail nem por push, que ainda não existem.
        </Text>

        {tickets.loading ? (
          <Text
            style={[
              sans(13, 400, { color: color.muted }),
              { paddingHorizontal: 20, paddingTop: 24 },
            ]}
          >
            Carregando…
          </Text>
        ) : rows.length === 0 ? (
          <EmptyState
            glyph={<LifeBuoy size={26} color={color.muted} strokeWidth={1.6} />}
            title="Nenhum chamado aberto"
            body="Cobrança errada, cliente que não consegue reservar, algo fora do lugar no app — abra um chamado e a equipe responde por aqui."
            action="Abrir chamado"
            onAction={() => setOpening(true)}
          />
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 12 }}>
            {waiting.length > 0 ? (
              <>
                <SectionHeader label="Em andamento" count={waiting.length} />
                {waiting.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onPress={() => router.push(`/chamado/${ticket.id}`)}
                  />
                ))}
              </>
            ) : null}

            {done.length > 0 ? (
              <>
                <View style={{ marginTop: waiting.length > 0 ? 10 : 0 }}>
                  <SectionHeader label="Resolvidos" count={done.length} />
                </View>
                {done.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onPress={() => router.push(`/chamado/${ticket.id}`)}
                  />
                ))}
              </>
            ) : null}
          </View>
        )}
      </ScreenScroll>

      <NewTicketSheet
        visible={opening}
        establishmentId={establishment?.id ?? null}
        onClose={() => setOpening(false)}
        onDone={(id, number) => {
          setOpening(false);
          tickets.reload();
          toast(`Chamado #${number} aberto.`);
          router.push(`/chamado/${id}`);
        }}
      />
    </Screen>
  );
}

function TicketCard({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  const tone =
    ticket.status === "resolved"
      ? { tint: color.greenDeep, background: color.greenTint }
      : ticket.status === "waiting_customer"
        ? { tint: color.coralDeep, background: color.coralTint }
        : { tint: color.muted, background: color.rest };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card radius={15} padding={15} style={{ gap: 9 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <StatusTag
            label={STATUS_LABEL[ticket.status]}
            tint={tone.tint}
            background={tone.background}
          />
          <View style={{ flex: 1 }} />
          <Text style={mono(11, 500, { color: color.muted })}>#{ticket.number}</Text>
        </View>
        <Text style={sans(15, 700)}>{ticket.subject}</Text>
        <Text style={sans(12, 500, { color: color.muted })}>
          {CATEGORY_LABEL[ticket.category]} · {stamp(ticket.lastMessageAt)}
          {ticket.lastMessageFromStaff && ticket.status !== "resolved"
            ? " · a equipe respondeu"
            : ""}
        </Text>
      </Card>
    </Pressable>
  );
}

function NewTicketSheet({
  visible,
  establishmentId,
  onClose,
  onDone,
}: {
  visible: boolean;
  establishmentId: string | null;
  onClose: () => void;
  onDone: (id: string, number: number) => void;
}) {
  const [category, setCategory] = useState<TicketCategory>("booking");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Erro dentro da folha: a folha cobre a tela, e o toast ficaria atrás dela.
  const [failure, setFailure] = useState<string | null>(null);

  // Os últimos dias bastam: o que se leva ao suporte é o que acabou de dar
  // errado, e uma lista de trinta dias vira rolagem em vez de atalho.
  const range = useMemo(() => {
    const to = new Date();
    to.setDate(to.getDate() + 1);
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const recent = useAppointments(visible ? establishmentId : null, range.from, range.to);
  const cited = (recent.data ?? []).find((item) => item.id === appointmentId) ?? null;

  async function submit() {
    if (!establishmentId) return;
    const line = cited
      ? `Reserva citada: ${cited.serviceName} · ${stamp(cited.startsAt)} · ${cited.name}\n\n`
      : "";

    setBusy(true);
    const result = await openTicket({
      subject,
      body: `${line}${body}`,
      category,
      establishmentId,
    });
    setBusy(false);

    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setSubject("");
    setBody("");
    setAppointmentId(null);
    setFailure(null);
    onDone(result.value.id, result.value.number);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Abrir chamado"
      subtitle="A equipe responde dentro do app, na conversa do chamado."
    >
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {TICKET_CATEGORIES.map((item) => (
            <Pill
              key={item.key}
              label={item.label}
              size="sm"
              active={category === item.key}
              onPress={() => setCategory(item.key)}
            />
          ))}
        </View>

        <Field
          label="Assunto"
          placeholder="Em poucas palavras"
          value={subject}
          onChangeText={setSubject}
          maxLength={120}
        />

        <Field
          label="O que aconteceu"
          placeholder="Conte com detalhe: o que você esperava e o que apareceu."
          value={body}
          onChangeText={(next) => {
            setBody(next);
            setFailure(null);
          }}
          error={failure}
          multiline
        />

        {(recent.data ?? []).length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={sans(11, 700, { ls: 1.1 / 11, color: color.muted })}>
              CITAR UMA RESERVA (OPCIONAL)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              <Pill
                label="Nenhuma"
                size="sm"
                active={appointmentId === null}
                onPress={() => setAppointmentId(null)}
              />
              {(recent.data ?? []).slice(0, 8).map((item) => (
                <Pill
                  key={item.id}
                  label={`${item.name.split(" ")[0]} · ${stamp(item.startsAt).replace(" · ", " ")}`}
                  size="sm"
                  active={appointmentId === item.id}
                  onPress={() => setAppointmentId(item.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <PrimaryButton
          label={busy ? "Abrindo…" : "Abrir chamado"}
          height={52}
          disabled={busy || subject.trim().length < 3 || body.trim().length === 0}
          onPress={submit}
        />
      </View>
    </Sheet>
  );
}
