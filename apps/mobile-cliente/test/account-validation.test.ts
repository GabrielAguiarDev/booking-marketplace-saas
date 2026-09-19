import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatPhone,
  formatPostalCode,
  geocodeQuery,
  normalizePhone,
  validateAddress,
  validatePersonal,
} from "../src/domain/account-validation.ts";

describe("normalizePhone", () => {
  it("normaliza celular com máscara para E.164", () => {
    assert.equal(normalizePhone("(11) 98765-4321"), "+5511987654321");
  });

  it("aceita +55 e zero de operadora", () => {
    assert.equal(normalizePhone("+55 11 98765 4321"), "+5511987654321");
    assert.equal(normalizePhone("011987654321"), "+5511987654321");
  });

  it("aceita fixo de 10 dígitos", () => {
    assert.equal(normalizePhone("1133224455"), "+551133224455");
  });

  it("recusa DDD inválido, celular sem 9 e tamanho errado", () => {
    assert.equal(normalizePhone("(01) 98765-4321"), null);
    assert.equal(normalizePhone("11887654321"), null);
    assert.equal(normalizePhone("98765"), null);
  });
});

describe("formatPhone", () => {
  it("formata E.164 de volta para a máscara", () => {
    assert.equal(formatPhone("+5511987654321"), "(11) 98765-4321");
    assert.equal(formatPhone("+551133224455"), "(11) 3322-4455");
    assert.equal(formatPhone(null), "");
  });
});

describe("validatePersonal", () => {
  it("colapsa espaços do nome e deixa telefone opcional", () => {
    const result = validatePersonal({ fullName: "  Ana   Souza ", phone: "" });
    assert.deepEqual(result, { ok: true, value: { fullName: "Ana Souza", phone: null } });
  });

  it("aponta o campo com erro", () => {
    const result = validatePersonal({ fullName: "A", phone: "123" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.fullName);
      assert.ok(result.errors.phone);
    }
  });
});

describe("validateAddress", () => {
  const base = {
    label: "Casa",
    postalCode: "01310-100",
    street: "Av. Paulista",
    number: "1000",
    complement: "",
    neighborhood: "Bela Vista",
  };

  it("normaliza CEP e troca vazio por nulo", () => {
    const result = validateAddress(base);
    assert.deepEqual(result, {
      ok: true,
      value: {
        label: "Casa",
        postal_code: "01310100",
        street: "Av. Paulista",
        number: "1000",
        complement: null,
        neighborhood: "Bela Vista",
      },
    });
  });

  it("exige nome e rua e confere o CEP", () => {
    const result = validateAddress({ ...base, label: " ", street: "", postalCode: "123" });
    assert.equal(result.ok, false);
    if (!result.ok)
      assert.deepEqual(Object.keys(result.errors).sort(), ["label", "postalCode", "street"]);
  });

  it("monta a consulta do geocoder sem cidade", () => {
    const result = validateAddress(base);
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(
        geocodeQuery(result.value),
        "Av. Paulista, 1000 - Bela Vista - 01310-100 - Brasil",
      );
    }
  });
});

describe("formatPostalCode", () => {
  it("põe o hífen", () => {
    assert.equal(formatPostalCode("01310100"), "01310-100");
  });
});
