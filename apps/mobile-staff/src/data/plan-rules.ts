/**
 * Como o plano da loja é descrito. Puro, para teste; o mesmo vocabulário da
 * seção Plano do portal (`apps/portal/components/billing.tsx`).
 */

export type PlanKind = "monthly" | "commission";

export type Plan = {
  id: string;
  kind: PlanKind;
  name: string;
  commissionPercent: number | null;
  maxProfessionals: number | null;
  maxBranches: number | null;
  queueIncluded: boolean;
  integratedPayment: string;
  searchHighlight: boolean;
};

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  monthly: "Mensalidade fixa",
  commission: "Comissão por atendimento",
};

export function percentLabel(value: number | null): string {
  return `${(value ?? 0).toString().replace(".", ",")}%`;
}

/** O que o plano inclui, uma linha por regra. */
export function planLines(plan: Plan): string[] {
  const lines = [
    plan.kind === "commission"
      ? `${percentLabel(plan.commissionPercent)} sobre cada atendimento concluído`
      : "Valor fixo por mês, combinado com a Vez",
    plan.maxProfessionals === null
      ? "Profissionais sem limite"
      : `Até ${plan.maxProfessionals} profissionais`,
    plan.maxBranches === null ? "Unidades sem limite" : `Até ${plan.maxBranches} unidades`,
    plan.queueIncluded ? "Fila de espera incluída" : "Sem fila de espera",
    plan.integratedPayment === "required"
      ? "Pagamento pelo app obrigatório"
      : "Pagamento pelo app opcional",
  ];
  if (plan.searchHighlight) lines.push("Destaque na busca do app do cliente");
  return lines;
}

/** Quantos profissionais ativos passam do limite do plano. Zero quando cabe. */
export function professionalsOverLimit(plan: Plan, activeProfessionals: number): number {
  if (plan.maxProfessionals === null) return 0;
  return Math.max(0, activeProfessionals - plan.maxProfessionals);
}
