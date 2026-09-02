import { useCallback, useEffect, useState } from "react";

type Result<T> = { key: string; data: T | null; error: string | null };

/**
 * Busca assíncrona com estado de carregando, erro e recarga.
 *
 * O resultado guarda a chave da consulta que o produziu, e "carregando" é
 * derivado da comparação com a chave atual. Guardar `loading` como estado
 * exigiria `setState` dentro do efeito — proibido pela regra
 * `react-hooks/set-state-in-effect` — e, pior, deixaria o resultado da loja
 * anterior aparecer por um instante na tela da loja nova.
 */
export function useAsync<T>(
  key: string,
  run: () => Promise<T>,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const [result, setResult] = useState<Result<T> | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    run()
      .then((data) => {
        if (active) setResult({ key, data, error: null });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setResult({
          key,
          data: null,
          error: cause instanceof Error ? cause.message : "Falha inesperada.",
        });
      });

    return () => {
      active = false;
    };
    // `run` muda de identidade a cada render; `key` é o que de fato descreve a
    // consulta. Incluir `run` aqui refaria a busca em todo render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, nonce]);

  const current = result?.key === key ? result : null;

  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: enabled && current === null,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}
