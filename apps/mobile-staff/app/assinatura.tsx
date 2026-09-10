import { sans } from "@vez/mobile-kit/theme";
import { Text, View } from "react-native";

import { color } from "../src/theme/tokens";
import { Card, SectionLabel } from "../src/ui/primitives";
import { PlainHeader, Screen, ScreenScroll } from "../src/ui/Screen";

/**
 * Assinatura e plano.
 *
 * O canvas desenhava um plano de R$ 89 por mês, quatro faturas pagas e um
 * cartão terminado em 4417. Nada disso existe: o banco não tem uma linha sobre
 * cobrança, e o modelo — mensalidade com cota por cidade ou comissão por
 * atendimento — é uma decisão de negócio em aberto (item 4 de
 * proximos-passos.md).
 *
 * Copiar os números do desenho faria backend inexistente parecer app
 * funcionando, que é o pior estado possível de um produto que cobra. Esta tela
 * então diz a verdade e mostra a pergunta que falta responder — que é uma
 * informação de valor real para quem está avaliando entrar na plataforma.
 */
export default function Assinatura() {
  return (
    <Screen>
      <PlainHeader title="Assinatura e plano" />

      <ScreenScroll bottom={40}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 16 }}>
          <Card radius={16} padding={16} background={color.rest} borderColor={color.rest}>
            <Text style={sans(18, 800, { ls: -0.3 / 18 })}>A Vez ainda não cobra nada de você</Text>
            <Text style={[sans(13.5, 400, { lh: 1.55, color: color.muted }), { marginTop: 8 }]}>
              Não há plano ativo, fatura nem cartão cadastrado — nem para você, nem para ninguém. O
              modelo de cobrança da plataforma ainda não foi definido, e enquanto não for, o uso é
              livre.
            </Text>
          </Card>

          <View style={{ gap: 10 }}>
            <SectionLabel>Os dois modelos em estudo</SectionLabel>

            <Card radius={14} padding={14}>
              <Text style={sans(14.5, 700)}>Mensalidade com cota por cidade</Text>
              <Text style={[sans(12.5, 400, { lh: 1.5, color: color.muted }), { marginTop: 5 }]}>
                Um valor fixo por mês, e um número limitado de lojas por cidade. Você paga o mesmo
                num mês cheio e num mês fraco, e ganha exclusividade relativa na sua região.
              </Text>
            </Card>

            <Card radius={14} padding={14}>
              <Text style={sans(14.5, 700)}>Comissão por atendimento</Text>
              <Text style={[sans(12.5, 400, { lh: 1.5, color: color.muted }), { marginTop: 5 }]}>
                Um percentual sobre o que foi agendado pelo app. Mês fraco custa pouco, mês cheio
                custa mais — e a plataforma só ganha quando você ganha.
              </Text>
            </Card>
          </View>

          <Text style={sans(12.5, 400, { lh: 1.55, color: color.muted })}>
            As duas escolhas produzem bancos de dados diferentes, e por isso nenhuma foi construída
            pela metade. Quando houver decisão, esta tela passa a mostrar seu plano, suas faturas e
            a forma de pagamento — com números de verdade.
          </Text>
        </View>
      </ScreenScroll>
    </Screen>
  );
}
