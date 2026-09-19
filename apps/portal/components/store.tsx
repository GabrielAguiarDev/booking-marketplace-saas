"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo } from "react";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";

import type {
  ApplicationInput,
  EstablishmentRole,
  ExceptionInput,
  PortalData,
  ProfessionalInput,
  PublicProfilePatch,
  RulesPatch,
  ScheduleImpact,
  ServiceInput,
  SettingsPatch,
  TimeWindow,
} from "./model";
import type { PortalOperationActions } from "./operation-model";
import { createPortalActions } from "./supabase-actions";

export type PortalActions = PortalOperationActions & {
  createApplication: (application: ApplicationInput) => Promise<string>;
  resubmitApplication: (establishmentId: string, application: ApplicationInput) => Promise<void>;
  /* P6 — cadastro e negócio */
  saveService: (input: ServiceInput) => Promise<void>;
  setServiceActive: (id: string, isActive: boolean) => Promise<void>;
  saveProfessional: (input: ProfessionalInput) => Promise<void>;
  setProfessionalActive: (id: string, isActive: boolean) => Promise<void>;
  setMemberRole: (
    establishmentId: string,
    userId: string,
    role: EstablishmentRole,
  ) => Promise<void>;
  inviteMember: (input: {
    establishmentId: string;
    email: string;
    name: string;
    role: "manager" | "staff";
    professionalId: string | null;
  }) => Promise<{ invited: boolean }>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  saveBusinessHours: (
    establishmentId: string,
    weekday: number,
    windows: TimeWindow[],
  ) => Promise<void>;
  saveProfessionalSchedule: (
    professionalId: string,
    weekday: number,
    windows: TimeWindow[],
  ) => Promise<void>;
  saveException: (input: ExceptionInput) => Promise<void>;
  removeException: (id: string) => Promise<void>;
  savePublicProfile: (establishmentId: string, patch: PublicProfilePatch) => Promise<void>;
  saveRules: (establishmentId: string, patch: RulesPatch) => Promise<void>;
  saveSettings: (establishmentId: string, patch: SettingsPatch) => Promise<void>;
  uploadPhoto: (establishmentId: string, file: File) => Promise<void>;
  removePhoto: (photo: { id: string; storagePath: string }) => Promise<void>;
  /** Regra R9: o que a mudança de jornada deixaria de fora. Só lê. */
  scheduleImpact: (input: {
    establishmentId: string;
    professionalId: string | null;
    weekday: number | null;
    windows: TimeWindow[];
  }) => Promise<ScheduleImpact[]>;
  blockImpact: (input: {
    establishmentId: string;
    professionalId: string | null;
    date: string;
    startsAt: string | null;
    endsAt: string | null;
  }) => Promise<ScheduleImpact[]>;
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
  const establishmentId = initial?.establishment.id ?? null;
  useEffect(() => {
    if (!establishmentId || initial?.establishment.status !== "active") return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`portal-queue:${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [establishmentId, initial?.establishment.status, router]);
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
