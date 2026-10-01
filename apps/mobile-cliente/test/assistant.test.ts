import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assistantFailure,
  conversationTitle,
  conversationWhen,
  establishmentNames,
  groupSlots,
  parseCards,
  quotaView,
} from "../src/domain/assistant.ts";

const SHOP = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SERVICE = "33333333-3333-4333-8333-333333333333";
const PRO = "44444444-4444-4444-8444-444444444444";

function slot(establishmentId: string, start: string, extra: Record<string, unknown> = {}) {
  return {
    kind: "slot",
    establishment_id: establishmentId,
    service_id: SERVICE,
    professional_id: PRO,
    slot_start: start,
    ...extra,
  };
}

test("cartões do banco: o que não é lista vira nenhum cartão", () => {
  assert.deepEqual(parseCards(null), []);
  assert.deepEqual(parseCards("[]"), []);
  assert.deepEqual(parseCards({ kind: "slot" }), []);
});

test("cartão incompleto ou de tipo desconhecido é descartado, não derruba a conversa", () => {
  const cards = parseCards([
    { kind: "promo", id: "x" },
    { kind: "establishment", id: SHOP }, // sem nome
    { kind: "establishment", id: SHOP, name: "Meia-Nove", category: "pizzaria" },
    slot(SHOP, "não é data"),
    { kind: "slot", establishment_id: SHOP, slot_start: "2026-10-01T16:00:00Z" }, // sem serviço
    42,
    null,
  ]);
  assert.deepEqual(cards, []);
});

test("cartão de loja válido sai com os opcionais normalizados", () => {
  const [card] = parseCards([
    { kind: "establishment", id: SHOP, name: "Meia-Nove", category: "barbershop" },
  ]);
  assert.deepEqual(card, {
    kind: "establishment",
    id: SHOP,
    name: "Meia-Nove",
    category: "barbershop",
    neighborhood: null,
    rating_avg: null,
    rating_count: 0,
    booking_mode: "scheduled",
  });
});

test("cartão de horário aceita nome de loja e serviço quando a função manda", () => {
  const [plain, named] = parseCards([
    slot(SHOP, "2026-10-01T16:00:00Z"),
    slot(SHOP, "2026-10-01T17:00:00Z", { establishment_name: "Meia-Nove", service_name: "Corte" }),
  ]);
  assert.equal(plain?.kind, "slot");
  assert.ok(plain && !("establishment_name" in plain));
  assert.deepEqual(named, {
    kind: "slot",
    establishment_id: SHOP,
    service_id: SERVICE,
    professional_id: PRO,
    slot_start: "2026-10-01T17:00:00Z",
    establishment_name: "Meia-Nove",
    service_name: "Corte",
  });
});

test("horários de duas lojas não se misturam", () => {
  const cards = parseCards([
    slot(SHOP, "2026-10-01T16:00:00Z"),
    slot(OTHER, "2026-10-01T16:00:00Z"),
    slot(SHOP, "2026-10-01T15:00:00Z"),
  ]);
  const groups = groupSlots(cards);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.establishmentId, SHOP);
  // Dentro do grupo, em ordem de horário.
  assert.deepEqual(
    groups[0]?.slots.map((s) => s.slot_start),
    ["2026-10-01T15:00:00Z", "2026-10-01T16:00:00Z"],
  );
  assert.equal(groups[1]?.slots.length, 1);
});

test("o mesmo instante escrito em dois fusos é uma oferta só", () => {
  const cards = parseCards([
    slot(SHOP, "2026-10-01T16:00:00Z"),
    slot(SHOP, "2026-10-01T13:00:00-03:00"),
  ]);
  assert.equal(groupSlots(cards)[0]?.slots.length, 1);
});

test("o nome da loja vem do cartão, e na falta dele do que a conversa já mostrou", () => {
  const messages = [
    {
      cards: parseCards([
        { kind: "establishment", id: SHOP, name: "Meia-Nove", category: "barbershop" },
      ]),
    },
  ];
  const names = establishmentNames(messages);
  assert.equal(names.get(SHOP), "Meia-Nove");

  const fromConversation = groupSlots(parseCards([slot(SHOP, "2026-10-01T16:00:00Z")]), names);
  assert.equal(fromConversation[0]?.establishmentName, "Meia-Nove");

  const fromCard = groupSlots(
    parseCards([slot(SHOP, "2026-10-01T16:00:00Z", { establishment_name: "Do cartão" })]),
    names,
  );
  assert.equal(fromCard[0]?.establishmentName, "Do cartão");

  // Loja que nunca apareceu: nome desconhecido, não inventado.
  assert.equal(
    groupSlots(parseCards([slot(OTHER, "2026-10-01T16:00:00Z")]), names)[0]?.establishmentName,
    null,
  );
});

test("só rede e indisponibilidade oferecem tentar de novo", () => {
  assert.equal(assistantFailure("network", null).retryable, true);
  assert.equal(assistantFailure("model_failed", true).retryable, true);
  assert.equal(assistantFailure("codigo_novo_do_servidor", true).kind, "unavailable");

  for (const code of [
    "daily_limit_reached",
    "assistant_not_configured",
    "assistant_out_of_credit",
    "unauthorized",
    "message_too_long",
  ]) {
    assert.equal(assistantFailure(code, true).retryable, false, code);
  }
});

test("cada código do servidor vira a sua falha", () => {
  assert.equal(assistantFailure("daily_limit_reached", true).kind, "quota");
  assert.equal(assistantFailure("assistant_not_configured", true).kind, "not_configured");
  assert.equal(assistantFailure("assistant_out_of_credit", true).kind, "out_of_credit");
  assert.equal(assistantFailure("unauthorized", true).kind, "session");
  assert.equal(assistantFailure("empty_message", true).kind, "invalid");
});

test("aparelho sem rede vence qualquer código", () => {
  const failure = assistantFailure("daily_limit_reached", false);
  assert.equal(failure.kind, "offline");
  assert.equal(failure.retryable, true);
});

test("cota desconhecida não vira zero", () => {
  assert.equal(quotaView(null, 20), null);
  assert.equal(quotaView(Number.NaN, 20), null);
});

test("cota: normal, acabando e esgotada", () => {
  assert.deepEqual(quotaView(17, 20), {
    label: "RESTAM 17 DE 20 HOJE",
    tone: "normal",
    blocked: false,
  });
  assert.deepEqual(quotaView(3, 20), { label: "RESTAM 3 DE 20 HOJE", tone: "low", blocked: false });
  assert.deepEqual(quotaView(1, 20), { label: "RESTA 1 DE 20 HOJE", tone: "low", blocked: false });
  assert.deepEqual(quotaView(0, 20), { label: "SEM PERGUNTAS HOJE", tone: "empty", blocked: true });
  // Número negativo do servidor não desbloqueia nem aparece na tela.
  assert.equal(quotaView(-2, 20)?.blocked, true);
});

test("cota sem limite conhecido não inventa o total", () => {
  assert.equal(quotaView(5, null)?.label, "RESTAM 5 PERGUNTAS HOJE");
  assert.equal(quotaView(1, 0)?.label, "RESTA 1 PERGUNTA HOJE");
});

test("data da conversa: hoje, ontem, este ano e ano passado", () => {
  const now = new Date(2026, 8, 30, 15, 0);
  assert.equal(conversationWhen(new Date(2026, 8, 30, 9, 5).toISOString(), now), "HOJE · 09:05");
  assert.equal(conversationWhen(new Date(2026, 8, 29, 23, 50).toISOString(), now), "ONTEM · 23:50");
  assert.equal(conversationWhen(new Date(2026, 8, 12, 10, 0).toISOString(), now), "12/09");
  assert.equal(conversationWhen(new Date(2025, 11, 31, 10, 0).toISOString(), now), "31/12/2025");
  assert.equal(conversationWhen("nada", now), "");
});

test("título da conversa: espaços limpos e nome neutro quando falta", () => {
  assert.equal(conversationTitle("  tem   corte\nhoje? "), "tem corte hoje?");
  assert.equal(conversationTitle(null), "Conversa sem título");
  assert.equal(conversationTitle("   "), "Conversa sem título");
});
