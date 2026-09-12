"use client";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";

import type { ApplicationInput } from "./model";
import type { PortalActions } from "./store";

/** Escritas do P2; P5 e P6 ampliam este objeto, mantendo `router.refresh()`. */
export function createPortalActions(refresh: () => void): PortalActions {
  const supabase = createBrowserSupabaseClient();

  return {
    createApplication: async (application: ApplicationInput) => {
      const { data, error } = await supabase.functions.invoke("create-establishment", {
        body: application,
      });
      if (error) {
        const context = error.context as Response | undefined;
        if (context) {
          const payload = (await context.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(payload?.error?.message || error.message);
        }
        throw new Error(error.message);
      }
      refresh();
      return (data as { establishment_id: string }).establishment_id;
    },
    resubmitApplication: async (establishmentId, application) => {
      const { error } = await supabase.rpc("resubmit_establishment_application", {
        p_establishment_id: establishmentId,
        p_application: application,
      });
      if (error) throw new Error(error.message);
      refresh();
    },
  };
}
