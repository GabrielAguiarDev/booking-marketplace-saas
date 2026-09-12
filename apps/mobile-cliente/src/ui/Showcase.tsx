import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import type { Banner } from "../data/showcase";
import { color } from "../theme/tokens";
import { sans } from "@vez/mobile-kit/theme";

const GAP = 10;
/** Margem lateral do corpo da tela (`ScreenScroll`); o carrossel sangra até a borda. */
const GUTTER = 20;

/**
 * Carrossel da vitrine, no topo da Home.
 *
 * Mesmo formato da prévia na tela Vitrine do admin: card 2:1 (a arte é
 * 1200 × 600), título e subtítulo sobre um degradê na parte de baixo, e o
 * próximo card aparecendo na borda para dizer que dá para deslizar. Com um
 * banner só, ele ocupa a largura toda e os pontos somem.
 */
export function Showcase({
  banners,
  onOpen,
}: {
  banners: Banner[];
  onOpen: (banner: Banner) => void;
}) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const available = width - GUTTER * 2;
  const single = banners.length === 1;
  const cardWidth = single ? available : Math.round(available * 0.88);
  const step = cardWidth + GAP;

  return (
    <View style={{ gap: 10 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!single}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / step);
          setIndex(Math.max(0, Math.min(banners.length - 1, next)));
        }}
        style={{ marginHorizontal: -GUTTER }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: GAP }}
      >
        {banners.map((banner) => (
          <Pressable
            key={banner.id}
            onPress={() => onOpen(banner)}
            accessibilityRole={banner.target.kind === "url" ? "link" : "button"}
            accessibilityLabel={
              banner.subtitle ? `${banner.title}. ${banner.subtitle}` : banner.title
            }
            style={({ pressed }) => ({
              width: cardWidth,
              aspectRatio: 2,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: color.rest,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Image
              source={{ uri: banner.imageUrl }}
              resizeMode="cover"
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <LinearGradient
              colors={["rgba(20,23,26,0)", "rgba(20,23,26,0.72)"]}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                paddingTop: 30,
                paddingHorizontal: 14,
                paddingBottom: 12,
                gap: 3,
              }}
            >
              <Text style={sans(17, 800, { ls: -0.03, color: "#fff" })} numberOfLines={2}>
                {banner.title}
              </Text>
              {banner.subtitle ? (
                <Text
                  style={sans(12.5, 500, { lh: 1.35, color: "rgba(255,255,255,0.88)" })}
                  numberOfLines={2}
                >
                  {banner.subtitle}
                </Text>
              ) : null}
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>

      {single ? null : (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 5 }}>
          {banners.map((banner, i) => (
            <View
              key={banner.id}
              style={{
                width: i === index ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? color.ink : color.dotIdle,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
