import { useCallback, useEffect, useState } from "react";

/**
 * Contagem regressiva para o botão de reenviar código.
 *
 * Existe por dois motivos, e o segundo importa mais: o Supabase tem limite de
 * envio por hora (`auth.rate_limit.email_sent`), e um usuário que não recebeu o
 * e-mail toca "reenviar" repetidamente até estourar o limite — aí ele fica
 * bloqueado sem nunca ter recebido nada. O botão desabilitado transforma isso
 * numa espera visível em vez de um bloqueio invisível.
 */
export function useCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback(() => setRemaining(seconds), [seconds]);

  return { remaining, active: remaining > 0, start };
}
