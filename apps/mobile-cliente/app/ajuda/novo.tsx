import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";

import { useSession } from "../../src/auth/session";
import { openTicket, TICKET_CATEGORIES, type TicketCategory } from "../../src/data/support";
import { color, radius } from "../../src/theme/tokens";
import { mono, sans } from "@vez/mobile-kit/theme";
import { Field } from "../../src/ui/Field";
import { BackHeader, Card, Chip, PrimaryButton } from "../../src/ui/primitives";
import { Screen, ScreenScroll } from "../../src/ui/Screen";

/**
 * Abrir chamado.
 *
 * Aceita contexto por parâmetro: a Agenda manda a loja e um assunto já escrito
 * a partir da reserva, e o chamado nasce ligado àquele estabelecimento. Sem
 * parâmetro, é um chamado da conta.
 *
 * A validação de verdade é do banco (`open_support_ticket`), que devolve o
 * texto em português. A daqui só evita a ida ao servidor no caso óbvio.
 */
export default function NovoChamado() {
  const router = useRouter();
  const { session } = useSession();
  const params = useLocalSearchParams<{
    establishmentId?: string;
    establishmentName?: string;
    subject?: string;
    category?: string;
  }>();

  const inicial = TICKET_CATEGORIES.find((item) => item.key === params.category)?.key;

  const [subject, setSubject] = useState(params.subject ?? "");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<TicketCategory>(inicial ?? "other");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const establishmentId = params.establishmentId ?? null;

  async function enviar() {
    setErro(null);
    if (subject.trim().length < 3) {
      setErro("Descreva o assunto em poucas palavras.");
      return;
    }
    if (body.trim() === "") {
      setErro("Conte o que aconteceu.");
      return;
    }

    setEnviando(true);
    const result = await openTicket({
      subject: subject.trim(),
      body: body.trim(),
      category,
      establishmentId,
    });
    setEnviando(false);

    if (!result.ok) {
      setErro(result.message);
      return;
    }
    // Substitui em vez de empilhar: voltar do chamado recém-aberto tem de cair
    // na lista, não no formulário já enviado.
    router.replace(`/ajuda/${result.value.id}`);
  }

  if (!session) {
    return (
      <Screen>
        <ScreenScroll gap={20}>
          <BackHeader title="Abrir chamado" onBack={() => router.back()} />
          <Card radius={18} padding={20} style={{ gap: 9 }}>
            <Text style={sans(19, 800, { ls: -0.03 })}>Entre para abrir um chamado</Text>
            <Text style={sans(14.5, 400, { lh: 1.5, color: color.muted })}>
              É pela sua conta que a equipe responde e que você acompanha a conversa.
            </Text>
          </Card>
          <PrimaryButton label="Entrar" height={54} onPress={() => router.push("/entrar")} />
        </ScreenScroll>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenScroll gap={20}>
          <BackHeader title="Abrir chamado" onBack={() => router.back()} />

          {params.establishmentName ? (
            <Card radius={16} padding={15} style={{ gap: 5 }}>
              <Text style={mono(9.5, 600, { ls: 0.1, color: color.muted })}>SOBRE</Text>
              <Text style={sans(15, 700, { ls: -0.02 })}>{params.establishmentName}</Text>
            </Card>
          ) : null}

          <View style={{ gap: 11 }}>
            <Text style={mono(10, 600, { ls: 0.12, color: color.muted })}>ASSUNTO DO CHAMADO</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {TICKET_CATEGORIES.map((item) => (
                <Chip
                  key={item.key}
                  label={item.label}
                  active={item.key === category}
                  onPress={() => setCategory(item.key)}
                />
              ))}
            </View>
          </View>

          <Field
            label="Título"
            value={subject}
            onChangeText={setSubject}
            placeholder="Em poucas palavras"
            maxLength={120}
          />

          <View style={{ gap: 7 }}>
            <Text style={mono(10, 600, { ls: 0.12, color: color.muted })}>O QUE ACONTECEU</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              maxLength={4000}
              placeholder="Conte com as suas palavras. Quanto mais detalhe, menos idas e vindas."
              placeholderTextColor={color.chevron}
              style={[
                sans(15, 500, { ls: -0.01, lh: 1.45 }),
                {
                  minHeight: 150,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: color.line,
                  backgroundColor: color.bg,
                  padding: 14,
                },
              ]}
            />
          </View>

          {erro ? <Text style={sans(13, 500, { lh: 1.4, color: color.coral })}>{erro}</Text> : null}

          <PrimaryButton
            label={enviando ? "Enviando…" : "Enviar chamado"}
            height={54}
            onPress={enviando ? undefined : enviar}
          />

          <Text style={sans(13, 400, { lh: 1.5, color: color.muted })}>
            A equipe responde dentro do próprio chamado. Como ainda não existe aviso no celular,
            volte em Perfil › Ajuda para ver a resposta.
          </Text>
        </ScreenScroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
