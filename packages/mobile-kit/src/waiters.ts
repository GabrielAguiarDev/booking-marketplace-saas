/**
 * Quem está esperando uma recarga terminar.
 *
 * Cada espera guarda o número da recarga que pediu, e `settle(n)` solta só
 * quem pediu até a recarga `n`. A numeração existe por causa da ordem em que o
 * React roda as coisas: a limpeza da busca anterior acontece antes de a nova
 * começar, e sem o número ela soltaria quem acabou de pedir — o indicador de
 * "atualizando" sumiria antes de o dado chegar.
 *
 * Módulo puro, sem React, para rodar nos testes com `node --test`.
 */
export function createWaiters() {
  let pending: { target: number; resolve: () => void }[] = [];
  let last = 0;

  return {
    /** Registra uma espera pela próxima recarga e devolve o número dela. */
    next(): { target: number; done: Promise<void> } {
      last += 1;
      const target = last;
      const done = new Promise<void>((resolve) => {
        pending.push({ target, resolve });
      });
      return { target, done };
    },
    /** Solta todo mundo que esperava uma recarga até `upTo`, inclusive. */
    settle(upTo: number): void {
      const due = pending.filter((waiter) => waiter.target <= upTo);
      pending = pending.filter((waiter) => waiter.target > upTo);
      for (const waiter of due) waiter.resolve();
    },
    get size(): number {
      return pending.length;
    },
  };
}
