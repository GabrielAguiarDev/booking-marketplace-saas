/**
 * Dados da empresa e destinos externos da landing, lidos do ambiente.
 *
 * Nada aqui tem valor padrão inventado: CNPJ, razão social, e-mail e link de
 * loja de app só aparecem quando alguém configurou e o valor passa na
 * validação. Um CNPJ de mentira no rodapé é pior que nenhum — é dado jurídico
 * falso numa página pública.
 *
 * Este módulo é puro (recebe o ambiente como argumento) para dar para testar
 * sem Next; `site.ts` faz a leitura de `process.env` com nomes literais.
 */

export type SiteEnv = {
  companyName?: string;
  companyCnpj?: string;
  companyAddress?: string;
  contactEmail?: string;
  contactWhatsapp?: string;
  privacyEmail?: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
};

export type SiteConfig = {
  /** Razão social. Nulo enquanto não configurada. */
  companyName: string | null;
  /** CNPJ formatado, só quando o dígito verificador confere. */
  companyCnpj: string | null;
  companyAddress: string | null;
  contactEmail: string | null;
  /** `https://wa.me/<dígitos>` pronto para o link. */
  contactWhatsappUrl: string | null;
  /** O número como o dono lê: `+55 47 99999-0000`. */
  contactWhatsappLabel: string | null;
  /** Canal do titular de dados (LGPD). Cai no e-mail de contato se faltar. */
  privacyEmail: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
};

function clean(value: string | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(value: string | undefined): string | null {
  const text = clean(value);
  return text && EMAIL.test(text) ? text.toLowerCase() : null;
}

/** Só `https:` — link de loja em `http:` ou `javascript:` não entra na página. */
export function validHttpsUrl(value: string | undefined): string | null {
  const text = clean(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * CNPJ com dígito verificador, já no formato alfanumérico da Receita
 * (jul/2026) — a mesma regra de `establishment_application_normalize` no
 * banco: os 12 primeiros caracteres podem ser letra ou número, cada caractere
 * vale o código ASCII menos 48, e os dois últimos são dígitos.
 */
export function normalizeCnpj(value: string | undefined): string | null {
  const raw = clean(value)
    ?.toUpperCase()
    .replace(/[.\-/\s]/g, "");
  if (!raw || !/^[0-9A-Z]{12}[0-9]{2}$/.test(raw)) return null;
  if (/^(.)\1{13}$/.test(raw)) return null;

  const values = [...raw].map((char) => char.charCodeAt(0) - 48);
  const digit = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + weight * values[index]!, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  if (digit(12) !== values[12] || digit(13) !== values[13]) return null;

  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
}

/** Aceita `+55 (47) 99999-0000`, `5547999990000` ou `47 99999-0000` (supõe Brasil). */
export function normalizeWhatsapp(
  value: string | undefined,
): { url: string; label: string } | null {
  const digits = clean(value)?.replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!/^55\d{10,11}$/.test(full)) return null;

  const area = full.slice(2, 4);
  const local = full.slice(4);
  const split = local.length - 4;
  return {
    url: `https://wa.me/${full}`,
    label: `+55 ${area} ${local.slice(0, split)}-${local.slice(split)}`,
  };
}

export function readSiteConfig(env: SiteEnv): SiteConfig {
  const whatsapp = normalizeWhatsapp(env.contactWhatsapp);
  const contactEmail = validEmail(env.contactEmail);
  return {
    companyName: clean(env.companyName),
    companyCnpj: normalizeCnpj(env.companyCnpj),
    companyAddress: clean(env.companyAddress),
    contactEmail,
    contactWhatsappUrl: whatsapp?.url ?? null,
    contactWhatsappLabel: whatsapp?.label ?? null,
    privacyEmail: validEmail(env.privacyEmail) ?? contactEmail,
    appStoreUrl: validHttpsUrl(env.appStoreUrl),
    playStoreUrl: validHttpsUrl(env.playStoreUrl),
  };
}
