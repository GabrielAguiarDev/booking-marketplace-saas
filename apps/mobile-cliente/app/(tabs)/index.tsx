import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { useSession } from "../../src/auth/session";
import { CATEGORY, CATEGORY_KEYS } from "../../src/data/catalog";
import { useCategoryCounts, useEstablishments } from "../../src/data/establishments";
import { useProximity } from "../../src/data/location";
import { useCovers } from "../../src/data/photos";
import { useMyQueueEntry } from "../../src/data/queue";
import { type Banner, useShowcaseBanners } from "../../src/data/showcase";
import { useCity } from "../../src/data/use-cities";
import { useProfile } from "../../src/data/use-profile";
import { sortByDistance } from "../../src/domain/geo";
import { hourMinute } from "@vez/mobile-kit/format";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { Card, PrimaryButton, PulseDot, SectionHeader, Shimmer } from "../../src/ui/primitives";
import { ProximityBar } from "../../src/ui/Proximity";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { ErrorState } from "../../src/ui/States";
import { Showcase } from "../../src/ui/Showcase";
import { LojaCard } from "../resultados";

export default function Home() {
  const router = useRouter();
  const { session } = useSession();
  const { profile } = useProfile();

  // A cidade é resolvida sem interface (MVP sem localidade): a Home não diz
  // onde está, só mostra o que há por perto.
  const city = useCity();
  const cityId = city.id;

  const shopsQuery = useEstablishments(cityId);
  const rows = shopsQuery.data;
  const loading = shopsQuery.loading || city.loading;
  const error = shopsQuery.error ?? city.error;
  const reload = city.error ? city.reload : shopsQuery.reload;
  const proximity = useProximity();
  const origin = proximity.origin?.coords ?? null;
  const shops = useMemo(() => (rows ? sortByDistance(rows, origin) : null), [rows, origin]);
  const covers = useCovers((rows ?? []).map((shop) => shop.id));
  const { data: counts } = useCategoryCounts(cityId);
  const { data: queueEntry, reload: reloadQueue } = useMyQueueEntry(Boolean(session));
  // Sem banner no ar, a vitrine não ocupa espaço nem com esqueleto: a Home
  // começa nas categorias, como antes.
  const { data: banners } = useShowcaseBanners();

  const total = shops?.length ?? 0;
  const firstName = profile?.fullName?.trim().split(/\s+/)[0] ?? null;

  function abrirBanner(banner: Banner) {
    const { target } = banner;
    if (target.kind === "establishment") router.push(`/loja/${target.establishmentId}`);
    else if (target.kind === "category") {
      router.push({ pathname: "/resultados", params: { category: target.category } });
    } else void Linking.openURL(target.url);
  }

  return (
    <Screen>
      <ScreenScroll gap={26} onRefresh={() => Promise.all([reload(), reloadQueue()])}>
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={sans(30, 800, { ls: -0.04 })}>
            {firstName ? `Olá, ${firstName}` : "Olá"}
          </Text>
          <Text style={mono(10.5, 400, { ls: 0.06, color: color.muted })}>
            HORÁRIO E FILA PERTO DE VOCÊ
          </Text>
        </View>

        {queueEntry ? (
          <Card radius={18} padding={16} style={{ gap: 13 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <PulseDot dotColor={color.green} />
              <Text style={mono(9.5, 600, { ls: 0.1, color: color.greenDeep })}>
                AO VIVO · NA FILA
              </Text>
            </View>
            <Text style={sans(18, 800, { ls: -0.03 })}>{queueEntry.establishments.name}</Text>
            <Text style={mono(10.5, 400, { ls: 0.05, color: color.muted })}>
              ENTROU ÀS {hourMinute(queueEntry.joined_at)}
            </Text>
            <PrimaryButton
              label="Ver fila"
              height={46}
              onPress={() =>
                router.push({ pathname: "/fila", params: { id: queueEntry.establishment_id } })
              }
            />
          </Card>
        ) : null}

        {banners && banners.length > 0 ? <Showcase banners={banners} onOpen={abrirBanner} /> : null}

        <View style={{ gap: 13 }}>
          <SectionHeader
            title="Categorias"
            meta="VER TODAS"
            metaColor={color.coral}
            onMetaPress={() => router.push("/explorar")}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 11 }}>
              {CATEGORY_KEYS.map((key) => {
                const category = CATEGORY[key];
                const Icon = category.Icon;
                const count = counts?.[key] ?? 0;

                return (
                  <Pressable
                    key={key}
                    onPress={() =>
                      router.push({ pathname: "/resultados", params: { category: key } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${category.label}${count === 0 ? ", nenhuma loja ainda" : ""}`}
                    style={{ width: 84, alignItems: "center", gap: 8 }}
                  >
                    <View
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: 20,
                        backgroundColor: category.pastel,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: count === 0 ? 0.5 : 1,
                      }}
                    >
                      <Icon size={26} color={category.accent} strokeWidth={1.8} />
                    </View>
                    <Text style={sans(12.5, 600, { ls: -0.01 })} numberOfLines={1}>
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={{ gap: 13 }}>
          <SectionHeader title="Perto de você" />
          {total > 0 ? (
            <ProximityBar
              origin={proximity.origin}
              permission={proximity.permission}
              locating={proximity.locating}
              failed={proximity.failed}
              onRequest={proximity.request}
              onRetry={proximity.retry}
            />
          ) : null}
          {loading ? (
            <View style={{ gap: 11 }}>
              <Shimmer width="100%" height={90} radius={18} />
              <Shimmer width="100%" height={90} radius={18} />
            </View>
          ) : error ? (
            <ErrorState error={error} onRetry={reload} what="as lojas" />
          ) : total === 0 ? (
            <Card radius={18} padding={20} style={{ gap: 10 }}>
              <Text style={sans(18, 800, { ls: -0.03 })}>Nenhuma loja por aqui ainda</Text>
              <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
                Assim que a primeira loja publicar, ela aparece aqui.
              </Text>
            </Card>
          ) : (
            shops!.map((shop) => (
              <LojaCard
                key={shop.id}
                shop={shop}
                coverUrl={covers.get(shop.id) ?? null}
                distanceKm={shop.distanceKm}
                onPress={() => router.push(`/loja/${shop.id}`)}
              />
            ))
          )}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
