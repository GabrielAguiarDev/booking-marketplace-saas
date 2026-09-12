import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { accentOf, CATEGORY, type CategoryKey, initialsOfName, shade } from "../src/data/catalog";
import { type EstablishmentRow, useEstablishments } from "../src/data/establishments";
import { useCityId } from "../src/data/use-cities";
import { color } from "../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { duo2, Photo } from "../src/ui/Photo";
import { BackHeader, Card, PrimaryButton, Shimmer } from "../src/ui/primitives";
import { Screen, ScreenScroll } from "../src/ui/Screen";

export default function Resultados() {
  const router = useRouter();
  const cityId = useCityId();
  const params = useLocalSearchParams<{ term?: string; category?: string }>();

  const category = (params.category || null) as CategoryKey | null;
  const term = params.term ?? "";

  const { data, loading, error, reload } = useEstablishments(cityId, { category, term });

  const titulo = category ? CATEGORY[category].label : term ? `"${term}"` : "Resultados";

  return (
    <Screen>
      <ScreenScroll gap={18}>
        <BackHeader title={titulo} onBack={() => router.back()} />

        {loading ? (
          <View style={{ gap: 11 }}>
            <Shimmer width="100%" height={96} radius={18} />
            <Shimmer width="100%" height={96} radius={18} />
            <Shimmer width="100%" height={96} radius={18} />
          </View>
        ) : error ? (
          <Card radius={16} padding={18} style={{ gap: 12 }}>
            <Text style={sans(14.5, 400, { lh: 1.5, color: color.body })}>
              Não conseguimos carregar a busca.
            </Text>
            <PrimaryButton label="Tentar de novo" height={44} onPress={reload} />
          </Card>
        ) : !data || data.length === 0 ? (
          <Card radius={16} padding={20} style={{ gap: 10 }}>
            <Text style={sans(18, 800, { ls: -0.03 })}>Nada encontrado</Text>
            <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
              {category
                ? "Nenhuma loja desta categoria perto de você ainda."
                : "Nenhuma loja com esse nome por aqui. Tente outro termo."}
            </Text>
          </Card>
        ) : (
          <>
            <Text style={mono(10, 600, { ls: 0.1, color: color.muted })}>
              {data.length} {data.length === 1 ? "LOJA" : "LOJAS"}
            </Text>
            {data.map((shop) => (
              <LojaCard key={shop.id} shop={shop} onPress={() => router.push(`/loja/${shop.id}`)} />
            ))}
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}

export function LojaCard({ shop, onPress }: { shop: EstablishmentRow; onPress: () => void }) {
  const accent = accentOf(shop);
  const category = CATEGORY[shop.category];

  return (
    <Pressable onPress={onPress}>
      <Card
        radius={18}
        padding={13}
        style={{ flexDirection: "row", gap: 13, alignItems: "center" }}
      >
        <Photo
          duotone={duo2(shade(accent, -0.4), shade(accent, 0.35))}
          size={62}
          radius={16}
          mono={initialsOfName(shop.name)}
          monoSize={16}
          center
        />
        <View style={{ gap: 5, flex: 1 }}>
          <Text style={sans(15.5, 700, { ls: -0.02 })} numberOfLines={1}>
            {shop.name}
          </Text>
          <Text style={mono(9.5, 400, { ls: 0.05, color: color.muted })} numberOfLines={1}>
            {category.label.toUpperCase()}
            {shop.neighborhood ? ` · ${shop.neighborhood.toUpperCase()}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
            {shop.rating_count > 0 ? (
              <Text style={mono(10.5, 600)}>★ {shop.rating_avg?.toFixed(1).replace(".", ",")}</Text>
            ) : (
              <Text style={mono(9.5, 400, { color: color.muted })}>NOVO</Text>
            )}
            {shop.booking_mode !== "scheduled" ? (
              <Text style={mono(9, 600, { ls: 0.08, color: color.green })}>ACEITA FILA</Text>
            ) : null}
          </View>
        </View>
        <Text style={sans(17, 400, { lh: 1, color: color.chevron })}>›</Text>
      </Card>
    </Pressable>
  );
}
