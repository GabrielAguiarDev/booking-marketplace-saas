import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeCnpj,
  normalizeWhatsapp,
  readSiteConfig,
  validEmail,
  validHttpsUrl,
} from "../components/site-config.ts";

test("CNPJ numérico válido é formatado", () => {
  assert.equal(normalizeCnpj("11222333000181"), "11.222.333/0001-81");
  assert.equal(normalizeCnpj(" 11.222.333/0001-81 "), "11.222.333/0001-81");
});

test("CNPJ alfanumérico (Receita, jul/2026) é aceito", () => {
  assert.equal(normalizeCnpj("12ABC34501DE35"), "12.ABC.345/01DE-35");
});

test("CNPJ de exemplo, repetido ou com dígito errado não aparece", () => {
  assert.equal(normalizeCnpj("00.000.000/0001-00"), null);
  assert.equal(normalizeCnpj("00000000000000"), null);
  assert.equal(normalizeCnpj("11222333000182"), null);
  assert.equal(normalizeCnpj(""), null);
  assert.equal(normalizeCnpj(undefined), null);
});

test("WhatsApp vira link wa.me com DDI do Brasil", () => {
  assert.deepEqual(normalizeWhatsapp("(47) 99999-0000"), {
    url: "https://wa.me/5547999990000",
    label: "+55 47 99999-0000",
  });
  assert.deepEqual(normalizeWhatsapp("+55 11 3333-4444"), {
    url: "https://wa.me/551133334444",
    label: "+55 11 3333-4444",
  });
  assert.equal(normalizeWhatsapp("123"), null);
});

test("e-mail e URL inválidos somem", () => {
  assert.equal(validEmail("Ola@Vez.App"), "ola@vez.app");
  assert.equal(validEmail("sem-arroba"), null);
  assert.equal(validHttpsUrl("https://apps.apple.com/app/id1"), "https://apps.apple.com/app/id1");
  assert.equal(validHttpsUrl("http://example.com"), null);
  assert.equal(validHttpsUrl("javascript:alert(1)"), null);
});

test("ambiente vazio não inventa nenhum dado", () => {
  const config = readSiteConfig({});
  for (const value of Object.values(config)) assert.equal(value, null);
});

test("privacidade cai no e-mail de contato", () => {
  const config = readSiteConfig({ contactEmail: "contato@exemplo.com.br" });
  assert.equal(config.privacyEmail, "contato@exemplo.com.br");
  const own = readSiteConfig({
    contactEmail: "contato@exemplo.com.br",
    privacyEmail: "dpo@exemplo.com.br",
  });
  assert.equal(own.privacyEmail, "dpo@exemplo.com.br");
});
