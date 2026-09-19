/**
 * Fotos reais das lojas.
 *
 * O portal grava em `establishment_photos` o caminho dentro do bucket público
 * `establishment-photos` (`<id da loja>/<arquivo>`); a ordem é `sort_order`.
 * A primeira é a capa. Loja sem foto continua com o duotom da marca — o campo
 * de fotografia foi desenhado para isso.
 *
 * Módulo puro (sem React Native) para rodar nos testes com `node --test`.
 */

export const PHOTO_BUCKET = "establishment-photos";

export type PhotoRow = {
  establishment_id: string;
  storage_path: string;
  sort_order: number;
  alt_text?: string | null;
};

/** A capa de cada loja: a foto de menor `sort_order`, empate pelo caminho. */
export function coverByEstablishment(rows: readonly PhotoRow[]): Map<string, PhotoRow> {
  const covers = new Map<string, PhotoRow>();
  for (const row of rows) {
    const current = covers.get(row.establishment_id);
    if (
      !current ||
      row.sort_order < current.sort_order ||
      (row.sort_order === current.sort_order && row.storage_path < current.storage_path)
    ) {
      covers.set(row.establishment_id, row);
    }
  }
  return covers;
}

/** Ordena as fotos de uma loja para a galeria. */
export function orderedPhotos<T extends { sort_order: number; storage_path: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) => a.sort_order - b.sort_order || a.storage_path.localeCompare(b.storage_path),
  );
}

/** `avatar_url` de profissional só vale se for URL absoluta http(s). */
export function usableImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}
