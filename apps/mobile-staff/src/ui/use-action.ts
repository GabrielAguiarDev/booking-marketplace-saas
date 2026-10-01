import { useCallback, useRef, useState } from "react";

import { useToast } from "./Toast";

type Result = { ok: boolean; message?: string };

/**
 * Roda uma ação do balcão uma vez só, e conta o que aconteceu.
 *
 * O toque duplo é o defeito mais caro deste app: dois toques em "Chamar
 * próximo" chamam duas pessoas, e a segunda perde o lugar sem ninguém ter
 * decidido isso. A trava vive em `ref`, não em estado, porque o segundo toque
 * chega antes de o React redesenhar — estado ainda diria "livre".
 *
 * `busy` é a chave da ação em andamento, para o botão certo se mostrar ocupado.
 */
export function useAction() {
  const toast = useToast();
  const running = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, action: () => Promise<Result>, success: string): Promise<boolean> => {
      if (running.current) return false;
      running.current = true;
      setBusy(key);
      try {
        const result = await action();
        toast(result.ok ? success : (result.message ?? "Não deu certo."), result.ok ? "ok" : "bad");
        return result.ok;
      } catch {
        // As ações devolvem `{ ok: false }` em vez de lançar; isto é a rede de
        // baixo, para a trava nunca ficar presa.
        toast("Não deu certo. Confira a conexão e tente de novo.", "bad");
        return false;
      } finally {
        running.current = false;
        setBusy(null);
      }
    },
    [toast],
  );

  return { run, busy };
}
