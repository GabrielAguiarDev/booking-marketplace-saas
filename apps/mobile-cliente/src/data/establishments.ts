import { supabase } from "../../lib/supabase";
import { useAsync } from "./use-async";
import type { CategoryKey } from "./catalog";

const LIST_COLUMNS =
  "id, name, slug, category, accent_color, booking_mode, neighborhood, latitude, longitude, rating_avg, rating_count, deposit_percent";

export type EstablishmentRow = {
  id: string;
  name: string;
  slug: string;
  category: CategoryKey;
  accent_color: string | null;
  booking_mode: "scheduled" | "queue" | "both";
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  rating_avg: number | null;
  rating_count: number;
  deposit_percent: number;
};

export type EstablishmentDetail = EstablishmentRow & {
  description: string | null;
  address_line: string | null;
  cancellation_window_minutes: number;
  timezone: string;
  services: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number;
  }[];
  professionals: { id: string; display_name: string; title: string | null }[];
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Não encontrado.");
  return result.data;
}

/** Lojas de uma cidade, para a Home e para a busca. */
export function useEstablishments(
  cityId: string | null,
  filters: { category?: CategoryKey | null; term?: string } = {},
) {
  const { category = null, term = "" } = filters;
  const key = `est:${cityId}:${category}:${term}`;

  return useAsync(
    key,
    async () => {
      let query = supabase
        .from("establishments")
        .select(LIST_COLUMNS)
        .eq("status", "active")
        .eq("city_id", cityId!)
        .order("rating_avg", { ascending: false, nullsFirst: false })
        .limit(50);

      if (category) query = query.eq("category", category);
      // `ilike` cobre acento e maiúscula mal digitados o bastante para busca de
      // nome de loja; o índice trigram existe para quando isso não bastar.
      if (term.trim()) query = query.ilike("name", `%${term.trim()}%`);

      return unwrap(await query) as EstablishmentRow[];
    },
    { enabled: Boolean(cityId) },
  );
}

/** Contagem por categoria — os números da tela Explorar. */
export function useCategoryCounts(cityId: string | null) {
  return useAsync(
    `counts:${cityId}`,
    async () => {
      const rows = unwrap(
        await supabase
          .from("establishments")
          .select("category")
          .eq("status", "active")
          .eq("city_id", cityId!),
      ) as { category: CategoryKey }[];

      const counts: Partial<Record<CategoryKey, number>> = {};
      for (const row of rows) counts[row.category] = (counts[row.category] ?? 0) + 1;
      return counts;
    },
    { enabled: Boolean(cityId) },
  );
}

/** A loja inteira: dados, serviços e equipe numa consulta só. */
export function useEstablishment(id: string | null) {
  return useAsync(
    `est-detail:${id}`,
    async () => {
      const data = unwrap(
        await supabase
          .from("establishments")
          .select(
            `${LIST_COLUMNS}, description, address_line, cancellation_window_minutes, timezone,
             services(id, name, description, duration_minutes, price_cents, sort_order),
             professionals(id, display_name, title, sort_order)`,
          )
          .eq("id", id!)
          .eq("status", "active")
          .maybeSingle(),
      ) as EstablishmentDetail & {
        services: (EstablishmentDetail["services"][number] & { sort_order: number })[];
        professionals: (EstablishmentDetail["professionals"][number] & { sort_order: number })[];
      };

      // A ordenação de tabela aninhada não é garantida pelo PostgREST; ordenar
      // aqui evita que a lista de serviços troque de ordem entre visitas.
      return {
        ...data,
        services: [...data.services].sort((a, b) => a.sort_order - b.sort_order),
        professionals: [...data.professionals].sort((a, b) => a.sort_order - b.sort_order),
      } satisfies EstablishmentDetail;
    },
    { enabled: Boolean(id) },
  );
}

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  tags: string[];
  created_at: string;
  profiles: { full_name: string | null } | null;
};

export function useReviews(establishmentId: string | null) {
  return useAsync(
    `reviews:${establishmentId}`,
    async () =>
      unwrap(
        await supabase
          .from("reviews")
          .select("id, rating, comment, tags, created_at, profiles(full_name)")
          .eq("establishment_id", establishmentId!)
          .order("created_at", { ascending: false })
          .limit(20),
      ) as ReviewRow[],
    { enabled: Boolean(establishmentId) },
  );
}
