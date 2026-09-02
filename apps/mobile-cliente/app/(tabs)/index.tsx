import { useRouter } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useSession } from "../../src/auth/session";
import { CATEGORY, CATEGORY_KEYS } from "../../src/data/catalog";
import { useCategoryCounts, useEstablishments } from "../../src/data/establishments";
import { useMyQueueEntry } from "../../src/data/queue";
import { useCurrentCity } from "../../src/data/use-cities";
import { hourMinute } from "../../src/format";
import { useAppState } from "../../src/state/app-state";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "../../src/theme/type";
import { Card, PrimaryButton, PulseDot, SectionHeader, Shimmer } from "../../src/ui/primitives";
import { CityPicker } from "../../src/ui/CityPicker";
import { Screen, ScreenScroll } from "../../src/ui/Screen";
import { LojaCard } from "../resultados";

export default function Home() {
  const router = useRouter();
  const state = useAppState();
  const { session } = useSession();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { cities, selected, cityId } = useCurrentCity();

  const { data: shops, loading } = useEstablishments(cityId);
  const { data: counts } = useCategoryCounts(cityId);
  const { data: queueEntry } = useMyQueueEntry(Boolean(session));

  const total = shops?.length ?? 0;

  return (
    <Screen>
      <ScreenScroll gap={26}>
        <View style={{ gap: 4 }}>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Text style={sans(30, 800, { ls: -0.04 })}>{selected?.name ?? "Escolher cidade"}</Text>
            <ChevronDown size={22} color={color.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={mono(10.5, 400, { ls: 0.06, color: color.muted })}>
            {total} {total === 1 ? "ESTABELECIMENTO" : "ESTABELECIMENTOS"}
          </Text>
        </View>

        {queueEntry ? (
          <Card radius={18} padding={16} style={{ gap: 13 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <PulseDot dotColor={color.green} />
              <Text style={mono(9.5, 600, { ls: 0.1, color: color.green })}>AO VIVO · NA FILA</Text>
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
          {loading ? (
            <View style={{ gap: 11 }}>
              <Shimmer width="100%" height={90} radius={18} />
              <Shimmer width="100%" height={90} radius={18} />
            </View>
          ) : total === 0 ? (
            <Card radius={18} padding={20} style={{ gap: 10 }}>
              <Text style={sans(18, 800, { ls: -0.03 })}>Nenhuma loja por aqui ainda</Text>
              <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
                {cities.length > 1
                  ? "Toque no nome da cidade acima para ver outra."
                  : "Assim que a primeira loja publicar, ela aparece aqui."}
              </Text>
            </Card>
          ) : (
            shops!.map((shop) => (
              <LojaCard key={shop.id} shop={shop} onPress={() => router.push(`/loja/${shop.id}`)} />
            ))
          )}
        </View>

        <CityPicker
          visible={pickerOpen}
          cities={cities}
          selectedId={cityId}
          onSelect={(id) => {
            state.setCityId(id);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      </ScreenScroll>
    </Screen>
  );
}
