import { useRouter } from "expo-router";
import { Heart } from "lucide-react-native";
import { useState } from "react";
import { Pressable } from "react-native";

import { useSession } from "../auth/session";
import { setFavorite } from "../data/account";
import { color } from "../theme/tokens";

/**
 * Coração de favoritar. Otimista: pinta na hora e desfaz se o banco recusar —
 * esperar a rede para um toque tão pequeno faria o botão parecer quebrado.
 *
 * Deslogado leva ao login com volta para a loja, como entrar na fila.
 */
export function FavoriteButton({
  establishmentId,
  favorite,
  onChanged,
  size = 38,
}: {
  establishmentId: string;
  favorite: boolean;
  onChanged: () => void;
  size?: number;
}) {
  const router = useRouter();
  const { user } = useSession();
  // Nulo = segue o servidor; valor = toque pendente de confirmação.
  const [pending, setPending] = useState<boolean | null>(null);
  const on = pending ?? favorite;

  async function toggle() {
    if (!user) {
      router.push({ pathname: "/entrar", params: { redirect: `/loja/${establishmentId}` } });
      return;
    }
    const next = !on;
    setPending(next);
    await setFavorite({ customerId: user.id, establishmentId, favorite: next });
    // Com ou sem sucesso, a verdade passa a ser o que o servidor devolver.
    onChanged();
    setPending(null);
  }

  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={on ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      accessibilityState={{ selected: on }}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: color.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Heart
        size={18}
        color={on ? color.coral : color.ink}
        fill={on ? color.coral : "transparent"}
        strokeWidth={2}
      />
    </Pressable>
  );
}
