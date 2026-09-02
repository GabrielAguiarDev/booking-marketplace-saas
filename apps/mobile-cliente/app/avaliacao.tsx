import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { supabase } from "../lib/supabase";
import { AuthGate } from "../src/auth/AuthGate";
import { useSession } from "../src/auth/session";
import { useAppointments } from "../src/data/appointments";
import { accentOf } from "../src/data/catalog";
import { slotLabel } from "../src/format";
import { useGoToTab } from "../src/navigation";
import { color, radius } from "../src/theme/tokens";
import { mono, sans } from "../src/theme/type";
import { BackHeader, Card, Chip, Label, PrimaryButton, StickyFooter } from "../src/ui/primitives";
import { Screen, ScreenScroll } from "../src/ui/Screen";

const TAGS = ["Pontualidade", "Higiene", "Preço justo", "Atendimento", "Resultado"];
const RATING_LABELS = ["", "RUIM", "ABAIXO", "OK", "BOM", "EXCELENTE"];

function AvaliacaoConteudo() {
  const router = useRouter();
  const goToTab = useGoToTab();
  const { user } = useSession();
  const { appointmentId } = useLocalSearchParams<{ appointmentId?: string }>();

  const { data } = useAppointments(true);
  const appointment =
    data?.history.find((item) => item.id === appointmentId) ??
    data?.upcoming.find((item) => item.id === appointmentId) ??
    null;

  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accent = accentOf(appointment?.establishments ?? null);

  async function enviar() {
    if (!appointment || !user) return;

    setBusy(true);
    setError(null);

    const { error: insertError } = await supabase.from("reviews").insert({
      establishment_id: appointment.establishments.id,
      appointment_id: appointment.id,
      customer_id: user.id,
      professional_id: appointment.professionals.id,
      rating,
      comment: comment.trim() || null,
      tags,
    });

    setBusy(false);

    if (insertError) {
      // 23505: já existe avaliação para este atendimento (unique em
      // appointment_id). 42501: a política recusou — atendimento não concluído.
      setError(
        insertError.code === "23505"
          ? "Você já avaliou este atendimento."
          : insertError.code === "42501"
            ? "Só é possível avaliar depois do atendimento concluído."
            : "Não foi possível enviar sua avaliação.",
      );
      return;
    }

    goToTab("/(tabs)/agenda");
  }

  if (!appointment) {
    return (
      <Screen>
        <ScreenScroll gap={16}>
          <BackHeader title="Avaliar" onBack={() => router.back()} />
          <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
            Não encontramos esse atendimento. Avalie a partir da sua agenda.
          </Text>
          <PrimaryButton label="Voltar" height={50} onPress={() => router.back()} />
        </ScreenScroll>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenScroll gap={24}>
        <BackHeader title="Como foi?" onBack={() => router.back()} />

        <View style={{ gap: 5 }}>
          <Text style={sans(21, 800, { ls: -0.03 })}>{appointment.establishments.name}</Text>
          <Text style={mono(10.5, 400, { ls: 0.05, color: color.muted })}>
            {appointment.services.name.toUpperCase()} ·{" "}
            {slotLabel(appointment.starts_at).toUpperCase()}
          </Text>
        </View>

        <View style={{ gap: 12, alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable key={value} onPress={() => setRating(value)} hitSlop={6}>
                <Text style={sans(34, 400, { color: value <= rating ? accent : color.dotIdle })}>
                  ★
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={mono(10, 600, { ls: 0.1, color: color.muted })}>
            {RATING_LABELS[rating]}
          </Text>
        </View>

        <View style={{ gap: 11 }}>
          <Label>O QUE SE DESTACOU</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                active={tags.includes(tag)}
                onPress={() =>
                  setTags((prev) =>
                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 11 }}>
          <Label>COMENTÁRIO (OPCIONAL)</Label>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Conte como foi o atendimento."
            placeholderTextColor={color.chevron}
            multiline
            maxLength={600}
            style={[
              sans(15, 400, { lh: 1.45 }),
              {
                minHeight: 110,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: color.line,
                padding: 15,
                textAlignVertical: "top",
              },
            ]}
          />
        </View>

        {error ? (
          <Card radius={14} padding={14}>
            <Text style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>{error}</Text>
          </Card>
        ) : null}
      </ScreenScroll>

      <StickyFooter bottomInset={0}>
        <PrimaryButton
          label={busy ? "Enviando…" : "Enviar avaliação"}
          height={54}
          background={busy ? color.chevron : accent}
          onPress={busy ? undefined : enviar}
        />
      </StickyFooter>
    </Screen>
  );
}

/** Exige conta: avaliacao cria compromisso com o estabelecimento. */
export default function Avaliacao() {
  return (
    <AuthGate>
      <AvaliacaoConteudo />
    </AuthGate>
  );
}
