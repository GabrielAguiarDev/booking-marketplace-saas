import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Anexos de chamado, iguais para o app do cliente, o da loja e o admin.
 *
 * Tudo aqui espelha `20260917133000_support_attachments.sql`: bucket privado
 * `support-attachments`, 10 MB, JPEG/PNG/WebP/HEIC/PDF, caminho
 * `<ticket_id>/<uuid>.<ext>` (é a primeira pasta que a política lê), no máximo
 * 10 por chamado. Conferir antes só poupa a pessoa de esperar um envio que o
 * Storage vai recusar; quem manda é o banco.
 *
 * Fluxo: sobe o arquivo, chama `attach_support_file` e, se o registro falhar,
 * apaga o arquivo (a política deixa quem subiu apagar enquanto ele não virou
 * anexo). Ler é sempre por URL assinada de curta duração.
 */

export const ATTACHMENT_BUCKET = "support-attachments";
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_LIMIT = 10;
/** Tempo de vida da URL assinada: o bastante para abrir, curto para vazar. */
export const ATTACHMENT_URL_TTL = 300;

const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
} as const;

export type AttachmentMime = keyof typeof TYPES;

const EXTENSIONS: Record<string, AttachmentMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  pdf: "application/pdf",
};

/** O tipo aceito do arquivo; a extensão vale quando o seletor não informa. */
export function attachmentMime(input: {
  mimeType?: string | null;
  name?: string | null;
}): AttachmentMime | null {
  const declared = input.mimeType?.toLowerCase().trim();
  if (declared && declared in TYPES) return declared as AttachmentMime;
  if (declared === "image/jpg") return "image/jpeg";
  if (declared === "image/heif") return "image/heic";
  const extension = (input.name ?? "").split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSIONS[extension] ?? null;
}

export function isImageAttachment(mime: string): boolean {
  return mime.startsWith("image/");
}

/** Recusa antes de enviar. Nulo quando o arquivo passa. */
export function attachmentProblem(input: {
  mime: AttachmentMime | null;
  size: number | null | undefined;
  count: number;
}): string | null {
  if (input.count >= ATTACHMENT_LIMIT) return `O chamado já tem ${ATTACHMENT_LIMIT} anexos.`;
  if (!input.mime) return "Formato não aceito. Envie imagem (JPG, PNG, WebP, HEIC) ou PDF.";
  if (input.size && input.size > ATTACHMENT_MAX_BYTES) return "O arquivo passa de 10 MB.";
  return null;
}

/** uuid v4 em minúsculas — o formato que a restrição do caminho aceita. */
export function attachmentUuid(random: (bytes: Uint8Array) => Uint8Array = fillRandom): string {
  const bytes = random(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function fillRandom(bytes: Uint8Array): Uint8Array {
  const crypto = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } })
    .crypto;
  if (crypto?.getRandomValues) return crypto.getRandomValues(bytes);
  // Hermes sem polyfill: o nome só precisa não colidir, não é segredo.
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** `<ticket>/<uuid>.<ext>` — casa com `support_ticket_attachments_path_format`. */
export function attachmentPath(ticketId: string, mime: AttachmentMime, uuid = attachmentUuid()) {
  return `${ticketId.toLowerCase()}/${uuid}.${TYPES[mime]}`;
}

/** Nome mostrado: sem pasta, sem quebra de linha, até 160 caracteres. */
export function attachmentFileName(name: string | null | undefined, mime: AttachmentMime): string {
  const base =
    (name ?? "")
      .split(/[\\/]/)
      .pop()
      ?.replace(/[\r\n]/g, " ")
      .trim() ?? "";
  return (base || `anexo.${TYPES[mime]}`).slice(0, 160);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Erro do Storage ou do banco em frase de gente. */
export function attachmentErrorMessage(error: {
  message?: string;
  hint?: string | null;
  code?: string;
}): string {
  const message = error.message ?? "";
  switch (error.hint) {
    case "attachment_limit":
    case "invalid_type":
    case "object_missing":
    case "invalid_message":
      return message;
    case "not_found":
      return "Chamado não encontrado.";
  }
  if (/bucket.*not found|not found.*bucket/i.test(message)) {
    return "Os anexos ainda não estão disponíveis neste ambiente.";
  }
  if (/mime|content type/i.test(message)) {
    return "Formato não aceito. Envie imagem (JPG, PNG, WebP, HEIC) ou PDF.";
  }
  if (/exceeded|too large|payload/i.test(message)) return "O arquivo passa de 10 MB.";
  if (/row-level security|violates|unauthorized|403/i.test(message)) {
    return "Chamado resolvido não recebe anexo. Responda primeiro para reabrir.";
  }
  if (/network|fetch/i.test(message)) return "Sem conexão. Tente de novo.";
  return "Não foi possível anexar o arquivo. Tente de novo.";
}

export type Attachment = {
  id: string;
  messageId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fromStaff: boolean;
  createdAt: string;
  /** Nulo quando a assinatura falhou — a linha aparece, sem abrir. */
  url: string | null;
};

type AttachmentRow = {
  id: string;
  message_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  from_staff: boolean;
  created_at: string;
};

/** Os anexos do chamado, com URL assinada de curta duração. */
export async function listAttachments(
  supabase: SupabaseClient,
  ticketId: string,
): Promise<Attachment[]> {
  const { data, error } = await supabase.rpc("support_ticket_attachments", {
    p_ticket_id: ticketId,
  });
  if (error) throw new Error(attachmentErrorMessage(error));
  const rows = (data ?? []) as AttachmentRow[];
  if (rows.length === 0) return [];

  const signed = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(
    rows.map((row) => row.storage_path),
    ATTACHMENT_URL_TTL,
  );
  const urls = new Map<string, string>();
  for (const item of signed.data ?? []) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }

  return rows.map((row) => ({
    id: row.id,
    messageId: row.message_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    fromStaff: row.from_staff,
    createdAt: row.created_at,
    url: urls.get(row.storage_path) ?? null,
  }));
}

export type AttachResult = { ok: true; id: string } | { ok: false; message: string };

/** Sobe e registra. Se o registro falhar, o arquivo solto é apagado. */
export async function uploadAttachment(
  supabase: SupabaseClient,
  input: {
    ticketId: string;
    body: ArrayBuffer | Blob;
    mime: AttachmentMime;
    fileName: string | null | undefined;
    messageId?: string | null;
  },
): Promise<AttachResult> {
  const path = attachmentPath(input.ticketId, input.mime);
  const storage = supabase.storage.from(ATTACHMENT_BUCKET);

  const uploaded = await storage.upload(path, input.body, {
    contentType: input.mime,
    upsert: false,
  });
  if (uploaded.error) return { ok: false, message: attachmentErrorMessage(uploaded.error) };

  const { data, error } = await supabase.rpc("attach_support_file", {
    p_ticket_id: input.ticketId,
    p_storage_path: path,
    p_file_name: attachmentFileName(input.fileName, input.mime),
    ...(input.messageId ? { p_message_id: input.messageId } : {}),
  });
  if (error) {
    await storage.remove([path]).then(
      () => undefined,
      () => undefined,
    );
    return { ok: false, message: attachmentErrorMessage(error) };
  }
  return { ok: true, id: data as string };
}
