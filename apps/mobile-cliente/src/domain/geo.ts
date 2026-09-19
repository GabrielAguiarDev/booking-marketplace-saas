/**
 * Distância e ordenação por proximidade.
 *
 * Roda no aparelho, de propósito: a posição da pessoa nunca sai do telefone.
 * O servidor já devolve latitude/longitude de cada loja em
 * `search_establishments`; ordenar aqui evita mandar a localização do cliente
 * para o banco só para receber de volta a mesma lista em outra ordem.
 *
 * Módulo puro (sem React Native) para rodar nos testes com `node --test`.
 */

export type Coords = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;

/** Distância em km pela fórmula de haversine — precisa o bastante para "perto de você". */
export function distanceKm(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Coordenadas utilizáveis: presentes, numéricas e dentro do globo. */
export function toCoords(
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined,
): Coords | null {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined
  ) {
    return null;
  }
  // `numeric` do Postgres pode chegar como string pelo PostgREST.
  const lat = typeof latitude === "string" ? Number(latitude) : latitude;
  const lon = typeof longitude === "string" ? Number(longitude) : longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { latitude: lat, longitude: lon };
}

export type WithDistance<T> = T & { distanceKm: number | null };

/**
 * Anexa a distância e ordena da mais perto para a mais longe.
 *
 * Sem origem, devolve a lista na ordem do servidor com distância nula — a tela
 * não inventa proximidade que não sabe. Loja sem coordenada vai para o fim,
 * mantendo entre si a ordem original (ordenação estável).
 */
export function sortByDistance<
  T extends { latitude: number | string | null; longitude: number | string | null },
>(rows: readonly T[], origin: Coords | null): WithDistance<T>[] {
  const withDistance = rows.map((row, index) => {
    const coords = toCoords(row.latitude, row.longitude);
    return {
      row: { ...row, distanceKm: origin && coords ? distanceKm(origin, coords) : null },
      index,
    };
  });

  if (!origin) return withDistance.map(({ row }) => row);

  return withDistance
    .sort((a, b) => {
      const da = a.row.distanceKm;
      const db = b.row.distanceKm;
      if (da === null && db === null) return a.index - b.index;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db || a.index - b.index;
    })
    .map(({ row }) => row);
}

/** "350 m", "1,2 km", "18 km". Abaixo de 1 km, arredonda em dezenas de metros. */
export function formatDistance(km: number | null): string | null {
  if (km === null || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}
