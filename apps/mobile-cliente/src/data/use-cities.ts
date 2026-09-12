import { supabase } from "../../lib/supabase";
import { useAsync } from "@vez/mobile-kit/async";

type City = {
  id: string;
  name: string;
};

/**
 * A cidade que alimenta a busca, as contagens e o assistente — escolhida sem
 * interface.
 *
 * O MVP não mostra localidade ao cliente: nenhum nome de cidade, seletor ou
 * contagem por cidade aparece na tela, e os textos falam em "perto de você".
 * O banco continua organizado por cidade, então o app resolve uma sozinho: a
 * primeira, em ordem alfabética, que tem loja ativa. Hoje só uma tem.
 *
 * Cair simplesmente na primeira cidade abriria o app numa tela vazia sempre
 * que ela ainda não tivesse cadastro, e "não tem nada aqui" é a pior primeira
 * impressão para um marketplace.
 *
 * Quando houver loja em mais de uma cidade, o certo é a geolocalização do
 * aparelho escolher a mais próxima (e o nome continuar fora da tela); até lá,
 * esta regra ao menos não abre no vazio.
 */
function resolveCity(cities: City[], withShops: Set<string>): City | null {
  return cities.find((city) => withShops.has(city.id)) ?? cities[0] ?? null;
}

/** O id da cidade em uso — o que as três telas de descoberta precisam. */
export function useCityId(): string | null {
  const { data } = useAsync("current-city", async () => {
    // As duas leituras são públicas (RLS como `anon`): buscar funciona deslogado.
    const [cities, shops] = await Promise.all([
      supabase.from("cities").select("id, name").eq("is_active", true).order("name"),
      supabase.from("establishments").select("city_id").eq("status", "active"),
    ]);
    if (cities.error) throw new Error(cities.error.message);
    if (shops.error) throw new Error(shops.error.message);

    const withShops = new Set((shops.data ?? []).map((row) => row.city_id));
    return resolveCity(cities.data ?? [], withShops);
  });

  return data?.id ?? null;
}
