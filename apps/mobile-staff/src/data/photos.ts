import { useAsync } from "@vez/mobile-kit/async";

import { supabase } from "../../lib/supabase";
import {
  PHOTO_BUCKET,
  photoErrorMessage,
  photoMime,
  photoProblem,
  photoStoragePath,
} from "./photo-rules";

export type Photo = { id: string; storagePath: string; url: string; sortOrder: number };

/** Fotos do perfil público, na ordem em que o app do cliente mostra. */
export function usePhotos(establishmentId: string | null) {
  return useAsync(
    `photos:${establishmentId}`,
    async () => {
      const { data, error } = await supabase
        .from("establishment_photos")
        .select("id, storage_path, sort_order")
        .eq("establishment_id", establishmentId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw new Error(error.message);

      return (data ?? []).map<Photo>((row) => ({
        id: row.id,
        storagePath: row.storage_path,
        sortOrder: row.sort_order,
        url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
      }));
    },
    { enabled: Boolean(establishmentId) },
  );
}

export type PickedPhoto = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
};

/**
 * Envia para o bucket e registra a linha. Levanta com frase para a tela.
 *
 * Mesma ordem do portal: arquivo primeiro, linha depois. Se a linha falhar, o
 * arquivo é apagado — sem ela, ele ficaria órfão no bucket e invisível na tela.
 */
export async function uploadPhoto(
  establishmentId: string,
  asset: PickedPhoto,
  sortOrder: number,
): Promise<void> {
  const mime = photoMime(asset);
  const problem = photoProblem(mime, asset.fileSize);
  if (problem || !mime) throw new Error(problem ?? "Formato não aceito.");

  let body: ArrayBuffer;
  try {
    // `fetch` lê tanto `file://` (iOS/Android) quanto `blob:` (web). O
    // supabase-js não aceita a URI direto no React Native.
    body = await (await fetch(asset.uri)).arrayBuffer();
  } catch {
    throw new Error("Não foi possível ler a imagem escolhida.");
  }
  const problemAfterRead = photoProblem(mime, body.byteLength);
  if (problemAfterRead) throw new Error(problemAfterRead);

  const path = photoStoragePath(establishmentId, mime);
  const uploaded = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: mime, upsert: false });
  if (uploaded.error) throw new Error(photoErrorMessage(uploaded.error.message));

  const { error } = await supabase
    .from("establishment_photos")
    .insert({ establishment_id: establishmentId, storage_path: path, sort_order: sortOrder });
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error(photoErrorMessage(error.message));
  }
}

/** Apaga a linha e depois o arquivo. Sem a linha, o app do cliente já não mostra. */
export async function removePhoto(photo: Photo): Promise<void> {
  const { error } = await supabase.from("establishment_photos").delete().eq("id", photo.id);
  if (error) throw new Error(photoErrorMessage(error.message));
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storagePath]);
}
