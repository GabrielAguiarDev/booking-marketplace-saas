import { useAsync } from "@vez/mobile-kit/async";
import type { Database } from "@vez/supabase/types";

import { supabase } from "../../lib/supabase";

/**
 * As avaliações da loja e o que a plataforma decidiu sobre elas.
 *
 * Ler é `establishment_reviews` e não uma consulta direta: `reviews_select_public`
 * esconde a avaliação removida — inclusive da loja que a denunciou. Pela RPC a
 * removida continua na lista, marcada e com o motivo da decisão ao lado, que é
 * o fim da história que a loja precisa ver.
 *
 * Escrever é `report_review` e `answer_review_clarification`. A política
 * `review_reports_insert_manager` continua no banco como segunda tranca; o que
 * ela não sabe fazer é recusar motivo fora do vocabulário, exigir justificativa
 * e transformar a violação do índice único numa frase em português.
 */

export type ReportStatus = Database["public"]["Enums"]["review_report_status"];

/**
 * Os motivos que a loja pode alegar.
 *
 * São os mesmos critérios de remoção que a equipe usa para decidir
 * (`MOTIVES_REMOVE` no admin), e a lista de verdade é a função SQL
 * `review_report_reasons()`. Ela está repetida aqui para a folha abrir sem uma
 * ida ao servidor; se as duas escaparem uma da outra, a RPC recusa.
 */
export const REPORT_REASONS = [
  "Conteúdo ofensivo ou ataque pessoal",
  "Dado pessoal exposto",
  "Não se refere a este estabelecimento",
  "Retaliação por cobrança prevista em política",
  "Conteúdo comercial ou spam",
] as const;

export type Review = {
  id: string;
  rating: number;
  comment: string;
  tags: string[];
  createdAt: string;
  author: string;
  service: string;
  professional: string;
  appointmentAt: string;
  removed: boolean;
  report: Report | null;
};

export type Report = {
  id: string;
  reason: string;
  justification: string;
  status: ReportStatus;
  openedAt: string;
  clarificationRequest: string | null;
  clarificationAnswer: string | null;
  clarificationAnsweredAt: string | null;
  decisionMotive: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
};

type Row = {
  review_id: string;
  rating: number;
  comment: string;
  tags: string[] | null;
  created_at: string;
  author: string;
  service: string;
  professional: string;
  appointment_at: string;
  removed: boolean;
  report_id: string | null;
  report_reason: string | null;
  report_justification: string | null;
  report_status: ReportStatus | null;
  report_opened_at: string | null;
  clarification_request: string | null;
  clarification_answer: string | null;
  clarification_answered_at: string | null;
  decision_motive: string | null;
  decision_note: string | null;
  decided_at: string | null;
};

function toReview(row: Row): Review {
  return {
    id: row.review_id,
    rating: row.rating,
    comment: row.comment,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    author: row.author,
    service: row.service,
    professional: row.professional,
    appointmentAt: row.appointment_at,
    removed: row.removed,
    report: row.report_id
      ? {
          id: row.report_id,
          reason: row.report_reason ?? "",
          justification: row.report_justification ?? "",
          status: row.report_status ?? "open",
          openedAt: row.report_opened_at ?? row.created_at,
          clarificationRequest: row.clarification_request,
          clarificationAnswer: row.clarification_answer,
          clarificationAnsweredAt: row.clarification_answered_at,
          decisionMotive: row.decision_motive,
          decisionNote: row.decision_note,
          decidedAt: row.decided_at,
        }
      : null,
  };
}

export function useReviews(establishmentId: string | null) {
  return useAsync(
    `reviews:${establishmentId}`,
    async () => {
      const { data, error } = await supabase.rpc("establishment_reviews", {
        p_establishment_id: establishmentId!,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as Row[]).map(toReview);
    },
    { enabled: Boolean(establishmentId) },
  );
}

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * O banco valida e responde em português (`P0001`: motivo fora da lista,
 * justificativa curta, denúncia repetida; `42501`: papel errado). O resto é
 * rede ou sessão, e aí a frase genérica é mais honesta.
 */
function failure(error: { code?: string; message: string }, fallback: string): Result<never> {
  return {
    ok: false,
    message: error.code === "P0001" || error.code === "42501" ? error.message : fallback,
  };
}

export async function reportReview(input: {
  reviewId: string;
  reason: string;
  justification: string;
}): Promise<Result<string>> {
  const { data, error } = await supabase.rpc("report_review", {
    p_review_id: input.reviewId,
    p_reason: input.reason,
    p_justification: input.justification,
  });
  if (error) return failure(error, "Não foi possível enviar a denúncia. Tente de novo.");
  return { ok: true, value: data as unknown as string };
}

export async function answerClarification(reportId: string, answer: string): Promise<Result<null>> {
  const { error } = await supabase.rpc("answer_review_clarification", {
    p_report_id: reportId,
    p_answer: answer,
  });
  if (error) return failure(error, "Não foi possível enviar a resposta. Tente de novo.");
  return { ok: true, value: null };
}

/** Em que pé está a denúncia, dito para quem é da loja. */
export function reportLabel(report: Report): {
  label: string;
  tone: "wait" | "ask" | "ok" | "bad";
} {
  switch (report.status) {
    case "awaiting_establishment":
      return { label: "A EQUIPE PERGUNTOU", tone: "ask" };
    case "kept":
      return { label: "AVALIAÇÃO MANTIDA", tone: "ok" };
    case "removed":
      return { label: "AVALIAÇÃO REMOVIDA", tone: "bad" };
    default:
      return { label: "EM ANÁLISE", tone: "wait" };
  }
}

/** Uma denúncia aberta por avaliação: enquanto está com a equipe, não abre outra. */
export function canReport(review: Review): boolean {
  if (review.removed) return false;
  if (!review.report) return true;
  return review.report.status === "kept" || review.report.status === "removed";
}
