import { mono, sans } from "@vez/mobile-kit/theme";
import { Check, LogOut } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { supabase } from "../../lib/supabase";
import { useSession } from "../auth/session";
import { useEstablishment } from "../data/establishment";
import { color } from "../theme/tokens";
import { Sheet } from "./Sheet";

const ROLE_LABEL: Record<string, string> = {
  owner: "dono",
  manager: "gerência",
  staff: "equipe",
};

/**
 * Onde a pessoa troca de loja e sai da conta.
 *
 * Vive numa folha inferior, e não numa tela, porque as duas coisas são escolha
 * curta sobre o que já está aberto (R6). E as duas ficam juntas porque
 * respondem à mesma pergunta — "quem sou eu neste aparelho agora".
 */
export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user } = useSession();
  const { memberships, establishment, select } = useEstablishment();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Sua conta"
      subtitle={user?.email ?? undefined}
    >
      <View style={{ gap: 2 }}>
        {memberships.map((membership) => {
          const current = membership.establishment.id === establishment?.id;
          return (
            <Pressable
              key={membership.establishment.id}
              onPress={() => {
                select(membership.establishment.id);
                onClose();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: color.lineSoft,
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={sans(15, current ? 700 : 600)}>{membership.establishment.name}</Text>
                <Text style={mono(10.5, 500, { ls: 0.06, color: color.muted })}>
                  {(ROLE_LABEL[membership.role] ?? membership.role).toUpperCase()}
                  {membership.establishment.status === "active" ? "" : " · NÃO PUBLICADA"}
                </Text>
              </View>
              {current ? <Check size={18} color={color.coral} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          onClose();
          void supabase.auth.signOut();
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 16,
        }}
      >
        <LogOut size={18} color={color.danger} strokeWidth={1.9} />
        <Text style={sans(14.5, 600, { color: color.danger })}>Sair desta conta</Text>
      </Pressable>
    </Sheet>
  );
}
