import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deliveryLabel,
  deliveryNotice,
  type DeliveryRow,
  isExpoPushToken,
  permissionState,
  pushBlocker,
  pushPlatform,
  pushRoute,
  pushStateCopy,
  resolveProjectId,
} from "../src/push/rules.ts";

const PROJECT = "4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const ID = "5f0e9a8b-7c6d-4e5f-9a0b-1c2d3e4f5a6b";

test("token aceito é o mesmo formato da restrição do banco", () => {
  assert.ok(isExpoPushToken("ExponentPushToken[abc_DEF-123]"));
  assert.ok(isExpoPushToken("ExpoPushToken[xyz]"));
  assert.ok(!isExpoPushToken("ExponentPushToken[]"));
  assert.ok(!isExpoPushToken("fcm:abc"));
  assert.ok(!isExpoPushToken(null));
});

test("plataforma só as três que push_devices aceita", () => {
  assert.equal(pushPlatform("ios"), "ios");
  assert.equal(pushPlatform("android"), "android");
  assert.equal(pushPlatform("windows"), null);
});

test("projectId: primeiro uuid válido, ignorando vazio e lixo", () => {
  assert.equal(resolveProjectId(undefined, "", "abc", PROJECT), PROJECT);
  assert.equal(resolveProjectId(` ${PROJECT} `), PROJECT);
  assert.equal(resolveProjectId(null, undefined), null);
});

test("bloqueios: web e simulador antes da configuração", () => {
  assert.deepEqual(pushBlocker({ os: "web", isDevice: true, projectId: null }), {
    kind: "unsupported",
    reason: "web",
  });
  assert.deepEqual(pushBlocker({ os: "ios", isDevice: false, projectId: null }), {
    kind: "unsupported",
    reason: "simulator",
  });
  assert.deepEqual(pushBlocker({ os: "ios", isDevice: true, projectId: null }), {
    kind: "unconfigured",
  });
  assert.equal(pushBlocker({ os: "android", isDevice: true, projectId: PROJECT }), null);
});

test("permissão negada sem poder pedir de novo manda para os ajustes", () => {
  assert.deepEqual(permissionState("granted", true), { kind: "on" });
  assert.equal(pushStateCopy(permissionState("undetermined", true)).action, "ask");
  assert.equal(pushStateCopy(permissionState("denied", false)).action, "settings");
  assert.equal(pushStateCopy(permissionState("denied", true)).action, "ask");
});

test("configuração de fora não oferece botão", () => {
  assert.equal(pushStateCopy({ kind: "unconfigured" }).action, null);
  assert.equal(pushStateCopy({ kind: "unsupported", reason: "simulator" }).action, null);
  assert.equal(pushStateCopy({ kind: "error", message: "x" }).action, "retry");
});

function row(status: DeliveryRow["status"]): DeliveryRow {
  return { id: ID, channel: "push", status, title: "t", created_at: "", sent_at: null };
}

test("entrega: status viram texto de quem recebe", () => {
  assert.equal(deliveryLabel("sent").label, "Entregue");
  assert.equal(deliveryLabel("sending").tone, "wait");
  assert.equal(deliveryLabel("unconfigured").tone, "warn");
});

test("aviso de envio parado aparece antes da lista", () => {
  assert.match(deliveryNotice([row("sent"), row("unconfigured")]) ?? "", /não foi ligado/);
  assert.match(deliveryNotice([row("skipped"), row("skipped")]) ?? "", /aparelho/);
  assert.equal(deliveryNotice([row("sent")]), null);
  assert.equal(deliveryNotice([]), null);
});

test("toque na notificação: rota por app e tipo", () => {
  assert.equal(pushRoute("cliente", { type: "appointment", appointment_id: ID }), `/reserva/${ID}`);
  assert.equal(
    pushRoute("cliente", { type: "review_request", appointment_id: ID }),
    `/avaliacao?appointmentId=${ID}`,
  );
  assert.equal(pushRoute("cliente", { type: "queue", establishment_id: ID }), `/fila?id=${ID}`);
  assert.equal(pushRoute("cliente", { type: "support_ticket", ticket_id: ID }), `/ajuda/${ID}`);
  assert.equal(pushRoute("staff", { type: "appointment", appointment_id: ID }), `/agendamento/${ID}`);
  assert.equal(pushRoute("staff", { type: "support_ticket", ticket_id: ID }), `/chamado/${ID}`);
  assert.equal(pushRoute("staff", { type: "review_report" }), "/avaliacoes");
  // id malformado não vira rota com lixo
  assert.equal(pushRoute("cliente", { type: "appointment", appointment_id: "../x" }), "/agenda");
  assert.equal(pushRoute("cliente", { type: "lead" }), null);
  assert.equal(pushRoute("staff", null), null);
});
