import {
  Activity,
  Brain,
  Hand,
  HandHeart,
  PawPrint,
  ScanFace,
  Scissors,
  Smile,
  Sparkles,
  SprayCan,
  Stethoscope,
} from "lucide-react-native";
import type { ComponentType } from "react";

import type { Database } from "@vez/supabase/types";

export type IconProps = { size: number; color: string; strokeWidth: number };
export type CategoryKey = Database["public"]["Enums"]["establishment_category"];

/**
 * A ponte entre o enum do banco e a identidade visual do design.
 *
 * O banco guarda a categoria em inglês, como todo identificador do projeto. O
 * rótulo em português, o pastel e o ícone são decisão de design e vivem aqui —
 * não no banco, que não deve saber de cor de fundo, e não espalhados pelas
 * telas, onde divergiriam.
 */
export const CATEGORY: Record<
  CategoryKey,
  { label: string; pastel: string; accent: string; Icon: ComponentType<IconProps> }
> = {
  barbershop: { label: "Barbearia", pastel: "#EAF0F7", accent: "#3F6FA8", Icon: Scissors },
  salon: { label: "Cabelo", pastel: "#F7EAF2", accent: "#A8407E", Icon: SprayCan },
  nail_salon: { label: "Unhas", pastel: "#F7EFE8", accent: "#B26A2E", Icon: Hand },
  aesthetic_clinic: { label: "Estética", pastel: "#EFEAF7", accent: "#6A4CA8", Icon: Sparkles },
  dermatology: { label: "Dermato", pastel: "#E6F3F5", accent: "#0B7C8C", Icon: ScanFace },
  dentistry: { label: "Odonto", pastel: "#EAF3EE", accent: "#2E7D5B", Icon: Smile },
  petshop: { label: "Pet", pastel: "#F7F3E6", accent: "#8A7220", Icon: PawPrint },
  massage: { label: "Massagem", pastel: "#F1EFEA", accent: "#6B6455", Icon: HandHeart },
};

export const CATEGORY_KEYS = Object.keys(CATEGORY) as CategoryKey[];

/** Ícones que só aparecem em agrupamentos da tela Explorar. */
export const FAMILY_ICONS = { Activity, Brain, Stethoscope };

/**
 * Acento do estabelecimento.
 *
 * `accent_color` é override de rede com marca própria; o normal é herdar a cor
 * da categoria. Uma cor por loja no cadastro obrigaria todo dono de barbearia a
 * escolher hexadecimal para publicar.
 */
export function accentOf(
  establishment: { category: CategoryKey; accent_color: string | null } | null,
): string {
  if (!establishment) return CATEGORY.barbershop.accent;
  return establishment.accent_color ?? CATEGORY[establishment.category].accent;
}

/** Tinta clara derivada do acento, para fundos de selo e borda selecionada. */
export function tintOf(establishment: { category: CategoryKey } | null): string {
  return establishment ? CATEGORY[establishment.category].pastel : CATEGORY.barbershop.pastel;
}

/** Escurece ou clareia um hex. Usado para gerar o duotone da capa da loja. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * (1 + amount));
  const g = clamp(((n >> 8) & 255) * (1 + amount));
  const b = clamp((n & 255) * (1 + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** "Barbearia Meia-Nove" → "BM". Duas letras para a capa e o avatar. */
export function initialsOfName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
