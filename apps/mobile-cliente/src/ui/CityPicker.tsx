import { Check, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { City } from "../data/use-cities";
import { color } from "../theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";

/**
 * Escolha de cidade como folha inferior.
 *
 * Antes a lista era renderizada em fluxo, logo abaixo do cabeçalho, e empurrava
 * a Home inteira para baixo a cada abertura — o conteúdo saltava sob o dedo.
 * Em modal, a Home fica parada e a escolha ganha foco.
 */
export function CityPicker({
  visible,
  cities,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  cities: City[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Toque no fundo fecha; o card intercepta o toque para não fechar sozinho. */}
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(20,23,26,0.35)", justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: color.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
            paddingBottom: 12 + insets.bottom,
            maxHeight: "70%",
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: color.line,
              marginBottom: 14,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingBottom: 14,
            }}
          >
            <Text style={sans(19, 800, { ls: -0.03 })}>Escolher cidade</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: color.rest,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color={color.muted} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            {cities.map((city, index) => {
              const on = city.id === selectedId;
              return (
                <Pressable
                  key={city.id}
                  onPress={() => onSelect(city.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 15,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: color.lineSoft,
                  }}
                >
                  <View style={{ gap: 3 }}>
                    <Text style={sans(15.5, on ? 700 : 600, { ls: -0.02 })}>{city.name}</Text>
                    <Text style={mono(10.5, 400, { ls: 0.05, color: color.muted })}>
                      {city.stateCode}
                    </Text>
                  </View>
                  {on ? <Check size={19} color={color.coral} strokeWidth={2.4} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
