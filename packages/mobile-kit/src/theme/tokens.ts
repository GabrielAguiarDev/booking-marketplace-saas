/**
 * Os tokens que os dois canvases do Vez repetem valor por valor.
 *
 * Aqui vivem só os oito nomeados no painel TOKENS do design, mais raio e
 * sombra. As cores derivadas — as que cada canvas usa inline em um punhado de
 * lugares — ficam no `theme/tokens.ts` de cada app, que estende este objeto:
 * o app do cliente tem tinta de avaliação, o do estabelecimento tem vermelho
 * de recusa, e nenhum dos dois precisa carregar o vocabulário do outro.
 */
export const color = {
  bg: "#FFFFFF", // fundo de tela
  rest: "#F7F7F8", // superfície de repouso
  line: "#ECECEC", // hairline
  coral: "#FF5C3A", // ação primária
  ink: "#14171A", // texto principal
  muted: "#71757A", // texto secundário
  green: "#12A150", // disponível
  amber: "#E0A200", // espera
} as const;

export const radius = {
  sm: 6,
  md: 11,
  lg: 15,
  xl: 18,
  xxl: 20,
  pill: 999,
} as const;

/** Sombra dos cards: `0 2px 12px rgba(20,23,26,.05)` no design. */
export const cardShadow = {
  shadowColor: "#14171A",
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

/** Brilho coral da ação em destaque: `0 2px 8px rgba(255,92,58,.22)`. */
export const coralGlow = {
  shadowColor: color.coral,
  shadowOpacity: 0.22,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
} as const;

/** Sombra do segmento ativo: `0 1px 3px rgba(20,23,26,.10)`. */
export const segmentShadow = {
  shadowColor: "#14171A",
  shadowOpacity: 0.1,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;
