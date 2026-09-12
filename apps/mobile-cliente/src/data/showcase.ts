import { supabase } from "../../lib/supabase";
import { useAsync } from "@vez/mobile-kit/async";
import type { CategoryKey } from "./catalog";

/** Para onde o toque no banner leva. */
export type BannerTarget =
  | { kind: "establishment"; establishmentId: string }
  | { kind: "category"; category: CategoryKey }
  | { kind: "url"; url: string };

export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  target: BannerTarget;
};

/**
 * Banners da vitrine, na ordem do carrossel.
 *
 * `showcase_banners()` já devolve só os vigentes (ativos, dentro da janela e com
 * a loja de destino no ar), e é pública: a home mostra a vitrine também para
 * quem não entrou. A imagem mora no bucket público `showcase`; o banco guarda
 * só o caminho.
 */
export function useShowcaseBanners() {
  return useAsync("showcase", async () => {
    const { data, error } = await supabase.rpc("showcase_banners");
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      imageUrl: supabase.storage.from("showcase").getPublicUrl(row.image_path).data.publicUrl,
      target:
        row.target_kind === "establishment"
          ? { kind: "establishment", establishmentId: row.target_value }
          : row.target_kind === "category"
            ? { kind: "category", category: row.target_value as CategoryKey }
            : { kind: "url", url: row.target_value },
    })) satisfies Banner[];
  });
}
