import { CalendarGrid } from "./calendar";
import { DAY_BLOCKS, DAY_HOURS, TEAM } from "./data";
import { SectionHead } from "./ui";

const QUEUE = [
  { pos: 1, name: "Marcos S.", meta: "corte · chegou 13:12", next: true },
  { pos: 2, name: "Priscila R.", meta: "sobrancelha · pelo app" },
  { pos: 3, name: "Sem cadastro", meta: "link enviado por WhatsApp" },
];

const RULES = [
  {
    title: "Exigir sinal para reservar",
    meta: "30% do valor · devolvido se cancelar até 24h",
    on: true,
  },
  { title: "Aprovar cada pedido na mão", meta: "para serviço longo ou cliente novo", on: false },
];

const SLOTS = ["14:20", "16:00", "17:30"];

const EARNINGS = [
  { name: "Rafa", value: "R$ 8.110", pct: 74, tone: "coral" },
  { name: "Dani", value: "R$ 6.020", pct: 55, tone: "ink" },
  { name: "Bru", value: "R$ 4.110", pct: 38, tone: "green" },
];

const PAYMENTS = ["maquininha", "pix na hora", "dinheiro", "pagamento no app (opcional)"];

export function Features() {
  return (
    <section id="recursos" className="band">
      <div className="wrap band__inner">
        <SectionHead
          eyebrow="03 — o que você recebe"
          title="O que já está pronto quando você entra."
          lead="Tudo abaixo está incluído nos dois planos. Nada é vendido por fora."
        />

        <div className="features">
          <Feature
            wide
            title="Agenda de toda a equipe numa tela"
            text="Arraste o atendimento para remarcar. Bloqueie a tarde do dentista com dois cliques. Quem trabalha só de sábado aparece só no sábado."
          >
            <div className="mock mock--flat">
              <div className="team-head">
                <div className="mono">hoje</div>
                {TEAM.map((pro) => (
                  <div key={pro.name}>{pro.name}</div>
                ))}
              </div>
              <CalendarGrid
                variant="day"
                hours={DAY_HOURS}
                columns={TEAM.length}
                blocks={DAY_BLOCKS}
              />
            </div>
          </Feature>

          <Feature
            delay
            title="Fila de espera digital"
            text="O cliente entra na fila e acompanha a posição pelo celular, em vez de esperar em pé perguntando “falta muito?”. Quem chegou sem o app entra pelo seu balcão e recebe o link por mensagem."
          >
            <div className="mock mock--flat">
              <div className="mock__bar">
                <span>Fila de hoje</span>
                <span className="mock__aside green">espera ~35 min</span>
              </div>
              {QUEUE.map((q) => (
                <div key={q.pos} className="queue-row">
                  <span className={q.next ? "mono queue-row__pos green" : "mono queue-row__pos"}>
                    {q.pos}
                  </span>
                  <div className="row__body">
                    <div className="queue-row__name">{q.name}</div>
                    <div className="mono queue-row__meta">{q.meta}</div>
                  </div>
                  {q.next && <span className="queue-row__call">chamar</span>}
                </div>
              ))}
              <div className="mono queue-more">+ 1 na fila</div>
            </div>
          </Feature>

          <Feature
            delay
            title="As regras são suas"
            text="Cada estabelecimento define como quer trabalhar. Você liga e desliga o que quiser, quando quiser."
          >
            <div className="mock mock--flat">
              {RULES.map((r) => (
                <div key={r.title} className="rule">
                  <div>
                    <div className="rule__title">{r.title}</div>
                    <div className="mono rule__meta">{r.meta}</div>
                  </div>
                  <span
                    className="toggle"
                    data-on={r.on ? "" : undefined}
                    role="img"
                    aria-label={r.on ? "ligado" : "desligado"}
                  />
                </div>
              ))}
              <div className="rule">
                <div>
                  <div className="rule__title">Prazo de cancelamento</div>
                  <div className="mono rule__meta">até 4 horas antes, sem custo</div>
                </div>
                <span className="mono rule__value">4h</span>
              </div>
            </div>
          </Feature>

          <Feature
            title="Sua página dentro do app"
            text="Com o seu nome, suas fotos e a cor da sua marca. O link serve de cartão: cabe na bio do Instagram e no adesivo da porta."
          >
            <div className="mock mock--flat">
              <div className="brand-page__cover" />
              <div className="brand-page__body">
                <div className="brand-page__mark">SB</div>
                <div className="brand-page__name">Studio Bela Rua</div>
                <div className="mono brand-page__url">vez.app/studiobelarua</div>
                <div className="brand-page__slots">
                  {SLOTS.map((slot) => (
                    <span key={slot} className="mono">
                      {slot}
                    </span>
                  ))}
                  <span className="mono" data-muted>
                    amanhã
                  </span>
                </div>
              </div>
            </div>
          </Feature>

          <Feature
            title="Financeiro sem planilha"
            text="Faturamento do mês, ticket médio e quanto cada profissional produziu. Serve para fechar comissão no fim do mês sem discussão."
          >
            <div className="mock mock--flat finance">
              <div className="finance__kpis">
                <div>
                  <div className="mono finance__label">faturamento set</div>
                  <div className="mono finance__value">R$ 18.240</div>
                </div>
                <div>
                  <div className="mono finance__label">ticket médio</div>
                  <div className="mono finance__value">R$ 62</div>
                </div>
              </div>
              <div className="finance__bars">
                {EARNINGS.map((e) => (
                  <div key={e.name}>
                    <div className="finance__row">
                      <span>{e.name}</span>
                      <span className="mono">{e.value}</span>
                    </div>
                    <div className="bar">
                      <div className={`tone-${e.tone}`} style={{ width: `${e.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Feature>

          <Feature
            title="Aplicativo para o balcão"
            text="O mesmo portal no celular ou no tablet, para quando você está de pé atendendo. Chega aviso de agendamento novo e de cancelamento."
          >
            <div className="counter">
              <div className="mono counter__label">agora</div>
              <div className="counter__now">Léo · Corte + barba</div>
              <div className="mono green counter__status">em atendimento · 14 min restantes</div>
              <div className="mono counter__label counter__label--next">a seguir</div>
              <div className="counter__next">
                Rita · Escova <span className="mono">15:00</span>
              </div>
              <div className="counter__btn">Finalizar atendimento</div>
            </div>
          </Feature>
        </div>

        <div data-reveal className="payments">
          <div className="payments__text">
            <h3>Receber pelo app é opcional</h3>
            <p>
              Se você prefere continuar recebendo na maquininha, no pix ou em dinheiro, continue. O
              Vez marca o horário e registra o valor; quem recebe é você, do jeito que já recebe
              hoje. Pagamento no app existe para quem quer cobrar sinal e reduzir falta.
            </p>
          </div>
          <ul className="mono payments__list">
            {PAYMENTS.map((p) => (
              <li key={p}>✓ {p}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Feature({
  title,
  text,
  wide,
  delay,
  children,
}: {
  title: string;
  text: string;
  wide?: boolean;
  delay?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-reveal
      className={wide ? "feature feature--wide" : "feature"}
      style={delay ? { transitionDelay: "60ms" } : undefined}
    >
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
