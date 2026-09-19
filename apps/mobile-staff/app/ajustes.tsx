import { MIN_PASSWORD_LENGTH, authErrorMessage, passwordError } from "@vez/mobile-kit/auth";
import { sans } from "@vez/mobile-kit/theme";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { supabase } from "../lib/supabase";
import { useSession } from "../src/auth/session";
import { useEstablishment } from "../src/data/establishment";
import { PREF_DEFAULTS, saveNotificationPrefs, useNotificationPrefs } from "../src/data/prefs";
import { signOut } from "../src/push";
import { color } from "../src/theme/tokens";
import { Field } from "../src/ui/Field";
import { PrimaryButton, SectionLabel, ToggleRow } from "../src/ui/primitives";
import { PushCard } from "../src/ui/PushCard";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";
import { Sheet } from "../src/ui/Sheet";
import { useToast } from "../src/ui/Toast";

/**
 * Notificações e conta.
 *
 * A preferência de aviso é de cada pessoa, não da loja: quem atende em duas
 * unidades quer o barulho de uma e não da outra, e o dono não decide o que toca
 * no celular do barbeiro. Por isso a linha é por membro e por estabelecimento.
 * O despacho consulta essas linhas antes de enfileirar; o `PushCard` mostra se
 * este aparelho recebe e se os últimos avisos saíram.
 */
export default function Ajustes() {
  const toast = useToast();
  const { user } = useSession();
  const { establishment } = useEstablishment();

  const prefsQuery = useNotificationPrefs(user?.id ?? null, establishment?.id ?? null);
  const prefs = { ...PREF_DEFAULTS, ...(prefsQuery.data ?? {}) };

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passError, setPassError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function togglePref(key: keyof typeof PREF_DEFAULTS, next: boolean) {
    if (!user || !establishment) return;
    const ok = await saveNotificationPrefs(
      user.id,
      establishment.id,
      { [key]: next },
      prefsQuery.data,
    );
    toast(ok ? "Preferência salva." : "Não foi possível salvar.", ok ? "ok" : "bad");
    prefsQuery.reload();
  }

  async function changePassword() {
    const invalid = passwordError(password);
    setPassError(invalid);
    if (invalid) return;

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setPassError(authErrorMessage(error));
      return;
    }
    setPasswordOpen(false);
    setPassword("");
    toast("Senha trocada.");
  }

  return (
    <Screen>
      <PlainHeader title="Notificações e ajustes" />

      <ScreenScroll bottom={40}>
        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 }}>
          <SectionLabel>Avisos que você recebe</SectionLabel>
        </View>

        <ToggleRow
          first
          label="Novo agendamento"
          help="Toca a cada pedido novo pelo app do cliente."
          value={prefs.notify_new_appointment}
          onChange={(next) => togglePref("notify_new_appointment", next)}
        />
        <ToggleRow
          label="Cancelamento"
          help="Quando o cliente desmarca."
          value={prefs.notify_cancellation}
          onChange={(next) => togglePref("notify_cancellation", next)}
        />
        <ToggleRow
          label="Alguém entrou na fila"
          help="Útil se o balcão fica sozinho."
          value={prefs.notify_queue_join}
          onChange={(next) => togglePref("notify_queue_join", next)}
        />
        <ToggleRow
          label="Resumo do dia pela manhã"
          help="A partir das 7h: quantas reservas há no dia e a primeira hora."
          value={prefs.notify_daily_summary}
          onChange={(next) => togglePref("notify_daily_summary", next)}
        />

        <View style={{ paddingTop: 20 }}>
          <PushCard />
        </View>

        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 6,
            borderTopWidth: 1,
            borderTopColor: color.lineSoft,
            marginTop: 20,
          }}
        >
          <SectionLabel>Conta</SectionLabel>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <AccountRow label="E-mail" value={user?.email ?? "—"} />
          <AccountRow label="Trocar senha" onPress={() => setPasswordOpen(true)} />
          <AccountRow
            label="Sair desta conta"
            tint={color.danger}
            onPress={() => void signOut()}
            last
          />
        </View>
      </ScreenScroll>

      <Sheet
        visible={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Trocar senha"
        subtitle="Você continua conectado neste aparelho. Os outros vão precisar entrar de novo."
      >
        <View style={{ gap: 14 }}>
          <Field
            label="Nova senha"
            value={password}
            onChangeText={(next) => {
              setPassword(next);
              setPassError(null);
            }}
            error={passError}
            placeholder={`Ao menos ${MIN_PASSWORD_LENGTH} caracteres`}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <PrimaryButton
            label={busy ? "Salvando…" : "Salvar senha"}
            height={54}
            disabled={busy}
            onPress={changePassword}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function AccountRow({
  label,
  value,
  tint = color.ink,
  onPress,
  last = false,
}: {
  label: string;
  value?: string;
  tint?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 15,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.lineSoft,
      }}
    >
      <Text style={sans(14, 600, { color: tint })}>{label}</Text>
      {value ? <Text style={sans(12.5, 500, { color: color.faint })}>{value}</Text> : null}
      {onPress && !value ? <Text style={sans(15, 600, { color: color.chevron })}>›</Text> : null}
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}
