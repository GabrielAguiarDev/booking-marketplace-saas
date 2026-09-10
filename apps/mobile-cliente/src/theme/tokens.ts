import { color as base } from "@vez/mobile-kit/theme";

export { cardShadow, coralGlow, radius, segmentShadow } from "@vez/mobile-kit/theme";

/**
 * Tokens do app do cliente.
 *
 * Os oito do painel TOKENS vivem em `@vez/mobile-kit/theme`, porque os dois
 * canvases do Vez os escrevem com o mesmo valor. O que está abaixo são as cores
 * que este canvas usa inline e que ganharam nome aqui para não virarem literal
 * solto espalhado pelas telas.
 */
export const color = {
  ...base,

  body: "#4A4E52", // corpo de avaliação
  lineSoft: "#F2F2F3", // divisória interna de lista
  lineChat: "#E6E6E8", // hairline sobre a superfície de repouso
  coralBorder: "#FFD8CE", // borda do selo NOVO
  greenDeep: "#0E8A44", // texto sobre tinta verde
  greenTint: "#EAF7EF",
  amberDeep: "#8A6500", // texto sobre tinta âmbar
  amberTint: "#FCF4E0",
  chevron: "#C9CBCE",
  dotIdle: "#D6D8DA",
  tabIdle: "#E6E6E8",
  tabIdleRing: "#C9CBCE",
  dashed: "#DADBDD",
} as const;

/** Acento e tinta que cada estabelecimento injeta nas telas 8 a 11. */
export type Accent = { accent: string; tint: string };
