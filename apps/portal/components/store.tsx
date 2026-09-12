"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo } from "react";

import type { ApplicationInput, PortalData } from "./model";
import { createPortalActions } from "./supabase-actions";

export type PortalActions = {
  createApplication: (application: ApplicationInput) => Promise<string>;
  resubmitApplication: (
    establishmentId: string,
    application: ApplicationInput,
  ) => Promise<void>;
};

type PortalStore = { data: PortalData | null; actions: PortalActions };
const Context = createContext<PortalStore | null>(null);

/**
 * Fronteira estável para P5/P6: telas leem `data` e chamam `actions`.
 * Consultas ficam no Server Component; ações reais ficam em supabase-actions.
 */
export function PortalProvider({
  initial,
  children,
}: {
  initial: PortalData | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const value = useMemo(
    () => ({ data: initial, actions: createPortalActions(() => router.refresh()) }),
    [initial, router],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePortal(): PortalStore {
  const value = useContext(Context);
  if (!value) throw new Error("usePortal precisa estar dentro de PortalProvider.");
  return value;
}
