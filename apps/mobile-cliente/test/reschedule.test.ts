import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cancelIsFree,
  rescheduleCheck,
  rescheduleMessage,
  windowLabel,
} from "../src/domain/reschedule.ts";

const NOW = new Date("2026-09-17T12:00:00Z");
const at = (iso: string, status = "scheduled") => ({ status, starts_at: iso });

describe("rescheduleCheck", () => {
  it("permite com folga maior que a janela", () => {
    const result = rescheduleCheck(at("2026-09-17T18:00:00Z"), 120, NOW);
    assert.equal(result.ok, true);
    assert.equal(result.deadline?.toISOString(), "2026-09-17T16:00:00.000Z");
  });

  it("permite exatamente no limite da janela", () => {
    assert.equal(rescheduleCheck(at("2026-09-17T14:00:00Z"), 120, NOW).ok, true);
  });

  it("recusa dentro da janela", () => {
    const result = rescheduleCheck(at("2026-09-17T13:00:00Z"), 120, NOW);
    assert.deepEqual(result.ok ? null : result.reason, "outside_window");
  });

  it("recusa reserva passada e reserva encerrada", () => {
    const past = rescheduleCheck(at("2026-09-17T11:00:00Z"), 0, NOW);
    assert.equal(past.ok ? null : past.reason, "past");
    const done = rescheduleCheck(at("2026-09-18T11:00:00Z", "completed"), 0, NOW);
    assert.equal(done.ok ? null : done.reason, "not_active");
    const cancelled = rescheduleCheck(at("2026-09-18T11:00:00Z", "cancelled_by_customer"), 0, NOW);
    assert.equal(cancelled.ok ? null : cancelled.reason, "not_active");
  });

  it("aceita reserva confirmada", () => {
    assert.equal(rescheduleCheck(at("2026-09-18T11:00:00Z", "confirmed"), 60, NOW).ok, true);
  });
});

describe("cancelIsFree", () => {
  it("segue a mesma janela da loja", () => {
    assert.equal(cancelIsFree(at("2026-09-17T14:00:00Z"), 120, NOW), true);
    assert.equal(cancelIsFree(at("2026-09-17T13:59:00Z"), 120, NOW), false);
  });
});

describe("windowLabel", () => {
  it("escolhe a unidade", () => {
    assert.equal(windowLabel(30), "30 min");
    assert.equal(windowLabel(120), "2 h");
    assert.equal(windowLabel(1440), "1 dia");
    assert.equal(windowLabel(2880), "2 dias");
  });
});

describe("rescheduleMessage", () => {
  it("traduz pelo código, não pela mensagem", () => {
    assert.match(rescheduleMessage("slot_taken", "qualquer"), /Alguém acabou de reservar/);
  });

  it("cai na mensagem do servidor e depois no genérico", () => {
    assert.equal(rescheduleMessage("desconhecido", "Do servidor"), "Do servidor");
    assert.match(rescheduleMessage(null), /Não foi possível remarcar/);
  });
});
