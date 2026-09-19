/// <reference types="node" />

import assert from "node:assert/strict";
import { test } from "node:test";

import { applicationState } from "../src/data/application-rules.ts";
import {
  PHOTO_MAX_BYTES,
  photoErrorMessage,
  photoMime,
  photoProblem,
  photoStoragePath,
} from "../src/data/photo-rules.ts";
import { planLines, professionalsOverLimit, type Plan } from "../src/data/plan-rules.ts";
import { resolveIncomingPath } from "../src/linking-rules.ts";

const STORE = "0b6f3c2e-1a2b-4c3d-8e9f-a0b1c2d3e4f5";
const APPOINTMENT = "5f0e9a8b-7c6d-4e5f-9a0b-1c2d3e4f5a6b";

// ── foto ─────────────────────────────────────────────────────────

test("caminho da foto casa com a restrição do banco", () => {
  const path = photoStoragePath(STORE, "image/png", 1_700_000_000_000, "ab12cd");
  assert.match(path, /^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/);
  assert.ok(path.startsWith(`${STORE}/`));
  assert.ok(path.endsWith(".png"));
});

test("tipo da foto vem do mimeType ou da extensão", () => {
  assert.equal(photoMime({ mimeType: "image/jpeg", uri: "file:///x" }), "image/jpeg");
  assert.equal(photoMime({ mimeType: "image/jpg", uri: "file:///x" }), "image/jpeg");
  assert.equal(photoMime({ uri: "file:///tmp/IMG_1.JPG" }), "image/jpeg");
  assert.equal(photoMime({ fileName: "capa.webp", uri: "blob:abc" }), "image/webp");
  assert.equal(photoMime({ mimeType: "image/heic", uri: "file:///x.heic" }), null);
});

test("foto grande ou de formato errado é recusada antes do envio", () => {
  assert.equal(photoProblem("image/png", 1000), null);
  assert.equal(photoProblem("image/png", undefined), null);
  assert.match(photoProblem("image/png", PHOTO_MAX_BYTES + 1) ?? "", /5 MB/);
  assert.match(photoProblem(null, 10) ?? "", /JPG, PNG ou WebP/);
});

test("erro do Storage vira frase de gente", () => {
  assert.match(photoErrorMessage("mime type image/heic is not supported"), /Formato/);
  assert.match(photoErrorMessage("new row violates row-level security policy"), /dono ou gerência/);
  assert.equal(photoErrorMessage("boom"), "Não foi possível enviar a foto.");
});

// ── plano ────────────────────────────────────────────────────────

const commission: Plan = {
  id: "p1",
  kind: "commission",
  name: "Comissão por agendamento",
  commissionPercent: 12.5,
  maxProfessionals: null,
  maxBranches: 1,
  queueIncluded: true,
  integratedPayment: "required",
  searchHighlight: false,
};

test("plano é descrito pelas regras do banco", () => {
  assert.deepEqual(planLines(commission), [
    "12,5% sobre cada atendimento concluído",
    "Profissionais sem limite",
    "Até 1 unidades",
    "Fila de espera incluída",
    "Pagamento pelo app obrigatório",
  ]);
  const monthly: Plan = {
    ...commission,
    kind: "monthly",
    maxProfessionals: 12,
    searchHighlight: true,
  };
  assert.equal(planLines(monthly)[0], "Valor fixo por mês, combinado com a Vez");
  assert.equal(planLines(monthly).at(-1), "Destaque na busca do app do cliente");
  assert.equal(professionalsOverLimit(monthly, 14), 2);
  assert.equal(professionalsOverLimit(monthly, 3), 0);
  assert.equal(professionalsOverLimit(commission, 99), 0);
});

// ── aprovação ────────────────────────────────────────────────────

test("pendente sem decisão está em análise", () => {
  const state = applicationState({
    status: "pending",
    statusReason: null,
    submittedAt: "2026-09-10T12:00:00Z",
    decision: null,
  });
  assert.equal(state.kind, "review");
  assert.equal(state.ownerAction, null);
});

test("correção posterior ao envio fica com o dono", () => {
  const state = applicationState({
    status: "pending",
    statusReason: null,
    submittedAt: "2026-09-10T12:00:00Z",
    decision: { kind: "correction", message: "Falta o CNPJ.", decidedAt: "2026-09-11T09:00:00Z" },
  });
  assert.equal(state.kind, "correction");
  assert.equal(state.body, "Falta o CNPJ.");
  assert.ok(state.ownerAction);
});

test("correção anterior ao reenvio volta a ser análise", () => {
  const state = applicationState({
    status: "pending",
    statusReason: null,
    submittedAt: "2026-09-12T12:00:00Z",
    decision: { kind: "correction", message: "Falta o CNPJ.", decidedAt: "2026-09-11T09:00:00Z" },
  });
  assert.equal(state.kind, "review");
});

test("recusa e suspensão mostram o motivo", () => {
  assert.equal(
    applicationState({
      status: "rejected",
      statusReason: "CNPJ inativo.",
      submittedAt: null,
      decision: null,
    }).body,
    "CNPJ inativo.",
  );
  assert.equal(
    applicationState({ status: "suspended", statusReason: null, submittedAt: null, decision: null })
      .kind,
    "suspended",
  );
  assert.equal(
    applicationState({ status: "active", statusReason: null, submittedAt: null, decision: null })
      .kind,
    "active",
  );
});

// ── deep links ───────────────────────────────────────────────────

test("esquema próprio abre a reserva", () => {
  assert.equal(
    resolveIncomingPath(`vezstaff://agendamento/${APPOINTMENT}`),
    `/agendamento/${APPOINTMENT}`,
  );
  assert.equal(
    resolveIncomingPath(`vezstaff://reserva/${APPOINTMENT}`),
    `/agendamento/${APPOINTMENT}`,
  );
});

test("link universal usa o caminho, não o domínio", () => {
  assert.equal(
    resolveIncomingPath(`https://loja.vez.app/chamado/${APPOINTMENT}`),
    `/chamado/${APPOINTMENT}`,
  );
  assert.equal(resolveIncomingPath("https://loja.vez.app/fila"), "/fila");
  assert.equal(resolveIncomingPath("https://loja.vez.app/"), "/");
});

test("Expo Go e grupos do roteador", () => {
  assert.equal(resolveIncomingPath("exp://192.168.0.10:8082/--/agenda"), "/agenda");
  assert.equal(resolveIncomingPath("/(tabs)/fila"), "/fila");
  assert.equal(resolveIncomingPath("vezstaff://plano"), "/assinatura");
});

test("só o e-mail passa adiante na recuperação de senha", () => {
  assert.equal(
    resolveIncomingPath("vezstaff://nova-senha?email=rafa%40vez.local&token=segredo"),
    "/nova-senha?email=rafa%40vez.local",
  );
});

test("link desconhecido ou com id inválido cai em Hoje", () => {
  assert.equal(resolveIncomingPath("vezstaff://nao-existe"), "/");
  assert.equal(resolveIncomingPath("vezstaff://agendamento/123"), "/");
  assert.equal(resolveIncomingPath(`vezstaff://agendamento/${APPOINTMENT}/extra`), "/");
  assert.equal(resolveIncomingPath("vezstaff://fila/extra"), "/");
  assert.equal(resolveIncomingPath(""), "/");
});
