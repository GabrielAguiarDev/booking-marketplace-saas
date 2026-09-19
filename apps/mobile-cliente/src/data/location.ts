import * as Location from "expo-location";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Linking } from "react-native";

import { useSession } from "../auth/session";
import { type Coords, toCoords } from "../domain/geo";
import { useAddresses } from "./account";

/**
 * De onde medir "perto de você".
 *
 * Ordem de preferência:
 *   1. a posição do aparelho, se a pessoa deu permissão;
 *   2. o endereço principal salvo (coordenadas geocodificadas no aparelho);
 *   3. nada — a lista fica na ordem do servidor (melhor avaliadas) e a tela
 *      diz isso, em vez de fingir proximidade.
 *
 * O pedido de permissão só acontece quando a pessoa toca em "Usar minha
 * localização": abrir o app com o alerta do sistema na cara, antes de ela
 * saber para quê, é o jeito mais rápido de receber um "não" definitivo.
 *
 * A posição fica num store de módulo, não em estado de tela: Home e Resultados
 * leem a mesma, e voltar de uma para a outra não pede GPS de novo. Ela nunca
 * sai do aparelho — a ordenação é local (ver `domain/geo.ts`).
 */

export type PermissionState = "unknown" | "undetermined" | "granted" | "denied" | "blocked";

type DeviceState = {
  permission: PermissionState;
  locating: boolean;
  coords: Coords | null;
  /** Falhou obter a posição mesmo com permissão (GPS desligado, tempo esgotado). */
  failed: boolean;
};

let state: DeviceState = { permission: "unknown", locating: false, coords: null, failed: false };
const listeners = new Set<() => void>();
let checked = false;

function set(patch: Partial<DeviceState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function permissionOf(response: Location.LocationPermissionResponse): PermissionState {
  if (response.granted) return "granted";
  if (response.status === "undetermined") return "undetermined";
  return response.canAskAgain ? "denied" : "blocked";
}

async function locate() {
  set({ locating: true, failed: false });
  try {
    // A última posição conhecida responde na hora e basta para ordenar lojas;
    // o GPS só é ligado quando não há nenhuma recente.
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
    const position =
      last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    set({
      locating: false,
      coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    });
  } catch {
    set({ locating: false, failed: true });
  }
}

/** Confere a permissão sem perguntar nada. Roda uma vez por sessão do app. */
async function checkSilently() {
  if (checked) return;
  checked = true;
  try {
    const permission = permissionOf(await Location.getForegroundPermissionsAsync());
    set({ permission });
    if (permission === "granted") await locate();
  } catch {
    set({ permission: "undetermined" });
  }
}

/** O toque em "Usar minha localização". Bloqueado de vez, abre os Ajustes. */
export async function requestLocation() {
  if (state.permission === "blocked") {
    await Linking.openSettings();
    return;
  }
  try {
    const permission = permissionOf(await Location.requestForegroundPermissionsAsync());
    set({ permission });
    if (permission === "granted") await locate();
  } catch {
    set({ permission: "denied" });
  }
}

export type Origin = {
  coords: Coords;
  source: "device" | "address";
  /** Nome do endereço usado como referência ("Casa"), quando for o caso. */
  label: string | null;
};

export function useProximity() {
  const device = useSyncExternalStore(subscribe, () => state);
  const { user } = useSession();
  const addresses = useAddresses(Boolean(user));

  useEffect(() => {
    void checkSilently();
  }, []);

  const fallback = (addresses.data ?? []).find((a) => a.is_default) ?? addresses.data?.[0] ?? null;
  const lat = fallback?.latitude ?? null;
  const lon = fallback?.longitude ?? null;
  const label = fallback?.label ?? null;

  // Memorizado para a origem manter identidade entre renders: as telas
  // ordenam a lista num `useMemo` que depende dela.
  const origin = useMemo<Origin | null>(() => {
    if (device.coords) return { coords: device.coords, source: "device", label: null };
    const coords = toCoords(lat, lon);
    return coords ? { coords, source: "address", label } : null;
  }, [device.coords, lat, lon, label]);

  return {
    origin,
    permission: device.permission,
    locating: device.locating,
    failed: device.failed,
    request: requestLocation,
    retry: locate,
  };
}

/**
 * Coordenadas de um endereço digitado, pelo geocoder do sistema (Apple/Google).
 * Não precisa de permissão de localização. Falha vira `null`: o endereço é
 * salvo mesmo assim, só não serve de referência de distância.
 */
export async function geocode(query: string): Promise<Coords | null> {
  try {
    const [first] = await Location.geocodeAsync(query);
    return first ? toCoords(first.latitude, first.longitude) : null;
  } catch {
    return null;
  }
}
