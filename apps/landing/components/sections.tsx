import { PROBLEMS } from "./data";
import { Check, Mock, SectionHead } from "./ui";

export function Problem() {
  return (
    <section id="problema" className="band band--problem">
      <div className="wrap band__inner">
        <SectionHead
          eyebrow="01 — o problema"
          title="Você já perdeu dinheiro em pelo menos uma dessas."
        />
        <div data-reveal className="problems">
          {PROBLEMS.map((p) => (
            <div key={p.tag} className="problem">
              <span className="mono">{p.tag}</span>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
        <p data-reveal className="problems__close">
          Nada disso se resolve com mais esforço seu. Se resolve com o cliente conseguindo ver seu
          horário livre e marcar sozinho, e com a cadeira vazia sendo oferecida a quem está na fila.
        </p>
      </div>
    </section>
  );
}

// ── como funciona ────────────────────────────────────────────────

const SERVICES = [
  { name: "Corte masculino", meta: "40 min · Rafa, Dani", price: "R$ 55" },
  { name: "Corte + barba", meta: "1h 10 · Rafa", price: "R$ 85" },
  { name: "Manicure e pedicure", meta: "1h 30 · Bru", price: "R$ 70" },
];

const RESULTS = [
  {
    name: "Studio Bela Rua",
    meta: "1,2 km · 4,8 · R$ 55",
    status: ["livre 14:20", "livre 16:00"],
    tone: "green",
  },
  {
    name: "Barbearia do Tico",
    meta: "2,0 km · 4,6 · R$ 45",
    status: ["fila de 3", "~35 min"],
    tone: "amber",
  },
  { name: "Salão Vitória", meta: "2,4 km · 4,9 · R$ 60", status: ["só amanhã"], tone: "faint" },
];

const UPDATES = [
  { title: "Léo marcou Corte + barba", meta: "sáb 09:00 · Rafa · pago no app", tone: "green" },
  { title: "Tati remarcou Manicure", meta: "de qua 10:00 para qui 11:00", tone: "green" },
  {
    title: "Ivo cancelou · vaga oferecida à fila",
    meta: "sex 14:00 · 3 pessoas avisadas",
    tone: "amber",
  },
  {
    title: "Vaga preenchida por Jonas",
    meta: "4 minutos depois do cancelamento",
    tone: "green",
    good: true,
  },
];

export function Steps() {
  return (
    <section id="funciona" className="wrap steps">
      <SectionHead
        eyebrow="02 — como funciona"
        title="Três passos, e você não volta ao caderno."
        lead="Do seu lado, não do lado do cliente. É isso que você faz na primeira semana."
      />

      <div className="steps__list">
        <div data-reveal className="step">
          <div>
            <span className="step__n">passo 01</span>
            <h3>Cadastre serviços, preços e horários de atendimento</h3>
            <p>
              Leva cerca de vinte minutos e você faz uma vez. Cada serviço tem duração e preço, cada
              profissional tem seu horário. Se a terça abre mais tarde, é só dizer.
            </p>
            <Check>nossa equipe cadastra junto com você, por chamada, se preferir</Check>
          </div>
          <Mock raised title="Serviços · Studio Bela Rua">
            <div className="rows">
              {SERVICES.map((s) => (
                <div key={s.name} className="row row--split">
                  <div>
                    <div className="row__title">{s.name}</div>
                    <div className="row__meta">{s.meta}</div>
                  </div>
                  <div className="mono row__price">{s.price}</div>
                </div>
              ))}
              <div className="row row--split">
                <div className="row__title row__title--faint">+ adicionar serviço</div>
                <div className="add">+</div>
              </div>
            </div>
          </Mock>
        </div>

        <div data-reveal className="step step--flip">
          <div>
            <span className="step__n">passo 02</span>
            <h3>Apareça para quem está buscando por perto</h3>
            <p>
              Quem abre o Vez vê os estabelecimentos perto dele, com os horários que ainda estão
              livres hoje. Não é anúncio: é sua agenda de verdade, atualizada no minuto.
            </p>
            <p className="mono step__aside">quem tem horário livre agora aparece primeiro</p>
          </div>
          <Mock
            raised
            title="Buscar perto de você"
            aside={<span className="mock__aside">hoje · 13:40</span>}
          >
            <div className="search">
              <div>corte de cabelo</div>
            </div>
            <div className="rows">
              {RESULTS.map((r) => (
                <div
                  key={r.name}
                  className="row row--result"
                  data-dim={r.tone === "faint" ? "" : undefined}
                >
                  <div className="thumb" />
                  <div className="row__body">
                    <div className="row__title row__title--bold">{r.name}</div>
                    <div className="row__meta">{r.meta}</div>
                  </div>
                  <div className={`mono row__status ${r.tone}`}>
                    {r.status.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Mock>
        </div>

        <div data-reveal className="step">
          <div>
            <span className="step__n">passo 03</span>
            <h3>O agendamento cai direto na sua agenda</h3>
            <p>
              Você não digita nada. O horário some da busca no mesmo instante, o cliente recebe a
              confirmação e um lembrete no dia. Se ele desmarcar, quem está na fila é chamado.
            </p>
            <Check>nada de digitar de novo o que o cliente já digitou</Check>
          </div>
          <Mock raised title="Novidades de hoje">
            <div className="rows">
              {UPDATES.map((u) => (
                <div key={u.title} className="row row--update">
                  <i className={`dot ${u.tone}`} />
                  <div>
                    <div className="row__title">{u.title}</div>
                    <div className={u.good ? "row__meta green" : "row__meta"}>{u.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </Mock>
        </div>
      </div>
    </section>
  );
}

// ── do outro lado ────────────────────────────────────────────────

const CATEGORIES = ["Cabelo", "Unha", "Barba", "Estética", "Pet"];

export function Customer() {
  return (
    <section id="cliente" className="wrap customer">
      <div data-reveal className="customer__grid">
        <div>
          <span className="eyebrow">04 — do outro lado</span>
          <h2 className="customer__title">De onde vem o movimento</h2>
          <p className="customer__lead">
            O cliente abre o app, diz o que precisa e vê quem tem horário hoje perto dele. Escolhe a
            hora, confirma, e recebe lembrete. Se não tem horário, ele entra na fila e é avisado
            quando abrir.
          </p>
          <p className="customer__sub">
            Ele não precisa ligar, nem esperar resposta, nem saber se você está no meio de um
            atendimento.
          </p>
          <a href="#app" className="link-muted">
            Sou cliente, quero baixar o app →
          </a>
        </div>

        <div className="phones">
          <div className="phone">
            <div className="phone__pad">
              <div className="mono phone__kicker">perto de você · hoje</div>
              <div className="phone__title">Do que você precisa?</div>
              <div className="chips">
                {CATEGORIES.map((c, i) => (
                  <span key={c} data-active={i === 0 ? "" : undefined}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
            {RESULTS.map((r) => (
              <div
                key={r.name}
                className="phone__row"
                data-dim={r.tone === "faint" ? "" : undefined}
              >
                <div className="thumb thumb--sm" />
                <div className="row__body">
                  <div className="phone__name">{r.name}</div>
                  <div className={`mono phone__status ${r.tone}`}>{r.status[0]}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="phone">
            <div className="phone__pad phone__pad--confirm">
              <div className="confirm-icon">✓</div>
              <div className="phone__title phone__title--confirm">Horário confirmado</div>
              <div className="mono phone__details">
                sáb 20 set · 09:00
                <br />
                Corte + barba · Rafa
                <br />
                R$ 85 · pagar no local
              </div>
              <div className="phone__place">
                Studio Bela Rua
                <br />
                Rua Amélia, 214 · 1,2 km
              </div>
              <div className="mono phone__reminder">lembrete 1h antes no celular</div>
            </div>
            <div className="phone__queue">
              <div className="mono">na fila em outro lugar</div>
              <div>
                <strong className="mono">2º</strong>
                <span>de 4 · ~20 min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
