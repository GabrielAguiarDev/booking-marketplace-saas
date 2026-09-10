import { COMMISSION, PRICE, brl, pricing } from "./data";
import { SectionHead } from "./ui";

const FIXED_PERKS = [
  "Agenda, fila de espera e regras próprias",
  "Página no app com a cor da sua marca",
  "Financeiro e desempenho por profissional",
  "Profissionais e serviços sem limite de quantidade",
  "Aplicativo do balcão e suporte por WhatsApp",
];

export function Plans() {
  const { perBooking, breakEven, rows } = pricing();

  return (
    <section id="planos" className="band">
      <div className="wrap band__inner">
        <SectionHead
          wide
          eyebrow="05 — planos"
          title="Dois planos, as mesmas funções."
          lead="Mensalidade fixa ou comissão por agendamento concluído. Você escolhe pelo seu movimento; o que muda é só a forma de pagar."
        />

        <div className="plans">
          <div data-reveal className="plan plan--featured">
            <div>
              <h3>Mensalidade fixa</h3>
              <p>Compensa a partir de {breakEven} agendamentos por mês</p>
            </div>
            <div className="plan__price">
              <strong className="mono">R$ {brl(PRICE)}</strong>
              <span className="mono">/ mês</span>
            </div>
            <p className="plan__note">
              Sem comissão por agendamento, quantos você fizer. Preço travado enquanto você não
              sair.
            </p>
            <hr />
            <ul className="plan__perks">
              {FIXED_PERKS.map((perk) => (
                <li key={perk}>
                  <span className="green">✓</span>
                  {perk}
                </li>
              ))}
            </ul>
            <a href="#cadastro" className="btn btn--primary btn--block">
              Começar pela mensalidade
            </a>
          </div>

          <div data-reveal className="plan" style={{ transitionDelay: "80ms" }}>
            <div>
              <h3>Comissão por agendamento</h3>
              <p>Compensa abaixo de {breakEven} agendamentos por mês</p>
            </div>
            <div className="plan__price">
              <strong className="mono">{COMMISSION}%</strong>
              <span className="mono">por agendamento concluído</span>
            </div>
            <p className="plan__note">
              Sem mensalidade. Você paga só quando o cliente é atendido. Agendamento cancelado ou
              falta não é cobrado.
            </p>
            <hr />
            <ul className="plan__perks">
              <li>
                <span className="green">✓</span>Exatamente as mesmas funções do plano fixo
              </li>
              <li>
                <span className="green">✓</span>Nada de taxa de entrada nem de mudança de plano
              </li>
              <li>
                <span className="muted">·</span>Quanto mais você agenda, mais você paga
              </li>
            </ul>
            <a href="#cadastro" className="btn btn--ghost btn--block">
              Começar por comissão
            </a>
          </div>
        </div>

        <div data-reveal className="compare">
          <h3>Qual sai mais barato para você, em número</h3>
          <p className="compare__lead">
            Com ticket médio de R$ 60, a comissão de {COMMISSION}% custa R$ {perBooking} por
            agendamento. Fazendo as contas:
          </p>
          <div className="compare__scroll">
            <table className="compare__table">
              <thead>
                <tr>
                  <th>agendamentos / mês</th>
                  <th>mensalidade</th>
                  <th>comissão</th>
                  <th>sai melhor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.n}>
                    <td>{r.n}</td>
                    <td>{r.fixed}</td>
                    <td>{r.comm}</td>
                    <td className={r.tie ? "muted" : "green"}>{r.winner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="compare__verdict">
            <b>O ponto de virada é {breakEven} agendamentos por mês.</b> Abaixo disso, a comissão é
            mais barata para você. Acima, a mensalidade. Se você atende menos de dois clientes por
            dia, o plano de comissão provavelmente é melhor — e a gente vai te dizer isso na
            conversa.
          </p>
          <p className="compare__fine">
            Nos dois planos, não cobramos por profissional, por serviço, por mensagem enviada, nem
            por cadastrar sua página. Taxa de cartão só existe se você optar por receber pelo app, e
            ela aparece separada no extrato.
          </p>
        </div>
      </div>
    </section>
  );
}
