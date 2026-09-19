/**
 * Em que pé está o cadastro da loja — a mesma leitura do portal
 * (`ApplicationStatus` em `apps/portal/components/onboarding.tsx`) e do admin.
 *
 * `pending` sozinho não basta: a equipe da Vez pode ter pedido correção, e aí
 * a bola está com o dono, não com a plataforma. A correção vale enquanto for
 * mais nova que o último envio (`submitted_at`); reenviar pelo portal grava um
 * `submitted_at` novo e devolve a loja à fila de Aprovações.
 */

export type EstablishmentStatus = "pending" | "active" | "suspended" | "rejected";

export type Decision = {
  kind: "approved" | "rejected" | "correction";
  message: string | null;
  decidedAt: string;
};

export type ApplicationKind = "active" | "review" | "correction" | "rejected" | "suspended";

export type ApplicationState = {
  kind: ApplicationKind;
  title: string;
  body: string;
  /** Quem resolve pelo portal: só o dono reenvia o cadastro. */
  ownerAction: string | null;
};

export function applicationState(input: {
  status: EstablishmentStatus;
  statusReason: string | null;
  submittedAt: string | null;
  decision: Decision | null;
}): ApplicationState {
  const { status, statusReason, submittedAt, decision } = input;
  const reason = decision?.message?.trim() || statusReason?.trim() || null;

  if (status === "active") {
    return {
      kind: "active",
      title: "Publicada",
      body: "Sua loja aparece nas buscas do app do cliente.",
      ownerAction: null,
    };
  }

  if (status === "rejected") {
    return {
      kind: "rejected",
      title: "Cadastro recusado",
      body: reason ?? "A equipe da Vez recusou o cadastro. Fale com o suporte para entender.",
      ownerAction: null,
    };
  }

  if (status === "suspended") {
    return {
      kind: "suspended",
      title: "Loja suspensa",
      body: reason ?? "A loja saiu das buscas por decisão da equipe da Vez. Fale com o suporte.",
      ownerAction: null,
    };
  }

  const correction =
    decision?.kind === "correction" &&
    (!submittedAt || new Date(decision.decidedAt).getTime() >= new Date(submittedAt).getTime());

  if (correction) {
    return {
      kind: "correction",
      title: "A Vez pediu uma correção",
      body: reason ?? "Revise os dados do cadastro e reenvie.",
      ownerAction: "Corrigir no portal",
    };
  }

  return {
    kind: "review",
    title: "Cadastro em análise",
    body: "A equipe da Vez está conferindo os dados. Enquanto isso, a loja não aparece para clientes — deixe serviços, horários e perfil prontos.",
    ownerAction: null,
  };
}
