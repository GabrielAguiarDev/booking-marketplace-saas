import { mono, sans } from "@vez/mobile-kit/theme";
import { Star } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { useEstablishment } from "../src/data/establishment";
import {
  answerClarification,
  canReport,
  REPORT_REASONS,
  type Report,
  reportLabel,
  reportReview,
  type Review,
  useReviews,
} from "../src/data/reviews";
import { color } from "../src/theme/tokens";
import { Field } from "../src/ui/Field";
import {
  Card,
  EmptyState,
  ErrorNote,
  OutlineButton,
  Pill,
  PrimaryButton,
  SectionHeader,
  StatusTag,
  Tag,
} from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";
import { Sheet } from "../src/ui/Sheet";
import { useToast } from "../src/ui/Toast";

/**
 * As avaliações da loja, e o que fazer com uma que não deveria estar ali.
 *
 * Denunciar não é apagar: quem decide é a equipe da plataforma, e a tela diz
 * isso antes de o dono escrever qualquer coisa. Nota que some sob pressão do
 * estabelecimento não é nota — a regra está no banco desde a primeira migration
 * de avaliações, e aqui ela vira frase.
 *
 * A avaliação removida continua na lista, riscada e com o motivo da decisão. É
 * o único jeito de a loja ver o fim da história que ela mesma começou.
 */
export default function Avaliacoes() {
  const toast = useToast();
  const { establishment, isManager } = useEstablishment();
  const reviews = useReviews(establishment?.id ?? null);

  const [filter, setFilter] = useState<"all" | "reported">("all");
  const [reporting, setReporting] = useState<Review | null>(null);
  const [answering, setAnswering] = useState<Review | null>(null);

  const rows = reviews.data ?? [];
  const asked = rows.filter((row) => row.report?.status === "awaiting_establishment");
  const visible = filter === "all" ? rows : rows.filter((row) => row.report !== null);

  return (
    <Screen>
      <PlainHeader title="Avaliações" />

      {reviews.error ? <ErrorNote message={reviews.error} onRetry={reviews.reload} /> : null}

      <ScreenScroll bottom={40}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <Text style={mono(30, 600, { lh: 1 })}>
              {establishment?.rating_avg ? establishment.rating_avg.toFixed(1) : "—"}
            </Text>
            <Stars value={Math.round(establishment?.rating_avg ?? 0)} />
            <Text style={sans(12.5, 500, { color: color.muted })}>
              {establishment?.rating_count ?? 0}{" "}
              {establishment?.rating_count === 1 ? "avaliação" : "avaliações"}
            </Text>
          </View>

          {asked.length > 0 ? (
            <Card
              radius={14}
              padding={14}
              borderColor={color.amber}
              background={color.amberTint}
              style={{ gap: 4 }}
            >
              <Text style={sans(14, 700, { color: color.amberDeep })}>
                {asked.length === 1
                  ? "A equipe fez uma pergunta sobre uma denúncia sua"
                  : `A equipe fez ${asked.length} perguntas sobre denúncias suas`}
              </Text>
              <Text style={sans(12.5, 400, { lh: 1.45, color: color.amberDeep })}>
                Enquanto você não responde, a decisão fica parada.
              </Text>
            </Card>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pill label="Todas" active={filter === "all"} onPress={() => setFilter("all")} />
            <Pill
              label="Denunciadas"
              active={filter === "reported"}
              onPress={() => setFilter("reported")}
            />
          </View>
        </View>

        {reviews.loading ? (
          <Text
            style={[
              sans(13, 400, { color: color.muted }),
              { paddingHorizontal: 20, paddingTop: 24 },
            ]}
          >
            Carregando…
          </Text>
        ) : visible.length === 0 ? (
          <EmptyState
            glyph={<Star size={26} color={color.muted} strokeWidth={1.6} />}
            title={filter === "all" ? "Nenhuma avaliação ainda" : "Nenhuma denúncia"}
            body={
              filter === "all"
                ? "Quem é atendido pelo app avalia depois que você conclui o atendimento."
                : "Você ainda não pediu a revisão de nenhuma avaliação."
            }
          />
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 12 }}>
            <SectionHeader label="Do cliente" count={visible.length} />
            {visible.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                isManager={isManager}
                onReport={() => setReporting(review)}
                onAnswer={() => setAnswering(review)}
              />
            ))}
          </View>
        )}

        {!isManager ? (
          <Text
            style={[
              sans(12.5, 400, { lh: 1.5, color: color.muted }),
              { paddingHorizontal: 20, paddingTop: 20 },
            ]}
          >
            Seu acesso é de equipe: você lê as avaliações, mas quem pede revisão à plataforma é o
            dono ou a gerência.
          </Text>
        ) : null}
      </ScreenScroll>

      <ReportSheet
        review={reporting}
        onClose={() => setReporting(null)}
        onDone={(message) => {
          setReporting(null);
          toast(message);
          reviews.reload();
        }}
      />

      <AnswerSheet
        review={answering}
        onClose={() => setAnswering(null)}
        onDone={(message) => {
          setAnswering(null);
          toast(message);
          reviews.reload();
        }}
      />
    </Screen>
  );
}

function ReviewCard({
  review,
  isManager,
  onReport,
  onAnswer,
}: {
  review: Review;
  isManager: boolean;
  onReport: () => void;
  onAnswer: () => void;
}) {
  return (
    <Card radius={15} padding={15} style={{ gap: 11 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Stars value={review.rating} />
        <View style={{ flex: 1 }} />
        <Text style={mono(11, 500, { color: color.muted })}>{day(review.createdAt)}</Text>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={sans(14, 700)}>{review.author}</Text>
        <Text style={sans(12, 500, { color: color.muted })}>
          {review.service} · {review.professional}
        </Text>
      </View>

      {review.comment ? (
        <Text
          style={sans(13.5, 400, {
            lh: 1.5,
            color: review.removed ? color.faint : color.ink,
          })}
        >
          {review.comment}
        </Text>
      ) : null}

      {review.tags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {review.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </View>
      ) : null}

      {review.report ? (
        <ReportBlock report={review.report} isManager={isManager} onAnswer={onAnswer} />
      ) : null}

      {isManager && canReport(review) ? (
        <OutlineButton label="Pedir revisão à plataforma" height={42} onPress={onReport} />
      ) : null}
    </Card>
  );
}

/** O que aconteceu com a denúncia, do pedido até a decisão. */
function ReportBlock({
  report,
  isManager,
  onAnswer,
}: {
  report: Report;
  isManager: boolean;
  onAnswer: () => void;
}) {
  const { label, tone } = reportLabel(report);
  const tint =
    tone === "ask"
      ? color.amberDeep
      : tone === "ok"
        ? color.greenDeep
        : tone === "bad"
          ? color.danger
          : color.muted;
  const background =
    tone === "ask"
      ? color.amberTint
      : tone === "ok"
        ? color.greenTint
        : tone === "bad"
          ? color.dangerTint
          : color.rest;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: color.lineSoft,
        paddingTop: 11,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <StatusTag label={label} tint={tint} background={background} />
        <Text style={mono(10.5, 500, { color: color.muted })}>{day(report.openedAt)}</Text>
      </View>

      <Text style={sans(12.5, 600, { color: color.muted })}>{report.reason}</Text>

      {report.clarificationRequest ? (
        <View style={{ backgroundColor: color.rest, borderRadius: 11, padding: 12, gap: 5 }}>
          <Text style={sans(11, 700, { ls: 1.1 / 11, color: color.muted })}>
            A EQUIPE PERGUNTOU
          </Text>
          <Text style={sans(13, 400, { lh: 1.5 })}>{report.clarificationRequest}</Text>
          {report.clarificationAnswer ? (
            <>
              <Text style={[sans(11, 700, { ls: 1.1 / 11, color: color.muted }), { marginTop: 6 }]}>
                VOCÊ RESPONDEU
              </Text>
              <Text style={sans(13, 400, { lh: 1.5, color: color.muted })}>
                {report.clarificationAnswer}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {report.status === "awaiting_establishment" && isManager ? (
        <PrimaryButton label="Responder à equipe" height={44} onPress={onAnswer} />
      ) : null}

      {report.decisionMotive ? (
        <View style={{ gap: 3 }}>
          <Text style={sans(12.5, 600)}>
            Decisão da plataforma: {report.decisionMotive.toLowerCase()}
          </Text>
          {report.decisionNote ? (
            <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>
              {report.decisionNote}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ReportSheet({
  review,
  onClose,
  onDone,
}: {
  review: Review | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  // O erro mora dentro da folha, e não num toast: a folha cobre a tela inteira,
  // e a mensagem apareceria atrás dela.
  const [failure, setFailure] = useState<string | null>(null);

  async function submit() {
    if (!review) return;
    setBusy(true);
    const result = await reportReview({ reviewId: review.id, reason, justification });
    setBusy(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setJustification("");
    setReason(REPORT_REASONS[0]);
    setFailure(null);
    onDone("Denúncia enviada. A equipe responde por aqui.");
  }

  return (
    <Sheet
      visible={review !== null}
      onClose={onClose}
      title="Pedir revisão"
      subtitle="Quem decide é a equipe da plataforma, não a loja. Escolha o critério e conte o que houve — a equipe pode voltar com uma pergunta antes de decidir."
    >
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {REPORT_REASONS.map((item) => (
            <Pill
              key={item}
              label={item}
              size="sm"
              active={reason === item}
              onPress={() => {
                setReason(item);
                setFailure(null);
              }}
            />
          ))}
        </View>

        <Field
          label="O que houve"
          placeholder="Data, quem atendeu, o que foi dito — o que ajudar a equipe a decidir."
          value={justification}
          onChangeText={(next) => {
            setJustification(next);
            setFailure(null);
          }}
          error={failure}
          multiline
        />

        <PrimaryButton
          label={busy ? "Enviando…" : "Enviar para a equipe"}
          height={52}
          disabled={busy || justification.trim().length < 20}
          onPress={submit}
        />
      </View>
    </Sheet>
  );
}

function AnswerSheet({
  review,
  onClose,
  onDone,
}: {
  review: Review | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit() {
    if (!review?.report) return;
    setBusy(true);
    const result = await answerClarification(review.report.id, answer);
    setBusy(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setAnswer("");
    setFailure(null);
    onDone("Resposta enviada. A denúncia voltou para a equipe.");
  }

  return (
    <Sheet
      visible={review !== null}
      onClose={onClose}
      title="Responder à equipe"
      subtitle={review?.report?.clarificationRequest ?? ""}
    >
      <View style={{ gap: 14 }}>
        <Field
          label="Sua resposta"
          placeholder="Responda o que foi perguntado."
          value={answer}
          onChangeText={(next) => {
            setAnswer(next);
            setFailure(null);
          }}
          error={failure}
          multiline
        />
        <PrimaryButton
          label={busy ? "Enviando…" : "Enviar resposta"}
          height={52}
          disabled={busy || answer.trim().length < 10}
          onPress={submit}
        />
      </View>
    </Sheet>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          size={14}
          strokeWidth={1.8}
          color={index <= value ? color.amber : color.track}
          fill={index <= value ? color.amber : "transparent"}
        />
      ))}
    </View>
  );
}

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "12 SET" — a lista é de meses, não de minutos. */
function day(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]}`;
}
