import { type ReactNode, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  RefreshControl,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReducedMotion } from "@vez/mobile-kit/motion";
import { color } from "../theme/tokens";

/**
 * Moldura da tela: área segura no topo e a superfície de fundo.
 *
 * O rodapé não recebe inset aqui — quem encosta embaixo é o tab bar ou uma
 * `StickyFooter`, e os dois somam o inset por conta própria.
 *
 * É também onde mora a `vzrise`, a entrada de tela do canvas: o conteúdo sobe
 * alguns pontos enquanto aparece. Roda uma vez, na montagem — trocar de
 * "carregando" para "carregado" não remonta a moldura e por isso não repete. O
 * canvas original não está no repositório; duração e distância são as de uma
 * entrada discreta, não uma medida copiada dele. Com "reduzir movimento"
 * ligado, a tela simplesmente aparece.
 */
export function Screen({
  children,
  background = color.bg,
}: {
  children: ReactNode;
  background?: string;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const rise = Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    rise.start();
    return () => rise.stop();
  }, [progress, reduced]);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: background,
        paddingTop: insets.top,
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Corpo rolável com o padding padrão do design: `8px 20px 30px`. */
export function ScreenScroll({
  children,
  gap = 26,
  contentStyle,
  onRefresh,
  keyboardInsets = false,
}: {
  children: ReactNode;
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Liga o puxar-para-atualizar. A função devolve uma promessa e o indicador
   * fica na tela até ela resolver — `reload()` de `useAsync` já é assim.
   */
  onRefresh?: () => Promise<unknown>;
  /**
   * Abre espaço para o teclado no iOS. Só para telas com campo de texto que
   * não estão dentro de um `KeyboardAvoidingView` — com os dois, a folga dobra.
   */
  keyboardInsets?: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      // Sem isto, o primeiro toque num botão com o teclado aberto só fecha o
      // teclado, e a pessoa precisa tocar de novo.
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={keyboardInsets}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={color.muted}
            colors={[color.coral]}
          />
        ) : undefined
      }
      contentContainerStyle={[
        { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30, gap },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
