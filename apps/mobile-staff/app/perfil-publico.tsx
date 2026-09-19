import { sans } from "@vez/mobile-kit/theme";
import * as ImagePicker from "expo-image-picker";
import { Camera, Plus } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";

import { useApplicationState } from "../src/data/application";
import { useEstablishment } from "../src/data/establishment";
import { type Photo, removePhoto, uploadPhoto, usePhotos } from "../src/data/photos";
import { color } from "../src/theme/tokens";
import { Field } from "../src/ui/Field";
import {
  Card,
  Caveat,
  EmptyState,
  ErrorNote,
  Hatch,
  OutlineButton,
  PrimaryButton,
  SectionLabel,
  Tag,
} from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";
import { Sheet } from "../src/ui/Sheet";
import { useToast } from "../src/ui/Toast";

/** Quantas fotos a loja mostra. O app do cliente usa a primeira como capa. */
const MAX_PHOTOS = 8;

/**
 * Os cinco acentos que a loja pode escolher.
 *
 * `accent_color` é override: nulo significa "usa a cor da categoria", que é o
 * caso da esmagadora maioria. A coluna existe para quem tem marca própria, não
 * para obrigar todo mundo a escolher uma cor no cadastro — por isso "usar a cor
 * da categoria" é uma opção de verdade aqui, e não a ausência de escolha.
 */
const SWATCHES = ["#1F5F5B", "#14171A", "#8A4B2A", "#3B4CCA", "#B0284A"];

export default function PerfilPublico() {
  const toast = useToast();
  const { establishment, isManager, patchEstablishment } = useEstablishment();
  const application = useApplicationState(establishment);

  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    address: string;
    neighborhood: string;
    phone: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!establishment) {
    return (
      <Screen>
        <PlainHeader title="Perfil público" />
      </Screen>
    );
  }

  if (!isManager) {
    return (
      <Screen>
        <PlainHeader title="Perfil público" />
        <EmptyState
          title="Só dono ou gerência edita o perfil"
          body="É o que o cliente lê antes de decidir vir. Quem responde pela loja escreve."
        />
      </Screen>
    );
  }

  const form = draft ?? {
    name: establishment.name,
    description: establishment.description ?? "",
    address: establishment.address_line ?? "",
    neighborhood: establishment.neighborhood ?? "",
    phone: establishment.phone ?? "",
  };

  const accent = establishment.accent_color ?? color.ink;
  const dirty = draft !== null;

  async function save() {
    setBusy(true);
    const ok = await patchEstablishment({
      name: form.name.trim(),
      description: form.description.trim() || null,
      address_line: form.address.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      phone: form.phone.trim() || null,
    });
    setBusy(false);

    if (!ok) {
      toast("Não foi possível salvar.", "bad");
      return;
    }
    setDraft(null);
    toast("Perfil salvo.");
  }

  return (
    <Screen>
      <PlainHeader title="Perfil público" />

      <ScreenScroll bottom={40}>
        <PhotoSection establishmentId={establishment.id} />

        <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 18 }}>
          <Field
            label="Nome"
            value={form.name}
            onChangeText={(next) => setDraft({ ...form, name: next })}
          />
          <Field
            label="Descrição"
            placeholder="O que a sua loja faz, em duas linhas"
            value={form.description}
            onChangeText={(next) => setDraft({ ...form, description: next })}
            multiline
          />
          <Field
            label="Endereço"
            placeholder="Rua, número"
            value={form.address}
            onChangeText={(next) => setDraft({ ...form, address: next })}
          />
          <Field
            label="Bairro"
            value={form.neighborhood}
            onChangeText={(next) => setDraft({ ...form, neighborhood: next })}
          />
          <Field
            label="Telefone"
            value={form.phone}
            onChangeText={(next) => setDraft({ ...form, phone: next })}
            keyboardType="phone-pad"
            mono
          />

          <PrimaryButton
            label={busy ? "Salvando…" : "Salvar perfil"}
            height={54}
            disabled={!dirty || busy}
            onPress={save}
          />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 26, gap: 12 }}>
          <SectionLabel>Cor da sua loja</SectionLabel>
          <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>
            Colore o seu perfil dentro do app do cliente. O resto do app não muda.
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {SWATCHES.map((swatch) => {
              const on = establishment.accent_color === swatch;
              return (
                <Pressable
                  key={swatch}
                  onPress={async () => {
                    const ok = await patchEstablishment({ accent_color: swatch });
                    toast(ok ? "Cor atualizada." : "Não foi possível salvar.", ok ? "ok" : "bad");
                  }}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: 12,
                    backgroundColor: swatch,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: on ? 3 : 0,
                    borderColor: color.bg,
                    shadowColor: swatch,
                    shadowOpacity: on ? 0.5 : 0,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: on ? 4 : 0,
                  }}
                >
                  {on ? <Text style={sans(14, 700, { color: "#fff" })}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>

          {establishment.accent_color ? (
            <Pressable
              onPress={async () => {
                const ok = await patchEstablishment({ accent_color: null });
                toast(
                  ok ? "Voltou à cor da categoria." : "Não foi possível salvar.",
                  ok ? "ok" : "bad",
                );
              }}
              hitSlop={8}
            >
              <Text style={sans(13, 600, { color: color.coral })}>Usar a cor da categoria</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 26, gap: 10 }}>
          <SectionLabel>Prévia · como o cliente vê</SectionLabel>
          <Card radius={18} shadow>
            <View
              style={{
                height: 74,
                backgroundColor: accent,
                justifyContent: "flex-end",
                paddingHorizontal: 14,
                paddingBottom: 12,
              }}
            >
              <Text style={sans(15, 800, { ls: -0.2 / 15, color: "#fff" })} numberOfLines={1}>
                {form.name || "Sua loja"}
              </Text>
            </View>
            <View style={{ padding: 14, gap: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Tag
                  label={establishment.status === "active" ? "publicada" : "não publicada"}
                  tint={establishment.status === "active" ? color.green : color.amberDeep}
                  background={establishment.status === "active" ? color.greenTint : color.amberTint}
                />
                <Text style={sans(11, 500, { color: color.muted })}>
                  {establishment.rating_count > 0
                    ? `${establishment.rating_avg?.toFixed(1)} · ${establishment.rating_count} avaliações`
                    : "ainda sem avaliações"}
                </Text>
              </View>
              <Text style={sans(12, 400, { lh: 1.5, color: color.muted })}>
                {form.description || "Sem descrição — o cliente não sabe o que vocês fazem."}
              </Text>
              <Text style={sans(12, 400, { lh: 1.5, color: color.muted })}>
                {[form.address, form.neighborhood].filter(Boolean).join(" · ") ||
                  "Sem endereço — o cliente não sabe onde vocês estão."}
              </Text>
            </View>
          </Card>
        </View>

        <View style={{ paddingTop: 20 }}>
          <Caveat>
            {establishment.status === "active"
              ? "Sua loja está publicada e aparece nas buscas do app do cliente."
              : application?.kind === "correction"
                ? `A Vez pediu uma correção no cadastro: ${application.body} O dono corrige e reenvia pelo portal.`
                : application
                  ? `${application.title}. ${application.body}`
                  : "A loja ainda não aparece para clientes."}
          </Caveat>
        </View>
      </ScreenScroll>
    </Screen>
  );
}

/**
 * Fotos do perfil público, no bucket `establishment-photos`.
 *
 * O caminho `<loja>/<arquivo>` é o que a política do bucket lê para saber de
 * quem é o arquivo — as regras estão em `photo-rules.ts`, as mesmas do portal.
 * Apagar pede confirmação numa folha: a foto some do app do cliente na hora.
 */
function PhotoSection({ establishmentId }: { establishmentId: string }) {
  const toast = useToast();
  const photos = usePhotos(establishmentId);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Photo | null>(null);

  const list = photos.data ?? [];
  const full = list.length >= MAX_PHOTOS;

  async function pick() {
    if (busy || full) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast("Sem acesso às fotos. Libere nas configurações do celular.", "bad");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    setBusy(true);
    try {
      const last = list.at(-1)?.sortOrder ?? -1;
      await uploadPhoto(establishmentId, asset, last + 1);
      toast("Foto enviada.");
      photos.reload();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Não foi possível enviar a foto.", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await removePhoto(removing);
      toast("Foto apagada.");
      setRemoving(null);
      photos.reload();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Não foi possível apagar a foto.", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ paddingTop: 14, gap: 8 }}>
      {photos.error ? <ErrorNote message={photos.error} onRetry={photos.reload} /> : null}

      {list.length === 0 && !photos.loading ? (
        <Pressable
          onPress={pick}
          accessibilityRole="button"
          accessibilityLabel="Adicionar foto de capa"
          style={{
            marginHorizontal: 20,
            height: 120,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: color.line,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Hatch stripe={8} light="#F4F4F6" dark="#EDEDEF" />
          {busy ? (
            <ActivityIndicator color={color.muted} />
          ) : (
            <Camera size={20} color={color.muted} strokeWidth={1.7} />
          )}
          <Text style={sans(12.5, 600, { color: color.muted })}>
            {busy ? "Enviando…" : "Adicionar foto de capa"}
          </Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        >
          {list.map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => setRemoving(photo)}
              accessibilityRole="button"
              accessibilityLabel={
                index === 0
                  ? "Foto de capa. Toque para apagar"
                  : `Foto ${index + 1}. Toque para apagar`
              }
              style={{ width: 168, height: 112, borderRadius: 12, overflow: "hidden" }}
            >
              <Image source={{ uri: photo.url }} style={{ width: "100%", height: "100%" }} />
              {index === 0 ? (
                <View style={{ position: "absolute", left: 8, top: 8 }}>
                  <Tag label="capa" tint="#fff" background="rgba(20,23,26,0.6)" />
                </View>
              ) : null}
            </Pressable>
          ))}
          {!full ? (
            <Pressable
              onPress={pick}
              accessibilityRole="button"
              accessibilityLabel="Adicionar foto"
              style={{
                width: 112,
                height: 112,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: color.stroke,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {busy ? (
                <ActivityIndicator color={color.muted} />
              ) : (
                <Plus size={20} color={color.muted} strokeWidth={1.8} />
              )}
              <Text style={sans(12, 600, { color: color.muted })}>
                {busy ? "Enviando…" : "Adicionar"}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      <Text style={[sans(12, 400, { lh: 1.45, color: color.muted }), { paddingHorizontal: 20 }]}>
        JPG, PNG ou WebP até 5 MB. A primeira foto é a capa no app do cliente. Toque numa foto para
        apagar.
      </Text>

      <Sheet
        visible={removing !== null}
        onClose={() => (busy ? undefined : setRemoving(null))}
        title="Apagar esta foto?"
        subtitle="Ela some do perfil no app do cliente na hora."
      >
        {removing ? (
          <View style={{ gap: 12 }}>
            <Image
              source={{ uri: removing.url }}
              style={{ width: "100%", height: 160, borderRadius: 12 }}
            />
            <PrimaryButton
              label={busy ? "Apagando…" : "Apagar foto"}
              background={color.danger}
              disabled={busy}
              onPress={confirmRemove}
            />
            <OutlineButton label="Manter" onPress={() => setRemoving(null)} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
