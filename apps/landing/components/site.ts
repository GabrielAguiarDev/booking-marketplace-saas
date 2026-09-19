import { readSiteConfig } from "./site-config";

/**
 * A configuração da landing, montada uma vez.
 *
 * Cada `process.env.NEXT_PUBLIC_…` está escrito por extenso: o Next só
 * substitui no build o acesso literal (ver `portal.ts`). Todas são opcionais;
 * o que faltar some da página em vez de virar texto de exemplo.
 */
export const SITE = readSiteConfig({
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME,
  companyCnpj: process.env.NEXT_PUBLIC_COMPANY_CNPJ,
  companyAddress: process.env.NEXT_PUBLIC_COMPANY_ADDRESS,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  contactWhatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP,
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL,
  appStoreUrl: process.env.NEXT_PUBLIC_CLIENT_APP_STORE_URL,
  playStoreUrl: process.env.NEXT_PUBLIC_CLIENT_PLAY_STORE_URL,
});

/** Destinos internos. Absolutos a partir da raiz para funcionar fora da home. */
export const ROUTES = {
  home: "/",
  signupForm: "/#cadastro",
  plans: "/#planos",
  faq: "/#duvidas",
  customerApp: "/cliente",
  customerDownload: "/cliente#baixar",
  customerBooking: "/cliente#como-agendar",
  customerQueue: "/cliente#fila",
  terms: "/termos",
  privacy: "/privacidade",
} as const;
