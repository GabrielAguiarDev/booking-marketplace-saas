import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { failureKind, isNetworkErrorMessage } from "../src/domain/network.ts";
import { coverByEstablishment, orderedPhotos, usableImageUrl } from "../src/domain/photos.ts";

describe("isNetworkErrorMessage", () => {
  it("reconhece as mensagens de fetch de cada plataforma", () => {
    for (const message of [
      "TypeError: Network request failed",
      "Failed to fetch",
      "NetworkError when attempting to fetch resource.",
      "Load failed",
      "fetch failed",
      "connect ECONNREFUSED 127.0.0.1:54321",
    ]) {
      assert.equal(isNetworkErrorMessage(message), true, message);
    }
  });

  it("não confunde erro do servidor com falta de rede", () => {
    assert.equal(isNetworkErrorMessage("permission denied for table appointments"), false);
    assert.equal(isNetworkErrorMessage(null), false);
  });
});

describe("failureKind", () => {
  it("aparelho sem rede vence a mensagem", () => {
    assert.equal(failureKind("permission denied", false), "offline");
  });

  it("sem saber o estado da rede, a mensagem decide", () => {
    assert.equal(failureKind("Network request failed", null), "offline");
    assert.equal(failureKind("JWT expired", true), "server");
  });
});

describe("coverByEstablishment", () => {
  it("escolhe a de menor sort_order por loja", () => {
    const covers = coverByEstablishment([
      { establishment_id: "a", storage_path: "a/2.jpg", sort_order: 2 },
      { establishment_id: "a", storage_path: "a/1.jpg", sort_order: 1 },
      { establishment_id: "b", storage_path: "b/z.jpg", sort_order: 0 },
      { establishment_id: "b", storage_path: "b/a.jpg", sort_order: 0 },
    ]);
    assert.equal(covers.get("a")?.storage_path, "a/1.jpg");
    assert.equal(covers.get("b")?.storage_path, "b/a.jpg");
    assert.equal(covers.get("c"), undefined);
  });
});

describe("orderedPhotos", () => {
  it("ordena por sort_order sem mutar", () => {
    const rows = [
      { sort_order: 3, storage_path: "x" },
      { sort_order: 1, storage_path: "y" },
    ];
    assert.deepEqual(
      orderedPhotos(rows).map((r) => r.storage_path),
      ["y", "x"],
    );
    assert.equal(rows[0]?.storage_path, "x");
  });
});

describe("usableImageUrl", () => {
  it("só aceita URL http(s) absoluta", () => {
    assert.equal(usableImageUrl("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
    assert.equal(usableImageUrl("a/b.jpg"), null);
    assert.equal(usableImageUrl("javascript:alert(1)"), null);
    assert.equal(usableImageUrl(null), null);
  });
});
