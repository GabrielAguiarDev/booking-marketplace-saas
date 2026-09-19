import { useAsync } from "@vez/mobile-kit/async";

import { supabase } from "../../lib/supabase";
import type { Plan, PlanKind } from "./plan-rules";

/**
 * Planos ativos da plataforma. O de loja é `establishments.plan_id`, que já
 * vem com a loja; a lista serve para mostrar o que muda em cada um.
 */
export function usePlanCatalog() {
  return useAsync("plans", async () => {
    const { data, error } = await supabase
      .from("plans")
      .select(
        "id, kind, name, commission_percent, max_professionals, max_branches, queue_included, integrated_payment, search_highlight",
      )
      .eq("is_active", true)
      .order("kind");
    if (error) throw new Error(error.message);

    return (data ?? []).map<Plan>((row) => ({
      id: row.id,
      kind: row.kind as PlanKind,
      name: row.name,
      commissionPercent: row.commission_percent === null ? null : Number(row.commission_percent),
      maxProfessionals: row.max_professionals,
      maxBranches: row.max_branches,
      queueIncluded: row.queue_included,
      integratedPayment: row.integrated_payment,
      searchHighlight: row.search_highlight,
    }));
  });
}
