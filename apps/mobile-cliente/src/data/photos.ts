import { useAsync } from "@vez/mobile-kit/async";

import { supabase } from "../../lib/supabase";
import { coverByEstablishment, PHOTO_BUCKET, type PhotoRow } from "../domain/photos";

/** URL pública de um caminho do bucket de fotos das lojas. */
export function photoUrl(storagePath: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Capa de cada loja de uma lista, numa leitura só.
 *
 * `establishment_photos_select_public` deixa qualquer um (inclusive anônimo)
 * ler as fotos de loja ativa. Falhar aqui não derruba a lista: sem capa, o
 * cartão cai no duotom — a foto é enfeite, a loja é o conteúdo.
 */
export function useCovers(establishmentIds: readonly string[]) {
  const ids = [...new Set(establishmentIds)].sort();
  const { data } = useAsync(
    `covers:${ids.join(",")}`,
    async () => {
      const { data: rows, error } = await supabase
        .from("establishment_photos")
        .select("establishment_id, storage_path, sort_order")
        .in("establishment_id", ids);
      if (error) throw new Error(error.message);
      const covers = coverByEstablishment((rows ?? []) as PhotoRow[]);
      return new Map([...covers].map(([id, row]) => [id, photoUrl(row.storage_path)]));
    },
    { enabled: ids.length > 0 },
  );
  return data ?? new Map<string, string>();
}
