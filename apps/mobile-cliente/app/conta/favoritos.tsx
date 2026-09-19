import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Text } from "react-native";

import { AuthGate } from "../../src/auth/AuthGate";
import { useFavoriteShops } from "../../src/data/account";
import { useCovers } from "../../src/data/photos";
import { color } from "../../src/theme/tokens";
import { sans } from "@vez/mobile-kit/theme";
import { BackHeader, Card, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { ErrorState } from "../../src/ui/States";
import { LojaCard } from "../resultados";

/**
 * Lojas favoritas, da mais recente para a mais antiga. Loja que saiu do ar
 * some da lista sozinha (ver `useFavoriteShops`).
 */
function FavoritosConteudo() {
  const router = useRouter();
  const { data, loading, error, reload } = useFavoriteShops(true);
  const covers = useCovers((data ?? []).map((shop) => shop.id));

  // Desfavoritar dentro da loja e voltar precisa refletir aqui.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <Screen>
      <ScreenScroll gap={14}>
        <BackHeader title="Favoritos" onBack={() => router.back()} />

        {loading ? (
          <>
            <Shimmer width="100%" height={90} radius={18} />
            <Shimmer width="100%" height={90} radius={18} />
          </>
        ) : error ? (
          <ErrorState error={error} onRetry={reload} what="seus favoritos" />
        ) : !data || data.length === 0 ? (
          <Card radius={18} padding={20} style={{ gap: 8 }}>
            <Text style={sans(17, 800, { ls: -0.03 })}>Nenhuma loja favorita</Text>
            <Text style={sans(14, 400, { lh: 1.5, color: color.muted })}>
              Toque no coração na página de uma loja para encontrá-la aqui depois.
            </Text>
          </Card>
        ) : (
          data.map((shop) => (
            <LojaCard
              key={shop.id}
              shop={shop}
              coverUrl={covers.get(shop.id) ?? null}
              onPress={() => router.push(`/loja/${shop.id}`)}
            />
          ))
        )}
      </ScreenScroll>
    </Screen>
  );
}

export default function Favoritos() {
  return (
    <AuthGate>
      <FavoritosConteudo />
    </AuthGate>
  );
}
