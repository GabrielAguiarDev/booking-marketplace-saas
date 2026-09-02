/**
 * Tokens do Vez, transcritos do canvas de design.
 *
 * Os oito tokens nomeados no painel TOKENS do design vêm primeiro; os demais
 * são cores que o design usa inline e que ganharam nome aqui para não virarem
 * literal solto espalhado pelas telas.
 */
export const color = {
  // os oito do painel
  bg: "#FFFFFF", // fundo de tela
  rest: "#F7F7F8", // superfície de repouso
  line: "#ECECEC", // hairline
  coral: "#FF5C3A", // ação primária
  ink: "#14171A", // texto principal
  muted: "#71757A", // texto secundário
  green: "#12A150", // disponível
  amber: "#E0A200", // espera

  // derivados usados inline no design
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

export const radius = {
  sm: 6,
  md: 11,
  lg: 15,
  xl: 18,
  xxl: 20,
  pill: 999,
} as const;

/** Sombra dos cards: 0 2px 12px rgba(20,23,26,.05) no design. */
export const cardShadow = {
  shadowColor: "#14171A",
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

/** Sombra da aba central do tab bar: 0 2px 8px rgba(255,92,58,.22). */
export const coralGlow = {
  shadowColor: color.coral,
  shadowOpacity: 0.22,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
} as const;

/** Sombra da aba/segmento ativo: 0 1px 3px rgba(20,23,26,.10). */
export const segmentShadow = {
  shadowColor: "#14171A",
  shadowOpacity: 0.1,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;
