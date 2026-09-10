import { color as base } from "@vez/mobile-kit/theme";

export { cardShadow, coralGlow, radius, segmentShadow } from "@vez/mobile-kit/theme";

/**
 * Tokens do app do estabelecimento.
 *
 * Os oito do painel TOKENS vêm de `@vez/mobile-kit/theme` — os dois canvases do
 * Vez os escrevem com o mesmo valor. O que está abaixo é o vocabulário que só
 * este canvas usa, e ele conta uma história diferente da do app do cliente: o
 * cliente escolhe, a loja decide. Decidir tem consequência, e por isso aqui
 * existem um vermelho de recusa e três tintas de estado que lá não fazem falta.
 */
export const color = {
  ...base,

  // Recusa, cancelamento, contestação. O único vermelho do produto.
  danger: "#D92D20",
  dangerTint: "#FDECEA",

  // Tintas de estado, sempre em par com a cor do traço.
  greenTint: "#E7F6EC",
  greenDeep: "#0B6B34",
  amberTint: "#FCF3DC",
  amberDeep: "#8A6500",
  coralTint: "#FFF0EC",
  coralSoft: "#FFF4F1",
  coralPale: "#FFF9F7",
  coralBorder: "#FFD7CC",
  coralDeep: "#B5482F",
  coralFaded: "#FFB9A6",

  // Escala de cinza do canvas, do texto terciário até a divisória interna.
  faint: "#9A9DA2", // hora vazia, rótulo de bloco
  hint: "#B9BCC0", // texto de placeholder
  chevron: "#C6C8CB",
  track: "#DCDCDE", // trilho do interruptor desligado
  stroke: "#E3E3E5", // borda tracejada, alça da folha
  lineSoft: "#F0F0F1", // divisória interna de lista
  fill: "#F2F2F4", // preenchimento de barra vazia
  neutralTint: "#ECECEE", // selo de origem "balcão"
} as const;

/** Sombra da ação flutuante da fila: `0 6px 18px rgba(255,92,58,.32)`. */
export const actionGlow = {
  shadowColor: color.coral,
  shadowOpacity: 0.32,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
} as const;

/** Sombra dos cartões deste canvas: `0 1px 3px rgba(20,23,26,.05)`. */
export const tileShadow = {
  shadowColor: "#14171A",
  shadowOpacity: 0.05,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;

/** Sombra da folha inferior: `0 -8px 30px rgba(20,23,26,.18)`. */
export const sheetShadow = {
  shadowColor: "#14171A",
  shadowOpacity: 0.18,
  shadowRadius: 30,
  shadowOffset: { width: 0, height: -8 },
  elevation: 12,
} as const;
