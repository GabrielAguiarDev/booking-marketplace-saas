import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { accentOf, CATEGORY, initialsOfName, shade } from "../../src/data/catalog";
import { useAvailabilitySummary } from "../../src/data/availability";
import { useFavoriteIds } from "../../src/data/account";
import { useEstablishment, useReviews } from "../../src/data/establishments";
import { joinQueue, useMyQueueEntry } from "../../src/data/queue";
import { useSession } from "../../src/auth/session";
import { usableImageUrl } from "../../src/domain/photos";
import { duration, moneyShort, relativeDays } from "@vez/mobile-kit/format";
import { useAppState } from "../../src/state/app-state";
import { color } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { duo2, Photo } from "../../src/ui/Photo";
import {
  BackButton,
  Card,
  Label,
  PrimaryButton,
  Segmented,
  Shimmer,
  StickyFooter,
} from "../../src/ui/primitives";
import { FavoriteButton } from "../../src/ui/FavoriteButton";
import { Ring } from "../../src/ui/Ring";
import { Screen } from "../../src/ui/Screen";
import { ErrorState } from "../../src/ui/States";

const SHOP_TABS = [
  { key: "servicos", label: "SERVIÇOS" },
  { key: "equipe", label: "EQUIPE" },
  { key: "avaliacoes", label: "AVALIAÇÕES" },
];

export default function Loja() {
  const router = useRouter();
  const state = useAppState();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState("servicos");
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const { user } = useSession();
  const { data: myQueue, reload: reloadQueue } = useMyQueueEntry(Boolean(user));
  const favorites = useFavoriteIds(Boolean(user));
  const { width } = useWindowDimensions();
  const [photoIndex, setPhotoIndex] = useState(0);

  const { data: shop, loading, error, reload } = useEstablishment(id ?? null);
  const { data: reviews } = useReviews(id ?? null);

  // O anel do topo mostra a agenda de hoje do primeiro serviço — é o que o
  // canvas chamava de "vez": quanto da grade de hoje ainda está livre.
  const firstService = shop?.services[0] ?? null;
  const { data: summary } = useAvailabilitySummary({
    establishmentId: shop?.id ?? null,
    serviceId: firstService?.id ?? null,
    days: 1,
  });
  const freeToday = summary?.[0]?.free_count ?? null;

  if (loading) return <LojaCarregando onBack={() => router.back()} />;

  if (error || !shop) {
    return (
      <Screen>
        <View style={{ padding: 20, paddingTop: 16, gap: 16 }}>
          <BackButton onPress={() => router.back()} />
          {error ? (
            <ErrorState error={error} onRetry={reload} what="esta loja" />
          ) : (
            <>
              <Text style={sans(21, 800, { ls: -0.03 })}>Loja indisponível</Text>
              <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
                Esta loja saiu do ar ou não existe mais.
              </Text>
            </>
          )}
        </View>
      </Screen>
    );
  }

  const accent = accentOf(shop);
  const category = CATEGORY[shop.category];
  const naFilaDaqui = myQueue?.establishment_id === shop.id;
  const cheapest = shop.services.reduce<number | null>(
    (min, s) => (min === null || s.price_cents < min ? s.price_cents : min),
    null,
  );

  async function entrarNaFila() {
    if (!user) {
      // Entrar na fila é compromisso com a loja: exige conta, como reservar.
      router.push({ pathname: "/entrar", params: { redirect: `/loja/${shop!.id}` } });
      return;
    }
    setQueueBusy(true);
    setQueueError(null);
    const result = await joinQueue({ establishmentId: shop!.id, customerId: user.id });
    setQueueBusy(false);
    if (!result.ok) {
      setQueueError(result.message ?? "Não foi possível entrar na fila.");
      return;
    }
    reloadQueue();
    router.push({ pathname: "/fila", params: { id: shop!.id } });
  }

  function comecar(serviceId: string) {
    state.startBooking(shop!.id, serviceId);
    router.push("/horario");
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View>
          {shop.photos.length > 1 ? (
            // Galeria só quando há mais de uma foto; com uma, a capa basta.
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) =>
                setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / width))
              }
            >
              {shop.photos.map((photo, index) => (
                <Photo
                  key={photo.url}
                  duotone={duo2(shade(accent, -0.45), shade(accent, 0.35))}
                  width={width}
                  height={246}
                  radius={0}
                  mono={index === 0 ? initialsOfName(shop.name) : undefined}
                  monoSize={34}
                  style={{ padding: 18 }}
                  uri={photo.url}
                  alt={photo.alt ?? `Foto ${index + 1} de ${shop.name}`}
                />
              ))}
            </ScrollView>
          ) : (
            <Photo
              duotone={duo2(shade(accent, -0.45), shade(accent, 0.35))}
              width="100%"
              height={246}
              radius={0}
              mono={initialsOfName(shop.name)}
              monoSize={34}
              style={{ padding: 18 }}
              uri={shop.photos[0]?.url ?? null}
              alt={shop.photos[0]?.alt ?? `Foto de ${shop.name}`}
            />
          )}
          {shop.photos.length > 1 ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: 12,
                alignSelf: "center",
                flexDirection: "row",
                gap: 6,
              }}
            >
              {shop.photos.map((photo, index) => (
                <View
                  key={photo.url}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: index === photoIndex ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                />
              ))}
            </View>
          ) : null}
          <View style={{ position: "absolute", top: 12, left: 16 }}>
            <BackButton boxed onPress={() => router.back()} />
          </View>

          <View style={{ position: "absolute", top: 12, right: 16 }}>
            <FavoriteButton
              establishmentId={shop.id}
              favorite={favorites.data?.has(shop.id) ?? false}
              onChanged={favorites.reload}
            />
          </View>

          {freeToday !== null && freeToday > 0 ? (
            <View
              style={{
                position: "absolute",
                top: 12,
                right: 64,
                flexDirection: "row",
                gap: 7,
                alignItems: "center",
                backgroundColor: color.bg,
                borderRadius: 11,
                paddingVertical: 8,
                paddingHorizontal: 11,
              }}
            >
              {/* Anel cheio: o selo só existe quando há horário hoje. Um
                  arco parcial aqui seria uma proporção que ninguém mediu. */}
              <Ring size={14} innerSize={7} pct={100} color={color.coral} />
              <Text style={mono(9.5, 600, { ls: 0.1 })}>NA VEZ</Text>
            </View>
          ) : null}
        </View>

        <View style={{ padding: 20, paddingBottom: 30, gap: 24 }}>
          <View style={{ gap: 11 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
              <View
                style={{
                  backgroundColor: category.pastel,
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={mono(9.5, 600, { ls: 0.1, color: accent })}>
                  {shop.booking_mode === "queue"
                    ? "ORDEM DE CHEGADA"
                    : shop.booking_mode === "both"
                      ? "FILA E HORA MARCADA"
                      : "HORA MARCADA"}
                </Text>
              </View>
              {shop.rating_count > 0 ? (
                <Text style={mono(11.5, 600)}>
                  ★ {shop.rating_avg?.toFixed(1).replace(".", ",")}{" "}
                  <Text style={mono(11.5, 400, { color: color.muted })}>
                    {shop.rating_count} AVALIAÇÕES
                  </Text>
                </Text>
              ) : (
                <Text style={mono(11.5, 400, { color: color.muted })}>SEM AVALIAÇÕES</Text>
              )}
            </View>

            <Text style={sans(26, 800, { ls: -0.04 })}>{shop.name}</Text>
            {shop.description ? (
              <Text style={sans(15, 400, { lh: 1.5, color: color.body })}>{shop.description}</Text>
            ) : null}
            {shop.address_line ? (
              <Text style={mono(10.5, 400, { ls: 0.04, color: color.muted })}>
                {shop.address_line.toUpperCase()}
                {shop.neighborhood ? ` · ${shop.neighborhood.toUpperCase()}` : ""}
              </Text>
            ) : null}
          </View>

          {freeToday !== null ? (
            <Card
              radius={16}
              padding={15}
              style={{ flexDirection: "row", gap: 15, alignItems: "center" }}
            >
              {/* O resumo diz quantos horários estão livres, não quantos
                  existem: sem o total, o anel só sabe "tem" ou "não tem". */}
              <Ring
                size={58}
                innerSize={44}
                pct={freeToday > 0 ? 100 : 0}
                color={freeToday > 0 ? color.green : color.dotIdle}
              >
                <Text style={mono(15, 600)}>{freeToday}</Text>
              </Ring>
              <View style={{ gap: 4, flex: 1 }}>
                <Text style={sans(16.5, 700, { ls: -0.02 })}>Agenda de hoje</Text>
                <Text style={mono(10.5, 400, { ls: 0.05, color: color.muted })}>
                  {freeToday > 0
                    ? `${freeToday} ${freeToday === 1 ? "HORÁRIO LIVRE" : "HORÁRIOS LIVRES"}`
                    : "SEM HORÁRIO HOJE · VEJA OUTROS DIAS"}
                </Text>
              </View>
            </Card>
          ) : null}

          {shop.booking_mode !== "scheduled" ? (
            <Card radius={16} padding={16} style={{ gap: 11 }}>
              <Label>ORDEM DE CHEGADA</Label>
              {naFilaDaqui ? (
                <>
                  <Text style={sans(14.5, 400, { lh: 1.5, color: color.body })}>
                    Você já está nesta fila.
                  </Text>
                  <PrimaryButton
                    label="Ver minha posição"
                    height={46}
                    background={accent}
                    onPress={() => router.push({ pathname: "/fila", params: { id: shop.id } })}
                  />
                </>
              ) : (
                <>
                  <Text style={sans(14.5, 400, { lh: 1.5, color: color.body })}>
                    Entre na fila agora e acompanhe sua posição pelo app, sem esperar na loja.
                  </Text>
                  <PrimaryButton
                    label={queueBusy ? "Entrando…" : "Entrar na fila"}
                    height={46}
                    background={queueBusy ? color.chevron : accent}
                    onPress={queueBusy ? undefined : entrarNaFila}
                  />
                </>
              )}
              {queueError ? (
                <Text accessibilityRole="alert" style={sans(13, 500, { color: "#B33A1F" })}>
                  {queueError}
                </Text>
              ) : null}
            </Card>
          ) : null}

          <Segmented items={SHOP_TABS} value={tab} onChange={setTab} />

          {tab === "servicos" ? (
            <View style={{ gap: 11 }}>
              {shop.services.length === 0 ? (
                <Vazio texto="Esta loja ainda não publicou serviços." />
              ) : (
                shop.services.map((service) => (
                  <Card key={service.id} radius={15} padding={15} style={{ gap: 9 }}>
                    <View
                      style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}
                    >
                      <Text style={[sans(15.5, 700, { ls: -0.02 }), { flex: 1 }]}>
                        {service.name}
                      </Text>
                      <Text style={mono(14, 600)}>{moneyShort(service.price_cents)}</Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Text style={[mono(10, 400, { ls: 0.05, color: color.muted }), { flex: 1 }]}>
                        {duration(service.duration_minutes)}
                        {service.description ? ` · ${service.description.toUpperCase()}` : ""}
                      </Text>
                      <Pressable
                        onPress={() => comecar(service.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Agendar ${service.name}`}
                        style={({ pressed }) => ({
                          backgroundColor: accent,
                          borderRadius: 9,
                          paddingVertical: 9,
                          paddingHorizontal: 14,
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Text style={mono(10, 600, { ls: 0.08, color: "#fff" })}>AGENDAR</Text>
                      </Pressable>
                    </View>
                  </Card>
                ))
              )}
            </View>
          ) : null}

          {tab === "equipe" ? (
            <View style={{ gap: 11 }}>
              {shop.professionals.length === 0 ? (
                <Vazio texto="Esta loja ainda não publicou a equipe." />
              ) : (
                shop.professionals.map((pro) => (
                  <Card
                    key={pro.id}
                    radius={15}
                    padding={13}
                    style={{ flexDirection: "row", gap: 13, alignItems: "center" }}
                  >
                    <Photo
                      duotone={duo2(shade(accent, -0.3), shade(accent, 0.45))}
                      size={48}
                      radius={14}
                      mono={initialsOfName(pro.display_name)}
                      monoSize={14}
                      center
                      uri={usableImageUrl(pro.avatar_url)}
                      alt={`Foto de ${pro.display_name}`}
                    />
                    <View style={{ gap: 3, flex: 1 }}>
                      <Text style={sans(15, 700, { ls: -0.02 })}>{pro.display_name}</Text>
                      <Text style={mono(10, 400, { ls: 0.05, color: color.muted })}>
                        {(pro.title ?? "PROFISSIONAL").toUpperCase()}
                      </Text>
                    </View>
                  </Card>
                ))
              )}
            </View>
          ) : null}

          {tab === "avaliacoes" ? (
            <View style={{ gap: 11 }}>
              {!reviews || reviews.length === 0 ? (
                <Vazio texto="Ninguém avaliou esta loja ainda. Quem for atendido pode ser o primeiro." />
              ) : (
                reviews.map((review) => (
                  <Card key={review.id} radius={15} padding={15} style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={sans(14.5, 700, { ls: -0.02 })}>
                        {review.profiles?.full_name ?? "Cliente"}
                      </Text>
                      <Text style={mono(11.5, 600)}>★ {review.rating},0</Text>
                    </View>
                    {review.comment ? (
                      <Text style={sans(14, 400, { lh: 1.5, color: color.body })}>
                        {review.comment}
                      </Text>
                    ) : null}
                    <Text style={mono(9.5, 400, { ls: 0.06, color: color.muted })}>
                      {relativeDays(review.created_at)}
                    </Text>
                  </Card>
                ))
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {shop.services.length > 0 ? (
        <StickyFooter>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ gap: 2 }}>
              <Label>A PARTIR DE</Label>
              <Text style={mono(17, 600)}>{cheapest !== null ? moneyShort(cheapest) : "—"}</Text>
            </View>
            <PrimaryButton
              label="Ver horários"
              height={52}
              background={accent}
              style={{ flex: 1 }}
              onPress={() => comecar(shop.services[0]!.id)}
            />
          </View>
        </StickyFooter>
      ) : null}
    </Screen>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <Card radius={15} padding={18}>
      <Text style={sans(14, 400, { lh: 1.5, color: color.muted })}>{texto}</Text>
    </Card>
  );
}

function LojaCarregando({ onBack }: { onBack: () => void }) {
  // Mesmo lugar do botão da loja carregada: 12 pt abaixo da área segura. O
  // `top: 56` fixo só acertava em aparelho com entalhe de 44 pt.
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <Shimmer width="100%" height={246} radius={0} />
      <View style={{ padding: 20, gap: 16 }}>
        <Shimmer width={180} height={26} radius={8} />
        <Shimmer width="100%" height={64} radius={14} />
        <Shimmer width="100%" height={96} radius={14} />
      </View>
      <View style={{ position: "absolute", top: insets.top + 12, left: 16 }}>
        <BackButton boxed onPress={onBack} />
      </View>
    </Screen>
  );
}
