import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { CATEGORY, CATEGORY_KEYS, type CategoryKey } from "../../src/data/catalog";
import { useCategoryCounts } from "../../src/data/establishments";
import { useCityId } from "../../src/data/use-cities";
import { color, radius } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { Card, Label, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";

/** Agrupamentos de categoria — decisão de navegação, não de banco. */
const FAMILIES: { name: string; items: CategoryKey[] }[] = [
  { name: "Beleza", items: ["barbershop", "salon", "nail_salon", "aesthetic_clinic"] },
  { name: "Saúde", items: ["dermatology", "dentistry", "massage"] },
  { name: "Pet", items: ["petshop"] },
];

export default function Explorar() {
  const router = useRouter();
  const cityId = useCityId();
  const [term, setTerm] = useState("");

  const { data: counts, loading } = useCategoryCounts(cityId);

  function buscar(params: { term?: string; category?: CategoryKey }) {
    router.push({
      pathname: "/resultados",
      params: {
        term: params.term ?? "",
        category: params.category ?? "",
      },
    });
  }

  return (
    <Screen>
      <ScreenScroll gap={24}>
        <Text style={sans(30, 800, { ls: -0.04 })}>Explorar</Text>

        <View
          style={{
            backgroundColor: color.rest,
            borderRadius: radius.lg,
            height: 54,
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
            paddingHorizontal: 16,
          }}
        >
          <Search size={17} color={color.muted} strokeWidth={2} />
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="Buscar por nome da loja"
            placeholderTextColor={color.muted}
            returnKeyType="search"
            onSubmitEditing={() => term.trim() && buscar({ term })}
            autoCapitalize="none"
            style={[sans(14.5, 400), { flex: 1, paddingVertical: 0 }]}
          />
        </View>

        {FAMILIES.map((family) => {
          const total = family.items.reduce((sum, key) => sum + (counts?.[key] ?? 0), 0);

          return (
            <View key={family.name} style={{ gap: 13 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 9 }}>
                <Text style={sans(21, 800, { ls: -0.03 })}>{family.name}</Text>
                <Text style={mono(10.5, 400, { ls: 0.05, color: color.muted })}>
                  {loading ? "…" : `${total} ${total === 1 ? "LOJA" : "LOJAS"}`}
                </Text>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 11 }}>
                {family.items.map((key) => {
                  const category = CATEGORY[key];
                  const count = counts?.[key] ?? 0;
                  const Icon = category.Icon;

                  return (
                    <Pressable
                      key={key}
                      onPress={() => buscar({ category: key })}
                      style={{ flexBasis: "47%", flexGrow: 1 }}
                    >
                      <Card
                        radius={15}
                        padding={13}
                        style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 13,
                            backgroundColor: category.pastel,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon size={20} color={category.accent} strokeWidth={1.8} />
                        </View>
                        <View style={{ gap: 3, flex: 1 }}>
                          <Text style={sans(14.5, 700, { ls: -0.02 })}>{category.label}</Text>
                          {loading ? (
                            <Shimmer width={44} height={9} radius={3} />
                          ) : (
                            <Text style={mono(9.5, 400, { ls: 0.05, color: color.muted })}>
                              {count === 0
                                ? "EM BREVE"
                                : `${count} ${count === 1 ? "LOJA" : "LOJAS"}`}
                            </Text>
                          )}
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        {!loading && CATEGORY_KEYS.every((key) => (counts?.[key] ?? 0) === 0) ? (
          <Card radius={16} padding={18}>
            <Label>POR PERTO</Label>
            <Text style={[sans(14.5, 400, { lh: 1.5, color: color.muted }), { marginTop: 8 }]}>
              Ainda não há lojas cadastradas perto de você. Assim que a primeira publicar, ela
              aparece aqui.
            </Text>
          </Card>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}
