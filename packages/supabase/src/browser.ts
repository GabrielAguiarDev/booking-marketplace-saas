import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { requireEnv } from "./env";

/**
 * Cliente para componentes que rodam no navegador ("use client").
 * Só enxerga a publishable key, portanto tudo que ele faz passa por RLS.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  );
}

export type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;
