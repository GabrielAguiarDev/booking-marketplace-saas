import type { TextStyle } from "react-native";

import { color } from "./tokens";

/**
 * Tipografia do design.
 *
 * O canvas escreve entrelinha de letra em `em` (`letter-spacing:-.035em`).
 * O React Native só aceita pixel, então `ls` recebe o valor em `em` e é
 * multiplicado pelo tamanho da fonte aqui — assim o número no código continua
 * sendo o mesmo que está no design, e a conversão fica num lugar só.
 */

const SANS = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
} as const;

const MONO = {
  400: "IBMPlexMono_400Regular",
  500: "IBMPlexMono_500Medium",
  600: "IBMPlexMono_600SemiBold",
} as const;

export const fontsToLoad = { ...SANS, ...MONO };

type SansWeight = keyof typeof SANS;
type MonoWeight = keyof typeof MONO;

type Opts = { ls?: number; lh?: number; color?: string };

/** Plus Jakarta Sans — nome e hierarquia. */
export function sans(size: number, weight: SansWeight, opts: Opts = {}): TextStyle {
  return {
    fontFamily: SANS[weight],
    fontSize: size,
    letterSpacing: opts.ls === undefined ? undefined : opts.ls * size,
    lineHeight: opts.lh === undefined ? undefined : opts.lh * size,
    color: opts.color ?? color.ink,
  };
}

/** IBM Plex Mono — hora, preço, distância, contagem, posição na fila. */
export function mono(size: number, weight: MonoWeight, opts: Opts = {}): TextStyle {
  return {
    fontFamily: MONO[weight],
    fontSize: size,
    letterSpacing: opts.ls === undefined ? undefined : opts.ls * size,
    lineHeight: opts.lh === undefined ? undefined : opts.lh * size,
    color: opts.color ?? color.ink,
  };
}

/** Rótulo mono de seção: `10px/600/.12em` em cinza. */
export const sectionLabel = mono(10, 600, { ls: 0.12, color: color.muted });

/** Título de seção dentro da tela: `21px/800/-.03em`. */
export const sectionTitle = sans(21, 800, { ls: -0.03 });

/** Título de tela: `30px/800/-.04em`. */
export const screenTitle = sans(30, 800, { ls: -0.04 });
