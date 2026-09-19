import { useAsync } from "@vez/mobile-kit/async";

import { supabase } from "../../lib/supabase";
import { type ApplicationState, applicationState, type Decision } from "./application-rules";
import type { Establishment } from "./establishment";

/**
 * Situação do cadastro da loja, com a última decisão da equipe da Vez.
 * Loja ativa não consulta nada: não há o que mostrar.
 */
export function useApplicationState(establishment: Establishment | null): ApplicationState | null {
  const id = establishment?.id ?? null;
  const needsDecision = Boolean(id) && establishment?.status !== "active";

  const decision = useAsync(
    `decision:${id}:${establishment?.submitted_at}`,
    async () => {
      const { data, error } = await supabase
        .from("establishment_decisions")
        .select("decision, message, decided_at")
        .eq("establishment_id", id!)
        .order("decided_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data
        ? ({
            kind: data.decision as Decision["kind"],
            message: data.message,
            decidedAt: data.decided_at,
          } satisfies Decision)
        : null;
    },
    { enabled: needsDecision },
  );

  if (!establishment) return null;
  if (needsDecision && decision.loading) return null;

  return applicationState({
    status: establishment.status,
    statusReason: establishment.status_reason,
    submittedAt: establishment.submitted_at,
    decision: decision.data,
  });
}
