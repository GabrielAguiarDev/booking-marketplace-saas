"use client";

import { Billing } from "./billing";
import { ToastProvider } from "./cadastro-ui";
import type { SectionId } from "./data";
import { Finance } from "./finance";
import { Hours } from "./hours";
import { Profile } from "./profile";
import { Services } from "./services";
import { Settings } from "./settings";
import { Team } from "./team";

/** Seções de cadastro e negócio (P6). Uma porta só para o `portal.tsx`. */
export const CADASTRO_SECTIONS = new Set<SectionId>([
  "services",
  "team",
  "hours",
  "profile",
  "settings",
  "billing",
  "finance",
]);

export function CadastroSection({ section }: { section: SectionId }) {
  return (
    <ToastProvider>
      {section === "services" ? (
        <Services />
      ) : section === "team" ? (
        <Team />
      ) : section === "hours" ? (
        <Hours />
      ) : section === "profile" ? (
        <Profile />
      ) : section === "settings" ? (
        <Settings />
      ) : section === "billing" ? (
        <Billing />
      ) : (
        <Finance />
      )}
    </ToastProvider>
  );
}
