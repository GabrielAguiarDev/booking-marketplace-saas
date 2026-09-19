/**
 * Distinguir "sem internet" de "o servidor recusou".
 *
 * As duas falhas pedem ações opostas do usuário: uma é esperar o sinal, a
 * outra é tentar outra coisa. O supabase-js não tipa a diferença — ela
 * aparece na mensagem do `fetch` de cada plataforma, que é o que se lê aqui.
 *
 * Módulo puro (sem React Native) para rodar nos testes com `node --test`.
 */

const NETWORK_PATTERNS = [
  /network request failed/i, // React Native (iOS e Android)
  /failed to fetch/i, // navegador / web
  /networkerror/i, // Firefox
  /load failed/i, // Safari
  /fetch failed/i, // Node / undici
  /the internet connection appears to be offline/i,
  /timed? ?out/i,
  /ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN/,
];

export function isNetworkErrorMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return NETWORK_PATTERNS.some((pattern) => pattern.test(message));
}

export type FailureKind = "offline" | "server";

/**
 * Classifica uma falha. `connected === false` (o aparelho sabe que está sem
 * rede) vence a mensagem; `null` quer dizer "não sei" e deixa a mensagem decidir.
 */
export function failureKind(
  message: string | null | undefined,
  connected: boolean | null,
): FailureKind {
  if (connected === false) return "offline";
  return isNetworkErrorMessage(message) ? "offline" : "server";
}
