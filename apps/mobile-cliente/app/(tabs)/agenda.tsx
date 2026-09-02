import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useSession } from "../../src/auth/session";
import {
  type AppointmentRow,
  cancelAppointment,
  useAppointments,
} from "../../src/data/appointments";
import { accentOf, initialsOfName, shade } from "../../src/data/catalog";
import { useMyQueueEntry } from "../../src/data/queue";
import { hourMinute, money, slotLabel } from "../../src/format";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "../../src/theme/type";
import { duo2, Photo } from "../../src/ui/Photo";
import { Card, OutlineButton, PrimaryButton, Segmented, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";

type AgendaTab = "prox" | "fila" | "hist";

const TABS = [
  { key: "prox", label: "PRÓXIMOS" },
  { key: "fila", label: "NA FILA" },
  { key: "hist", label: "HISTÓRICO" },
];

export default function Agenda() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [tab, setTab] = useState<AgendaTab>("prox");

  const { data, loading: loadingAppointments, reload } = useAppointments(Boolean(session));
  const { data: queueEntry } = useMyQueueEntry(Boolean(session));

  // Aba, não tela empilhada: aqui não se redireciona. Trocar o conteúdo por um
  // convite deixa a barra inferior intacta e o usuário decide se quer entrar.
  if (loading) {
    return (
      <Screen>
        <ScreenScroll gap={22}>
          <Text style={sans(30, 800, { ls: -0.04 })}>Agenda</Text>
        </ScreenScroll>
      </Screen>
    );
  }
  if (!session) return <AgendaDeslogada onEntrar={() => router.push("/entrar")} />;

  return (
    <Screen>
      <ScreenScroll gap={20}>
        <Text style={sans(30, 800, { ls: -0.04 })}>Agenda</Text>
        <Segmented items={TABS} value={tab} onChange={(key) => setTab(key as AgendaTab)} />

        {tab === "prox" ? (
          loadingAppointments ? (
            <Carregando />
          ) : !data || data.upcoming.length === 0 ? (
            <Vazio
              titulo="Nada marcado"
              texto="Quando você reservar um horário, ele aparece aqui."
              acao="Explorar lojas"
              onAcao={() => router.push("/explorar")}
            />
          ) : (
            data.upcoming.map((item) => (
              <ReservaCard key={item.id} item={item} onChanged={reload} />
            ))
          )
        ) : null}

        {tab === "fila" ? (
          queueEntry ? (
            <Card radius={18} padding={16} style={{ gap: 13 }}>
              <Text style={mono(9.5, 600, { ls: 0.1, color: color.green })}>AO VIVO · NA FILA</Text>
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
          ) : !data || data.history.length === 0 ? (
            <Vazio titulo="Sem histórico" texto="Seus atendimentos concluídos ficam aqui." />
          ) : (
            data.history.map((item) => (
              <ReservaCard key={item.id} item={item} historico onChanged={reload} />
            ))
          )
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "AGENDADO",
  confirmed: "CONFIRMADO",
  completed: "ATENDIDO",
  cancelled_by_customer: "CANCELADO POR VOCÊ",
  cancelled_by_establishment: "CANCELADO PELA LOJA",
  no_show: "NÃO COMPARECEU",
};

function ReservaCard({
  item,
  historico = false,
  onChanged,
}: {
  item: AppointmentRow;
  historico?: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const accent = accentOf(item.establishments);
  const podeCancelar = ["scheduled", "confirmed"].includes(item.status) && !historico;
  const jaAvaliou = item.reviews.length > 0;
  const podeAvaliar = item.status === "completed" && !jaAvaliou;

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
      <View style={{ flexDirection: "row", gap: 13, alignItems: "center" }}>
        <Photo
          duotone={duo2(shade(accent, -0.4), shade(accent, 0.35))}
          size={50}
          radius={15}
          mono={initialsOfName(item.establishments.name)}
          monoSize={14}
          center
        />
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={sans(15.5, 700, { ls: -0.02 })} numberOfLines={1}>
            {item.establishments.name}
          </Text>
          <Text style={mono(10, 400, { ls: 0.05, color: color.muted })} numberOfLines={1}>
            {item.services.name.toUpperCase()} · {item.professionals.display_name.toUpperCase()}
          </Text>
        </View>
      </View>

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
        <OutlineButton
          label={busy ? "Cancelando…" : "Cancelar reserva"}
          height={42}
          onPress={busy ? undefined : cancelar}
        />
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
        <Pressable onPress={onAcao} hitSlop={8} style={{ marginTop: 4 }}>
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
