import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ATTACHMENT_MAX_BYTES,
  attachmentErrorMessage,
  attachmentFileName,
  attachmentMime,
  attachmentPath,
  attachmentProblem,
  attachmentUuid,
  formatBytes,
} from "../src/attachments.ts";

const TICKET = "5f0e9a8b-7c6d-4e5f-9a0b-1c2d3e4f5a6b";

test("tipo declarado e extensão caem no mesmo conjunto aceito pelo bucket", () => {
  assert.equal(attachmentMime({ mimeType: "image/jpg" }), "image/jpeg");
  assert.equal(attachmentMime({ mimeType: "image/heif" }), "image/heic");
  assert.equal(attachmentMime({ name: "comprovante.PDF" }), "application/pdf");
  assert.equal(attachmentMime({ name: "script.svg" }), null);
});

test("limite e tamanho são recusados antes do upload", () => {
  assert.match(attachmentProblem({ mime: "image/png", size: 1, count: 10 }) ?? "", /10 anexos/);
  assert.match(
    attachmentProblem({ mime: "application/pdf", size: ATTACHMENT_MAX_BYTES + 1, count: 0 }) ?? "",
    /10 MB/,
  );
  assert.equal(attachmentProblem({ mime: "image/png", size: null, count: 0 }), null);
});

test("nome mostrado perde pasta e quebra de linha", () => {
  assert.equal(attachmentFileName("pasta\\nota\nfiscal.pdf", "application/pdf"), "nota fiscal.pdf");
  assert.equal(attachmentFileName("", "image/webp"), "anexo.webp");
});

test("uuid e caminho respeitam o formato da policy do Storage", () => {
  const uuid = attachmentUuid((bytes) => {
    bytes.fill(0xab);
    return bytes;
  });
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(
    attachmentPath(TICKET.toUpperCase(), "application/pdf", uuid),
    `${TICKET}/${uuid}.pdf`,
  );
});

test("mensagens externas distinguem configuração, formato e conexão", () => {
  assert.match(
    attachmentErrorMessage({ message: "Bucket not found" }),
    /ainda não estão disponíveis/,
  );
  assert.match(
    attachmentErrorMessage({ message: "mime type text/plain is not supported" }),
    /Formato/,
  );
  assert.match(attachmentErrorMessage({ message: "Network request failed" }), /conexão/);
  assert.equal(formatBytes(1536), "2 KB");
  assert.equal(formatBytes(1_572_864), "1,5 MB");
});
