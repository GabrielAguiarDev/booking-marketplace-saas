import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Adapter de storage do Supabase Auth sobre o expo-secure-store, com partição.
 *
 * O Keystore do Android rejeita valores acima de ~2048 bytes. A sessão do
 * Supabase (access token + refresh token + user) passa disso com folga assim
 * que o usuário tem metadados, e o login quebra em produção sem aviso claro.
 * Por isso o valor é quebrado em pedaços e remontado na leitura.
 *
 * Na web o `expo-secure-store` não existe (o módulo nativo nem é registrado, e
 * a primeira leitura derruba a criação do cliente antes da primeira consulta).
 * Lá o adapter cai para o `localStorage`, que é o que o próprio Supabase usa no
 * navegador. É só o alvo de desenvolvimento — `expo start --web` é como estas
 * telas são conferidas — e nada do que o app publica roda nesse caminho.
 */

const web = Platform.OS === "web";

const store = {
  get(key: string): Promise<string | null> {
    if (web) return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null);
    return SecureStore.getItemAsync(key);
  },
  set(key: string, value: string): Promise<void> {
    if (web) {
      globalThis.localStorage?.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  remove(key: string): Promise<void> {
    if (web) {
      globalThis.localStorage?.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

const MAX_CHUNK_BYTES = 1536;
const CHUNK_MARKER = "__vez_chunks__:";

/** Tamanho em UTF-8 sem depender de TextEncoder, que nem todo runtime RN expõe. */
function byteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // par substituto: conta os dois code units de uma vez
      bytes += 4;
      i += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/** Quebra respeitando code points, para nunca partir um par substituto ao meio. */
function splitByBytes(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const codePoint of value) {
    const size = byteLength(codePoint);
    if (currentBytes + size > maxBytes && current !== "") {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += codePoint;
    currentBytes += size;
  }

  if (current !== "") {
    chunks.push(current);
  }
  return chunks;
}

const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function removeChunks(key: string, head: string | null): Promise<void> {
  if (head === null || !head.startsWith(CHUNK_MARKER)) {
    return;
  }
  const count = Number.parseInt(head.slice(CHUNK_MARKER.length), 10);
  if (!Number.isFinite(count)) {
    return;
  }
  for (let i = 0; i < count; i += 1) {
    await store.remove(chunkKey(key, i));
  }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const head = await store.get(key);
    if (head === null || !head.startsWith(CHUNK_MARKER)) {
      return head;
    }

    const count = Number.parseInt(head.slice(CHUNK_MARKER.length), 10);
    if (!Number.isFinite(count)) {
      return null;
    }

    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await store.get(chunkKey(key, i));
      if (part === null) {
        // Gravação interrompida no meio. Sessão parcial é pior que sessão
        // nenhuma: limpa e devolve null para forçar um login limpo.
        await this.removeItem(key);
        return null;
      }
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    // Remove primeiro: se o valor novo tiver menos pedaços que o antigo, os
    // pedaços sobrando ficariam órfãos no Keystore.
    await this.removeItem(key);

    if (byteLength(value) <= MAX_CHUNK_BYTES) {
      await store.set(key, value);
      return;
    }

    const chunks = splitByBytes(value, MAX_CHUNK_BYTES);
    for (let i = 0; i < chunks.length; i += 1) {
      await store.set(chunkKey(key, i), chunks[i]!);
    }
    await store.set(key, `${CHUNK_MARKER}${chunks.length}`);
  },

  async removeItem(key: string): Promise<void> {
    const head = await store.get(key);
    await removeChunks(key, head);
    await store.remove(key);
  },
};
