import { supabase } from "../../lib/supabase";
import { useAppState } from "../state/app-state";
import { useAsync } from "@vez/mobile-kit/async";

export type City = {
  id: string;
  name: string;
  stateCode: string;
  slug: string;
};

/**
 * Cidades atendidas. Leitura pública, via RLS como `anon` — a lista precisa
 * existir antes de qualquer cadastro, senão o visitante não tem por onde
 * começar.
 */
export function useCities() {
  const { data, loading, error } = useAsync("cities", async () => {
    const { data: rows, error: queryError } = await supabase
      .from("cities")
      .select("id, name, state_code, slug")
      .order("name");
    if (queryError) throw new Error(queryError.message);
    return (rows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      stateCode: row.state_code,
      slug: row.slug,
    })) satisfies City[];
  });

  return { cities: data ?? [], loading, error };
}

/** Cidades que têm ao menos um estabelecimento ativo. */
export function useCitiesWithShops() {
  const { data } = useAsync("cities-with-shops", async () => {
    const { data: rows, error } = await supabase
      .from("establishments")
      .select("city_id")
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return new Set((rows ?? []).map((row) => row.city_id));
  });
  return data;
}

/**
 * A cidade em uso: a escolhida, ou — enquanto ninguém escolheu — a primeira que
 * tem loja.
 *
 * Cair na primeira cidade em ordem alfabética abriria o app numa tela vazia
 * sempre que essa cidade ainda não tivesse cadastro, e "não tem nada aqui" é a
 * pior primeira impressão possível para um marketplace. O certo mesmo é
 * geolocalização; até lá, ao menos não se abre no vazio.
 *
 * É derivação, não estado: gravar isso como escolha faria o app afirmar que a
 * pessoa escolheu uma cidade que ela nunca tocou.
 */
export function resolveCity(
  cities: City[],
  cityId: string | null,
  withShops?: Set<string> | null,
): City | null {
  const chosen = cities.find((city) => city.id === cityId);
  if (chosen) return chosen;
  if (withShops && withShops.size > 0) {
    const populated = cities.find((city) => withShops.has(city.id));
    if (populated) return populated;
  }
  return cities[0] ?? null;
}

/** A cidade em uso e seu id — o que as três telas de descoberta precisam. */
export function useCurrentCity() {
  const { cities, loading } = useCities();
  const withShops = useCitiesWithShops();
  const state = useAppState();
  const selected = resolveCity(cities, state.cityId, withShops);
  return { cities, loading, selected, cityId: selected?.id ?? null };
}
