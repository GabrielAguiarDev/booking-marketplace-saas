import type { ReactNode } from "react";
import { ScrollView, type StyleProp, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color } from "../theme/tokens";

/**
 * Moldura da tela: área segura no topo e a superfície de fundo.
 *
 * O rodapé não recebe inset aqui — quem encosta embaixo é o tab bar (que já
 * soma o inset) ou uma `StickyFooter`, que recebe o valor por prop.
 */
export function Screen({
  children,
  background = color.bg,
}: {
  children: ReactNode;
  background?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: background, paddingTop: insets.top }}>{children}</View>
  );
}

/** Corpo rolável com o padding padrão do design: `8px 20px 30px`. */
export function ScreenScroll({
  children,
  gap = 26,
  contentStyle,
}: {
  children: ReactNode;
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30, gap },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
