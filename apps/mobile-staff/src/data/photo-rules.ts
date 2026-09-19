/**
 * Regras do envio de foto do perfil público, sem nada de React Native — para
 * dar para testar com `node --test`.
 *
 * Tudo aqui espelha o que o banco já impõe (migration `portal_cadastro`): o
 * bucket aceita JPG, PNG e WebP até 5 MB, e `establishment_photos.storage_path`
 * precisa ser `<id da loja>/<arquivo>`, que é como a política do bucket sabe de
 * quem é o arquivo. Conferir antes só poupa o dono de esperar um upload que o
 * Storage vai recusar.
 */

export const PHOTO_BUCKET = "establishment-photos";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PhotoMime = keyof typeof TYPES;

/**
 * O tipo do arquivo escolhido. A galeria às vezes não informa `mimeType`
 * (web, arquivos antigos); aí vale a extensão do nome ou da URI.
 */
export function photoMime(asset: {
  mimeType?: string | null;
  fileName?: string | null;
  uri: string;
}): PhotoMime | null {
  const declared = asset.mimeType?.toLowerCase();
  if (declared && declared in TYPES) return declared as PhotoMime;
  if (declared === "image/jpg") return "image/jpeg";

  const name = (asset.fileName ?? asset.uri.split("?")[0] ?? "").toLowerCase();
  const extension = name.split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return null;
}

/** `<loja>/<carimbo>-<aleatório>.<ext>` — casa com a restrição do banco. */
export function photoStoragePath(
  establishmentId: string,
  mime: PhotoMime,
  now: number = Date.now(),
  random: string = Math.random().toString(36).slice(2, 8),
): string {
  const suffix = random.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "foto";
  return `${establishmentId}/${now.toString(36)}-${suffix}.${TYPES[mime]}`;
}

/** Recusa antes de enviar. Nulo quando o arquivo passa. */
export function photoProblem(
  mime: PhotoMime | null,
  size: number | null | undefined,
): string | null {
  if (!mime) return "Formato não aceito. Envie JPG, PNG ou WebP.";
  if (size && size > PHOTO_MAX_BYTES) return "A imagem passa de 5 MB. Escolha outra ou recorte.";
  return null;
}

/** Erro do Storage ou do banco em frase de gente. */
export function photoErrorMessage(message: string): string {
  if (/mime|content type/i.test(message)) return "Formato não aceito. Envie JPG, PNG ou WebP.";
  if (/exceeded|too large|payload/i.test(message)) return "A imagem passa de 5 MB.";
  if (/row-level security|violates row-level|unauthorized|403/i.test(message)) {
    return "Só dono ou gerência da loja pode mudar as fotos.";
  }
  if (/storage_path_format/i.test(message)) return "Nome de arquivo não aceito.";
  if (/network|fetch/i.test(message)) return "Sem conexão. Tente de novo.";
  return "Não foi possível enviar a foto.";
}
