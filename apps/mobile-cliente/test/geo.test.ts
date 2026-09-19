import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { distanceKm, formatDistance, sortByDistance, toCoords } from "../src/domain/geo.ts";

const PAULISTA = { latitude: -23.5613, longitude: -46.6565 };
const SE = { latitude: -23.5505, longitude: -46.6333 };

describe("distanceKm", () => {
  it("é zero para o mesmo ponto", () => {
    assert.equal(distanceKm(PAULISTA, PAULISTA), 0);
  });

  it("mede ~2,7 km entre a Paulista e a Sé", () => {
    const km = distanceKm(PAULISTA, SE);
    assert.ok(km > 2.5 && km < 2.9, `recebido ${km}`);
  });

  it("é simétrica", () => {
    assert.equal(distanceKm(PAULISTA, SE), distanceKm(SE, PAULISTA));
  });
});

describe("toCoords", () => {
  it("aceita numeric do Postgres vindo como string", () => {
    assert.deepEqual(toCoords("-23.5", "-46.6"), { latitude: -23.5, longitude: -46.6 });
  });

  it("recusa nulo, NaN e fora do globo", () => {
    assert.equal(toCoords(null, 1), null);
    assert.equal(toCoords("abc", 1), null);
    assert.equal(toCoords(91, 0), null);
    assert.equal(toCoords(0, -181), null);
  });
});

describe("sortByDistance", () => {
  const rows = [
    { id: "longe", latitude: -23.6, longitude: -46.7 },
    { id: "sem-coord-1", latitude: null, longitude: null },
    { id: "perto", latitude: -23.5614, longitude: -46.6566 },
    { id: "sem-coord-2", latitude: null, longitude: null },
  ];

  it("ordena do mais perto ao mais longe e manda quem não tem coordenada para o fim", () => {
    const sorted = sortByDistance(rows, PAULISTA).map((r) => r.id);
    assert.deepEqual(sorted, ["perto", "longe", "sem-coord-1", "sem-coord-2"]);
  });

  it("sem origem mantém a ordem do servidor e não inventa distância", () => {
    const sorted = sortByDistance(rows, null);
    assert.deepEqual(
      sorted.map((r) => r.id),
      rows.map((r) => r.id),
    );
    assert.ok(sorted.every((r) => r.distanceKm === null));
  });

  it("não muta a lista original", () => {
    const copy = JSON.stringify(rows);
    sortByDistance(rows, PAULISTA);
    assert.equal(JSON.stringify(rows), copy);
  });
});

describe("formatDistance", () => {
  it("usa metros abaixo de 1 km", () => {
    assert.equal(formatDistance(0.347), "350 m");
    assert.equal(formatDistance(0.001), "10 m");
  });

  it("usa uma casa com vírgula até 10 km e inteiro depois", () => {
    assert.equal(formatDistance(1.24), "1,2 km");
    assert.equal(formatDistance(18.6), "19 km");
  });

  it("devolve nulo para distância desconhecida", () => {
    assert.equal(formatDistance(null), null);
    assert.equal(formatDistance(Number.NaN), null);
  });
});
