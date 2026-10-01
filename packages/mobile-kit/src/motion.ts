import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * A pessoa pediu ao sistema menos movimento?
 *
 * "Reduzir movimento" (iOS) e "Remover animações" (Android) existem para quem
 * sente enjoo ou perde o foco com coisa se mexendo na tela. Os dois apps têm
 * animações em laço — o ponto que pulsa, o esqueleto que varre — e laço é
 * exatamente o que essa preferência pede para parar.
 *
 * Começa em `false` e corrige quando o sistema responde: a leitura é
 * assíncrona, e segurar a tela esperando por ela atrasaria todo mundo para
 * atender uma minoria que, no pior caso, vê um quadro de animação.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      // Plataforma sem a API (algumas versões do web): fica o padrão.
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduced(value);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
