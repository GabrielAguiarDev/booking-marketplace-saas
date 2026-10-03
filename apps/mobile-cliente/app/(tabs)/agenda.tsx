import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, Alert, Pressable, Text, View } from "react-native";

import { useSession } from "../../src/auth/session";
import {
  type AppointmentRow,
  cancelAppointment,
  useAppointments,
} from "../../src/data/appointments";
import { accentOf, initialsOfName, shade } from "../../src/data/catalog";
import { useCovers } from "../../src/data/photos";
import { useMyQueueEntry } from "../../src/data/queue";
import { hourMinute, money, slotLabel } from "@vez/mobile-kit/format";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { duo2, Photo } from "../../src/ui/Photo";
import { Card, OutlineButton, PrimaryButton, Segmented, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { ErrorState } from "../../src/ui/States";

type AgendaTab = "prox" | "fila" | "hist";

const TABS = [
  { key: "prox", label: "PRÓXIMOS" },
  { key: "fila", label: "NA FILA" },
  { key: "hist", label: "HISTÓRICO" },
];

/**
 * O que acabou de acontecer, dito por quem mandou a pessoa para cá.
 *
 * "Pedido" e "confirmada" são coisas diferentes e a diferença é da loja: com
 * aprovação manual a reserva nasce esperando o sim dela. Dizer "confirmada"
 * nos dois casos faria alguém sair de casa para um horário que a loja recusou.
 */
const AVISOS: Record<string, { titulo: string; texto: string }> = {
  confirmada: {
    titulo: "Reserva confirmada",
    texto: "Seu horário está garantido. Ele aparece aqui em Próximos.",
  },
  pedido: {
    titulo: "Pedido enviado",
    texto: "A loja ainda vai confirmar este horário. A resposta aparece aqui em Próximos.",
  },
  "sinal-pago": {
    titulo: "Pagamento confirmado",
    texto: "Recebemos o pagamento. Sua reserva aparece aqui em Próximos.",
  },
  "sinal-pendente": {
    titulo: "Reserva feita, pagamento pendente",
    texto: "Abra a reserva em Próximos para pagar pelo app, por Pix ou cartão.",
  },
  avaliada: {
    titulo: "Avaliação enviada",
    texto: "Obrigado. Ela ajuda outras pessoas a escolher.",
  },
};

export default function Agenda() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [tab, setTab] = useState<AgendaTab>("prox");
  const params = useLocalSearchParams<{ reservada?: string; avaliada?: string }>();
  const aviso = AVISOS[params.reservada ?? (params.avaliada ? "avaliada" : "")] ?? null;

  useEffect(() => {
    if (aviso) AccessibilityInfo.announceForAccessibility(`${aviso.titulo}. ${aviso.texto}`);
  }, [aviso]);

  const { data, loading: loadingAppointments, error, reload } = useAppointments(Boolean(session));
  const { data: queueEntry, reload: reloadQueue } = useMyQueueEntry(Boolean(session));
  const covers = useCovers(
    [...(data?.upcoming ?? []), ...(data?.history ?? [])].map((item) => item.establishments.id),
  );

  // Voltar do detalhe (remarcou, cancelou, avaliou) precisa refletir aqui.
  useFocusEffect(
    useCallback(() => {
      if (session) void reload();
    }, [session, reload]),
  );

  // Aba, não tela empilhada: aqui não se redireciona. Trocar o conteúdo por um
  // convite deixa a barra inferior intacta e o usuário decide se quer entrar.
  if (loading) {
    return (
      <Screen>
        <ScreenScroll gap={22}>
          <Text accessibilityRole="header" style={sans(30, 800, { ls: -0.04 })}>
            Agenda
          </Text>
        </ScreenScroll>
      </Screen>
    );
  }
  if (!session) return <AgendaDeslogada onEntrar={() => router.push("/entrar")} />;

  return (
    <Screen>
      <ScreenScroll gap={20} onRefresh={() => Promise.all([reload(), reloadQueue()])}>
        <Text accessibilityRole="header" style={sans(30, 800, { ls: -0.04 })}>
          Agenda
        </Text>

        {aviso ? (
          <Card
            radius={16}
            padding={15}
            style={{
              flexDirection: "row",
              gap: 12,
              alignItems: "flex-start",
              backgroundColor: color.greenTint,
              borderColor: color.greenTint,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={sans(15, 700, { ls: -0.02, color: color.greenDeep })}>
                {aviso.titulo}
              </Text>
              <Text style={sans(13.5, 400, { lh: 1.45, color: color.greenDeep })}>
                {aviso.texto}
              </Text>
            </View>
            <Pressable
              onPress={() => router.setParams({ reservada: undefined, avaliada: undefined })}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Dispensar aviso"
            >
              <X size={18} color={color.greenDeep} strokeWidth={2} />
            </Pressable>
          </Card>
        ) : null}

        <Segmented items={TABS} value={tab} onChange={(key) => setTab(key as AgendaTab)} />

        {tab === "prox" ? (
          loadingAppointments ? (
            <Carregando />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} what="sua agenda" />
          ) : !data || data.upcoming.length === 0 ? (
            <Vazio
              titulo="Nada marcado"
              texto="Quando você reservar um horário, ele aparece aqui."
              acao="Explorar lojas"
              onAcao={() => router.push("/explorar")}
            />
          ) : (
            data.upcoming.map((item) => (
              <ReservaCard
                key={item.id}
                item={item}
                coverUrl={covers.get(item.establishments.id) ?? null}
                onChanged={reload}
              />
            ))
          )
        ) : null}

        {tab === "fila" ? (
          queueEntry ? (
            <Card radius={18} padding={16} style={{ gap: 13 }}>
              <Text style={mono(9.5, 600, { ls: 0.1, color: color.greenDeep })}>
                AO VIVO · NA FILA
              </Text>
              <Text style={sans(18, 800, { ls: -0.03 })}>{queueEntry.establishments.name}</Text>
              <Text style={mono(10.5, 400, { ls: 0.05, color: color.muted })}>
                ENTROU ÀS {hourMinute(queueEntry.joined_at)}
              </Text>
              <PrimaryButton
                label="Ver fila"
                height={46}
                onPress={() =>
                  router.push({ pathname: "/fila", params: { id: queueEntry.establishment_id } })
                }
              />
            </Card>
          ) : (
            <Vazio
              titulo="Você não está em nenhuma fila"
              texto="Lojas que atendem por ordem de chegada mostram o botão de entrar na fila."
            />
          )
        ) : null}

        {tab === "hist" ? (
          loadingAppointments ? (
            <Carregando />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} what="seu histórico" />
          ) : !data || data.history.length === 0 ? (
            <Vazio titulo="Sem histórico" texto="Seus atendimentos concluídos ficam aqui." />
          ) : (
            data.history.map((item) => (
              <ReservaCard
                key={item.id}
                item={item}
                historico
                coverUrl={covers.get(item.establishments.id) ?? null}
                onChanged={reload}
              />
            ))
          )
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

const STATUS_LABEL: Record<string, string> = {
  // `scheduled` é o pedido esperando o sim da loja; só `confirmed` é garantido.
  scheduled: "AGUARDANDO A LOJA",
  confirmed: "CONFIRMADO",
  completed: "ATENDIDO",
  cancelled_by_customer: "CANCELADO POR VOCÊ",
  cancelled_by_establishment: "CANCELADO PELA LOJA",
  no_show: "NÃO COMPARECEU",
};

function ReservaCard({
  item,
  historico = false,
  coverUrl,
  onChanged,
}: {
  item: AppointmentRow;
  historico?: boolean;
  coverUrl: string | null;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const accent = accentOf(item.establishments);
  const podeCancelar = ["scheduled", "confirmed"].includes(item.status) && !historico;
  const jaAvaliou = item.reviews !== null;
  const podeAvaliar = item.status === "completed" && !jaAvaliou;

  // Cancelar libera o horário para outra pessoa na hora: não pode ser um toque
  // acidental no cartão.
  function confirmarCancelamento() {
    Alert.alert("Cancelar reserva?", `${item.establishments.name} · ${slotLabel(item.starts_at)}`, [
      { text: "Manter", style: "cancel" },
      { text: "Cancelar reserva", style: "destructive", onPress: () => void cancelar() },
    ]);
  }

  async function cancelar() {
    setBusy(true);
    const result = await cancelAppointment(item.id);
    setBusy(false);

    if (!result.ok) {
      setAviso(result.message ?? "Não foi possível cancelar.");
      return;
    }
    if (!result.withinFreeWindow) {
      setAviso("Cancelado fora do prazo. A loja pode cobrar pelo horário.");
    }
    onChanged();
  }

  return (
    <Card radius={18} padding={15} style={{ gap: 13 }}>
      {/* O topo do cartão abre o detalhe: é lá que ficam remarcar, política
          da loja e o endereço. */}
      <Pressable
        onPress={() => router.push(`/reserva/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Detalhes da reserva em ${item.establishments.name}`}
        style={{ flexDirection: "row", gap: 13, alignItems: "center" }}
      >
        <Photo
          duotone={duo2(shade(accent, -0.4), shade(accent, 0.35))}
          size={50}
          radius={15}
          mono={initialsOfName(item.establishments.name)}
          monoSize={14}
          center
          uri={coverUrl}
          alt={`Foto de ${item.establishments.name}`}
        />
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={sans(15.5, 700, { ls: -0.02 })} numberOfLines={1}>
            {item.establishments.name}
          </Text>
          <Text style={mono(10, 400, { ls: 0.05, color: color.muted })} numberOfLines={1}>
            {item.services.name.toUpperCase()} · {item.professionals.display_name.toUpperCase()}
          </Text>
        </View>
        <Text style={sans(17, 400, { lh: 1, color: color.chevron })}>›</Text>
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderTopWidth: 1,
          borderTopColor: color.lineSoft,
          paddingTop: 12,
        }}
      >
        <Text style={mono(11.5, 600)}>{slotLabel(item.starts_at)}</Text>
        <Text style={mono(9, 600, { ls: 0.08, color: color.muted })}>
          {STATUS_LABEL[item.status] ?? item.status.toUpperCase()}
        </Text>
      </View>

      <Text style={mono(11, 500, { color: color.muted })}>{money(item.price_cents)}</Text>

      {aviso ? (
        <Text style={sans(12.5, 500, { lh: 1.4, color: color.amberDeep })}>{aviso}</Text>
      ) : null}

      {podeCancelar ? (
        <View style={{ flexDirection: "row", gap: 9 }}>
          <OutlineButton
            label="Remarcar"
            height={42}
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: "/reserva/remarcar", params: { id: item.id } })}
          />
          <OutlineButton
            label={busy ? "Cancelando…" : "Cancelar"}
            height={42}
            style={{ flex: 1 }}
            onPress={busy ? undefined : confirmarCancelamento}
          />
        </View>
      ) : null}

      {podeAvaliar ? (
        <PrimaryButton
          label="Avaliar atendimento"
          height={42}
          background={accent}
          onPress={() =>
            router.push({ pathname: "/avaliacao", params: { appointmentId: item.id } })
          }
        />
      ) : null}

      {jaAvaliou ? (
        <Text style={mono(9.5, 600, { ls: 0.08, color: color.green })}>VOCÊ JÁ AVALIOU</Text>
      ) : null}

      {/* Problema com uma reserva é o chamado mais provável do cliente, e é
          aqui que ele está olhando. O chamado já nasce ligado à loja e com o
          assunto escrito — quem abre só precisa contar o que houve. */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/ajuda/novo",
            params: {
              establishmentId: item.establishments.id,
              establishmentName: item.establishments.name,
              category: "booking",
              subject: `Reserva de ${slotLabel(item.starts_at)}`,
            },
          })
        }
        hitSlop={12}
        accessibilityRole="button"
      >
        <Text style={sans(13, 600, { color: color.muted })}>Preciso de ajuda com esta reserva</Text>
      </Pressable>
    </Card>
  );
}

function Carregando() {
  return (
    <View style={{ gap: 11 }}>
      <Shimmer width="100%" height={120} radius={18} />
      <Shimmer width="100%" height={120} radius={18} />
    </View>
  );
}

function Vazio({
  titulo,
  texto,
  acao,
  onAcao,
}: {
  titulo: string;
  texto: string;
  acao?: string;
  onAcao?: () => void;
}) {
  return (
    <Card radius={18} padding={20} style={{ gap: 10 }}>
      <Text style={sans(18, 800, { ls: -0.03 })}>{titulo}</Text>
      <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>{texto}</Text>
      {acao && onAcao ? (
        <Pressable
          onPress={onAcao}
          hitSlop={12}
          accessibilityRole="button"
          style={{ marginTop: 4, alignSelf: "flex-start" }}
        >
          <Text style={sans(14, 700, { color: color.coral })}>{acao}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function AgendaDeslogada({ onEntrar }: { onEntrar: () => void }) {
  return (
    <Screen>
      <ScreenScroll gap={22}>
        <Text style={sans(30, 800, { ls: -0.04 })}>Agenda</Text>
        <Card radius={18} padding={20} style={{ gap: 9 }}>
          <Text style={sans(19, 800, { ls: -0.03 })}>Sua agenda fica aqui</Text>
          <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
            Entre para ver seus horários marcados, sua posição na fila e o histórico de
            atendimentos.
          </Text>
        </Card>
        <PrimaryButton label="Entrar" height={54} onPress={onEntrar} />
      </ScreenScroll>
    </Screen>
  );
}
