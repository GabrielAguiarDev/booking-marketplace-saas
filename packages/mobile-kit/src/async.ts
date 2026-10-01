import { useCallback, useEffect, useState } from "react";

import { createWaiters } from "./waiters";

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
  // Quem chamou `reload()` e está esperando a busca terminar. Vive fora do
  // estado porque não desenha nada: só o gesto de puxar para atualizar precisa
  // saber quando soltar o indicador.
  const [waiters] = useState(createWaiters);

  useEffect(() => {
    const settle = () => waiters.settle(nonce);

    if (!enabled) {
      settle();
      return;
    }

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
      })
      .finally(() => {
        if (active) settle();
      });

    return () => {
      active = false;
      // Busca substituída ou tela desmontada: quem esperava não pode ficar
      // pendurado com o indicador girando para sempre.
      settle();
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
    /**
     * Refaz a busca. A promessa resolve quando ela termina — com sucesso ou
     * erro — e nunca rejeita: o erro continua chegando por `error`.
     */
    reload: useCallback(() => {
      const { target, done } = waiters.next();
      setNonce(target);
      return done;
    }, [waiters]),
  };
}
