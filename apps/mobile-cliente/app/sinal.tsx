import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AuthGate } from "../src/auth/AuthGate";
import { useAppointment } from "../src/data/appointments";
import {
  type DepositPayment,
  type PaymentMethod,
  type PaymentScope,
  readDepositPayment,
  requestDepositPayment,
} from "../src/data/payments";
import { hourMinute, money } from "@vez/mobile-kit/format";
import { useGoToTab } from "../src/navigation";
import { color } from "../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import {
  BackHeader,
  Card,
  Label,
  OutlineButton,
  PrimaryButton,
  Segmented,
  Shimmer,
  StickyFooter,
} from "../src/ui/primitives";
import { Screen, ScreenScroll } from "../src/ui/Screen";
import { useActionErrorText } from "../src/ui/States";

/** De quanto em quanto a tela relê o pagamento enquanto espera ele cair. */
const POLL_MS = 4000;

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "pix", label: "PIX" },
  { key: "card", label: "CARTÃO" },
];

const isWaiting = (payment: DepositPayment | null) =>
  payment?.status === "pending" || payment?.status === "authorized";

/**
 * Pagamento de uma reserva pelo app: o sinal ou o valor inteiro, por Pix ou
 * cartão.
 *
 * A reserva já existe quando esta tela abre: quem a criou foi `/pagamento`.
 * Sair sem pagar não a desfaz — o pagamento fica pendente e pode ser feito
 * depois, pelo detalhe da reserva.
 *
 * Pix é pago no app do banco, então o que importa é copiar o código. Cartão é
 * pago na página do provedor, aberta por cima do app: o número do cartão nunca
 * passa pelo Vez. Nos dois casos a tela relê o pagamento no banco a cada poucos
 * segundos (leitura barata, protegida por RLS); "Já paguei" é o único gesto que
 * consulta o provedor.
 */
function SinalConteudo() {
  const router = useRouter();
  const goToTab = useGoToTab();
  const { reserva, origem, escopo } = useLocalSearchParams<{
    reserva?: string;
    origem?: string;
    escopo?: string;
  }>();
  const { data: appointment } = useAppointment(reserva ?? null);

  const [payment, setPayment] = useState<DepositPayment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** O que a pessoa escolheu; nulo enquanto vale o da cobrança que já existe. */
  const [chosen, setChosen] = useState<PaymentMethod | null>(null);
  const errorText = useActionErrorText(error);

  // Abrir a tela não cria cobrança: só olha se já existe uma. Quem cria é o
  // toque em "Gerar código" ou "Pagar com cartão".
  useEffect(() => {
    let active = true;
    if (!reserva) return;
    readDepositPayment(reserva)
      .then((found) => {
        if (active && found && found.status !== "cancelled" && found.status !== "failed") {
          setPayment(found);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [reserva]);

  const waiting = isWaiting(payment);
  useEffect(() => {
    if (!reserva || !waiting) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      readDepositPayment(reserva)
        .then((fresh) => {
          if (fresh) setPayment(fresh);
        })
        // Falha de rede numa releitura não é notícia: a próxima tenta de novo.
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [reserva, waiting]);

  const scope: PaymentScope = payment?.scope ?? (escopo === "full" ? "full" : "deposit");
  const method: PaymentMethod = chosen ?? payment?.method ?? "pix";

  const abrirPagina = useCallback(async (url: string) => {
    // Fecha sozinha quando o provedor devolve para o esquema do app.
    await WebBrowser.openAuthSessionAsync(url, "vezcliente://").catch(() => undefined);
  }, []);

  /** Cria a cobrança do método escolhido (encerrando a anterior, se era outra). */
  async function pagar() {
    if (!reserva) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await requestDepositPayment(reserva, { method, scope });
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }
    setPayment(result.payment);
    setChosen(null);
    if (result.payment.method === "card" && result.payment.checkout_url) {
      await abrirPagina(result.payment.checkout_url);
      const checked = await requestDepositPayment(reserva);
      if (checked.ok) setPayment(checked.payment);
    }
    setBusy(false);
  }

  /** "Já paguei": confere no provedor, sem criar nem trocar nada. */
  async function conferir() {
    if (!reserva) return;
    setBusy(true);
    setError(null);
    const result = await requestDepositPayment(reserva);
    setBusy(false);
    if (result.ok) setPayment(result.payment);
    else setError(result.message);
  }

  function sair() {
    if (origem === "reserva") {
      goToTab({
        pathname: "/(tabs)/agenda",
        params: { reservada: payment?.status === "paid" ? "sinal-pago" : "sinal-pendente" },
      });
    } else {
      router.back();
    }
  }

  async function copiar() {
    if (!payment?.pix_copy_paste) return;
    await Clipboard.setStringAsync(payment.pix_copy_paste);
    setCopied(true);
  }

  const expired =
    waiting && payment?.expires_at ? new Date(payment.expires_at).getTime() <= now : false;
  const dead = payment?.status === "cancelled" || payment?.status === "failed" || expired;
  const paid = payment?.status === "paid" || payment?.status === "partially_refunded";
  const refunded = payment?.status === "refunded";
  // Há uma cobrança esperando, e é do método que está selecionado.
  const current = waiting && !expired && payment?.method === method;

  const amountCents =
    payment?.amount_cents ??
    (appointment ? (scope === "full" ? appointment.price_cents : appointment.deposit_cents) : null);
  const what = scope === "full" ? "valor da reserva" : "sinal";

  return (
    <Screen>
      <ScreenScroll gap={20}>
        <BackHeader title={scope === "full" ? "Pagar reserva" : "Sinal da reserva"} onBack={sair} />

        {!reserva ? (
          <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
            Reserva não informada.
          </Text>
        ) : !loaded || amountCents === null ? (
          <>
            <Shimmer width="100%" height={96} radius={18} />
            <Shimmer width="100%" height={150} radius={16} />
          </>
        ) : (
          <Card radius={18} padding={18} style={{ gap: 6 }}>
            <Label>{paid ? "PAGO" : scope === "full" ? "VALOR A PAGAR" : "SINAL A PAGAR"}</Label>
            <Text style={sans(30, 800, { ls: -0.04 })}>{money(amountCents)}</Text>
            <Text style={sans(13.5, 400, { lh: 1.5, color: color.muted })}>
              {scope === "full"
                ? "Com isto a reserva fica paga: não há nada a acertar no estabelecimento."
                : paid
                  ? "O restante é pago direto no estabelecimento, no dia do atendimento."
                  : "O sinal garante o horário. O restante é pago no estabelecimento."}
            </Text>
          </Card>
        )}

        {paid ? (
          <Card
            radius={16}
            padding={15}
            style={{ backgroundColor: color.greenTint, borderColor: color.greenTint }}
          >
            <Text
              accessibilityRole="alert"
              style={sans(14, 600, { lh: 1.45, color: color.greenDeep })}
            >
              Pagamento confirmado{payment?.paid_at ? ` às ${hourMinute(payment.paid_at)}` : ""}.
            </Text>
          </Card>
        ) : null}

        {refunded ? (
          <Card radius={16} padding={15}>
            <Text style={sans(14, 500, { lh: 1.45, color: color.body })}>
              Este pagamento foi devolvido. O valor volta para a conta ou o cartão de onde saiu.
            </Text>
          </Card>
        ) : null}

        {reserva && loaded && !paid && !refunded ? (
          <View style={{ gap: 11 }}>
            <Label>COMO PAGAR</Label>
            <Segmented
              items={METHODS}
              value={method}
              onChange={(key) => {
                setChosen(key as PaymentMethod);
                setError(null);
              }}
            />
          </View>
        ) : null}

        {current && method === "pix" && payment?.pix_copy_paste ? (
          <View style={{ gap: 11 }}>
            <Label>PIX COPIA E COLA</Label>
            <Card radius={16} padding={15} style={{ gap: 12 }}>
              <Text selectable style={mono(11, 400, { lh: 1.5, color: color.body })}>
                {payment.pix_copy_paste}
              </Text>
              <OutlineButton
                label={copied ? "Código copiado" : "Copiar código"}
                height={46}
                onPress={copiar}
              />
            </Card>
            <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>
              Abra o app do seu banco, escolha Pix copia e cola e cole o código.
              {payment.expires_at ? ` Ele vale até ${hourMinute(payment.expires_at)}.` : ""} Esta
              tela atualiza sozinha quando o pagamento cair.
            </Text>
          </View>
        ) : null}

        {current && method === "card" && payment?.checkout_url ? (
          <Card radius={16} padding={15} style={{ gap: 12 }}>
            <Text style={sans(13.5, 400, { lh: 1.5, color: color.body })}>
              O cartão é informado na página segura do provedor de pagamento. O Vez não vê nem
              guarda o número.
              {payment.expires_at ? ` A página vale até ${hourMinute(payment.expires_at)}.` : ""}
            </Text>
            <OutlineButton
              label="Abrir página de pagamento"
              height={46}
              onPress={busy ? undefined : () => abrirPagina(payment.checkout_url!).then(conferir)}
            />
          </Card>
        ) : null}

        {reserva && loaded && !paid && !refunded && !current && !dead ? (
          <Text style={sans(12.5, 400, { lh: 1.45, color: color.muted })}>
            {method === "pix"
              ? `O Pix do ${what} é pago no app do seu banco, com um código copia e cola.`
              : `O ${what} é pago com cartão de crédito ou débito, em uma página segura do provedor de pagamento.`}
          </Text>
        ) : null}

        {dead ? (
          <Card radius={16} padding={15} style={{ backgroundColor: color.amberTint }}>
            <Text style={sans(13.5, 500, { lh: 1.45, color: color.amberDeep })}>
              A cobrança anterior venceu sem pagamento. Gere outra para pagar — sua reserva continua
              de pé.
            </Text>
          </Card>
        ) : null}

        {errorText ? (
          <Card
            radius={14}
            padding={14}
            style={{ borderColor: color.coralBorder, backgroundColor: "#FFF4F1" }}
          >
            <Text accessibilityRole="alert" style={sans(13.5, 500, { lh: 1.4, color: "#B33A1F" })}>
              {errorText}
            </Text>
          </Card>
        ) : null}

        {reserva && !paid && !refunded ? (
          <Pressable onPress={sair} hitSlop={6} accessibilityRole="button">
            <Text style={sans(13, 600, { color: color.muted })}>Pagar depois</Text>
          </Pressable>
        ) : null}
      </ScreenScroll>

      {reserva && loaded ? (
        <StickyFooter>
          {paid || refunded ? (
            <PrimaryButton label="Concluir" height={54} onPress={sair} />
          ) : current ? (
            <PrimaryButton
              label={busy ? "Conferindo…" : "Já paguei"}
              height={54}
              background={busy ? color.chevron : undefined}
              onPress={busy ? undefined : conferir}
            />
          ) : (
            <PrimaryButton
              label={busy ? "Aguarde…" : method === "pix" ? "Gerar código Pix" : "Pagar com cartão"}
              height={54}
              background={busy ? color.chevron : undefined}
              onPress={busy ? undefined : pagar}
            />
          )}
        </StickyFooter>
      ) : null}
    </Screen>
  );
}

/** Exige conta: o pagamento é de uma reserva do próprio cliente. */
export default function Sinal() {
  return (
    <AuthGate>
      <SinalConteudo />
    </AuthGate>
  );
}
