import assert from "node:assert/strict";
import { test } from "node:test";

import { createWaiters } from "../src/waiters.ts";

/** Dá uma volta na fila de microtarefas, para `then` de promessa resolvida rodar. */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("a limpeza da busca anterior não solta quem pediu a recarga nova", async () => {
  const waiters = createWaiters();
  let done = false;

  // Estado inicial: busca 0 em andamento. A pessoa puxa para atualizar.
  const first = waiters.next();
  void first.done.then(() => {
    done = true;
  });
  assert.equal(first.target, 1);

  // O React limpa o efeito da busca 0 antes de começar a 1.
  waiters.settle(0);
  await tick();
  assert.equal(done, false);
  assert.equal(waiters.size, 1);

  // A busca 1 termina.
  waiters.settle(1);
  await tick();
  assert.equal(done, true);
  assert.equal(waiters.size, 0);
});

test("duas recargas seguidas: a primeira é solta quando a segunda a substitui", async () => {
  const waiters = createWaiters();
  const seen: number[] = [];

  const first = waiters.next();
  const second = waiters.next();
  void first.done.then(() => seen.push(first.target));
  void second.done.then(() => seen.push(second.target));

  // A busca 1 foi substituída pela 2 antes de terminar: sua limpeza solta só
  // quem esperava por ela.
  waiters.settle(1);
  await tick();
  assert.deepEqual(seen, [1]);

  waiters.settle(2);
  await tick();
  assert.deepEqual(seen, [1, 2]);
});

test("soltar sem ninguém esperando não faz nada, e não solta duas vezes", async () => {
  const waiters = createWaiters();
  waiters.settle(5);

  let count = 0;
  // A numeração continua de onde parou, mesmo depois de um `settle` adiantado.
  const { target, done } = waiters.next();
  void done.then(() => {
    count += 1;
  });
  assert.equal(target, 1);

  waiters.settle(target);
  waiters.settle(target);
  await tick();
  assert.equal(count, 1);
});
