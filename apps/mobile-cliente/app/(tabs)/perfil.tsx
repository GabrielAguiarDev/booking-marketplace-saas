import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useSession } from "../../src/auth/session";
import { signOut } from "../../src/push";
import { useProfileStats } from "../../src/data/appointments";
import { initialsOf, memberSince, useProfile } from "../../src/data/use-profile";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { Photo, duo2 } from "../../src/ui/Photo";
import { Card, Label, OutlineButton, PrimaryButton, Shimmer } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";

/**
 * Linhas do menu — todas levam a uma tela de verdade.
 *
 * O grupo PAGAMENTO saiu: o app não cobra nada ainda (a reserva é paga no
 * balcão), e "Formas de pagamento" ou "Reembolsos" com "EM BREVE" eram
 * promessa de cobrança fora do critério de lançamento. Volta quando houver
 * provedor de pagamento de verdade.
 *
 * "Cidade padrão" também não existe: o app do cliente não mostra localidade
 * nenhuma, e oferecer a preferência seria reintroduzir o seletor por outra
 * porta.
 */
const PROFILE_MENU: { name: string; rows: { t: string; to: string }[] }[] = [
  {
    name: "CONTA",
    rows: [
      { t: "Dados pessoais", to: "/conta/dados" },
      { t: "Endereços", to: "/conta/enderecos" },
    ],
  },
  {
    name: "PREFERÊNCIAS",
    rows: [
      { t: "Favoritos", to: "/conta/favoritos" },
      { t: "Avisos", to: "/conta/avisos" },
    ],
  },
  {
    name: "SUPORTE",
    rows: [{ t: "Ajuda", to: "/ajuda" }],
  },
];

export default function Perfil() {
  const router = useRouter();
  const { session, user, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading, error, reload } = useProfile();
  const stats = useProfileStats(session ? (user?.id ?? null) : null);
  const [signingOut, setSigningOut] = useState(false);

  // Voltar de "Dados pessoais" precisa mostrar o nome novo.
  const reloadStats = stats.reload;
  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      reload();
      reloadStats();
    }, [session, reload, reloadStats]),
  );

  if (sessionLoading) return <PerfilCarregando />;
  if (!session) return <PerfilDeslogado onEntrar={() => router.push("/entrar")} />;

  async function sair() {
    setSigningOut(true);
    // Desliga o token deste aparelho antes: sem sessão o banco não sabe de quem é.
    await signOut();
    // Não há navegação aqui: `onAuthStateChange` derruba a sessão e esta mesma
    // tela troca para o estado deslogado. Navegar também produziria duas
    // transições para o mesmo evento.
    setSigningOut(false);
  }

  const email = user?.email ?? "";
  const nome = profile?.fullName?.trim() || "Sua conta";

  return (
    <Screen>
      <ScreenScroll gap={24}>
        <Text style={sans(30, 800, { ls: -0.04 })}>Perfil</Text>

        <Card
          radius={18}
          padding={15}
          style={{ flexDirection: "row", gap: 14, alignItems: "center" }}
        >
          <Photo
            duotone={duo2("#2B2F33", "#61696F")}
            size={62}
            radius={18}
            mono={initialsOf(profile?.fullName ?? null, email || "?")}
            monoSize={18}
            center
          />
          <View style={{ gap: 4, flex: 1 }}>
            {profileLoading ? (
              <Shimmer width={150} height={18} radius={6} />
            ) : (
              <Text style={sans(18, 800, { ls: -0.03 })} numberOfLines={1}>
                {nome}
              </Text>
            )}
            <Text style={mono(11, 400, { ls: 0.04, color: color.muted })} numberOfLines={1}>
              {email}
            </Text>
            {profile ? (
              <Text style={mono(9.5, 500, { ls: 0.08, color: color.muted })}>
                {memberSince(profile.createdAt)}
              </Text>
            ) : null}
          </View>
        </Card>

        {error ? (
          <Card radius={16} padding={15} style={{ gap: 11 }}>
            <Text style={sans(14, 500, { lh: 1.45, color: color.body })}>
              Não conseguimos carregar seus dados. Isso não afeta sua conta.
            </Text>
            <OutlineButton label="Tentar de novo" height={42} onPress={reload} />
          </Card>
        ) : null}

        {/*
          Enquanto carrega, ou se a busca falhar, o traço fica: um número
          errado no próprio perfil é pior que nenhum (R7). Conta nova mostra
          zero de verdade; nota sem avaliação nenhuma continua traço.
        */}
        <View style={{ flexDirection: "row", gap: 9 }}>
          {(
            [
              ["AGENDAMENTOS", stats.data ? String(stats.data.bookings) : null],
              ["LOJAS", stats.data ? String(stats.data.establishments) : null],
              [
                "SUA NOTA",
                stats.data?.averageGiven != null
                  ? stats.data.averageGiven.toFixed(1).replace(".", ",")
                  : null,
              ],
            ] as const
          ).map(([rotulo, valor]) => (
            <View
              key={rotulo}
              style={{
                flex: 1,
                backgroundColor: color.rest,
                borderRadius: 15,
                paddingVertical: 14,
                paddingHorizontal: 12,
                gap: 5,
              }}
            >
              <Text
                style={mono(22, 600, {
                  ls: -0.03,
                  color: valor === null ? color.chevron : color.ink,
                })}
              >
                {valor ?? "—"}
              </Text>
              <Text style={mono(9, 600, { ls: 0.08, color: color.muted })}>{rotulo}</Text>
            </View>
          ))}
        </View>

        {PROFILE_MENU.map((group) => (
          <View key={group.name} style={{ gap: 11 }}>
            <Label>{group.name}</Label>
            <Card radius={16}>
              {group.rows.map((row, index) => (
                <Pressable
                  key={row.t}
                  onPress={() => router.push(row.to as never)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    padding: 15,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottomWidth: index === group.rows.length - 1 ? 0 : 1,
                    borderBottomColor: color.lineSoft,
                    backgroundColor: pressed ? color.rest : "transparent",
                  })}
                >
                  <Text style={sans(14.5, 600, { ls: -0.01 })}>{row.t}</Text>
                  <Text style={sans(20, 400, { lh: 1, color: color.chevron })}>›</Text>
                </Pressable>
              ))}
            </Card>
          </View>
        ))}

        <OutlineButton
          label={signingOut ? "Saindo…" : "Sair da conta"}
          height={50}
          onPress={signingOut ? undefined : sair}
        />

        <Pressable
          onPress={() => router.push("/conta/excluir")}
          accessibilityRole="button"
          hitSlop={8}
          style={{ alignSelf: "center", paddingVertical: 4 }}
        >
          <Text style={sans(13, 600, { color: color.muted })}>Excluir minha conta</Text>
        </Pressable>
      </ScreenScroll>
    </Screen>
  );
}

function PerfilCarregando() {
  return (
    <Screen>
      <ScreenScroll gap={24}>
        <Text style={sans(30, 800, { ls: -0.04 })}>Perfil</Text>
        <Shimmer width="100%" height={92} radius={18} />
      </ScreenScroll>
    </Screen>
  );
}

/**
 * Sem sessão o app não empurra o login na cara: buscar e ver loja funcionam
 * deslogado de propósito, e só reservar exige conta. Esta tela é o convite, não
 * um bloqueio.
 */
function PerfilDeslogado({ onEntrar }: { onEntrar: () => void }) {
  const router = useRouter();

  return (
    <Screen>
      <ScreenScroll gap={22}>
        <Text style={sans(30, 800, { ls: -0.04 })}>Perfil</Text>

        <Card radius={18} padding={20} style={{ gap: 9 }}>
          <Text style={sans(19, 800, { ls: -0.03 })}>Entre para reservar</Text>
          <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
            Você pode buscar e ver lojas sem conta. Para marcar horário, entrar na fila e acompanhar
            sua agenda, precisamos saber quem é você.
          </Text>
        </Card>

        <View style={{ gap: 11 }}>
          <PrimaryButton label="Entrar" height={54} onPress={onEntrar} />
          <OutlineButton label="Criar conta" height={54} onPress={() => router.push("/cadastro")} />
        </View>
      </ScreenScroll>
    </Screen>
  );
}
