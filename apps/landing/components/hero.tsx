import { CalendarGrid } from "./calendar";
import { TEAM, WEEK_BLOCKS, WEEK_DAYS, WEEK_HOURS } from "./data";

export function Hero() {
  return (
    <section id="topo" className="wrap hero">
      <div className="hero__grid">
        <div data-reveal>
          <h1 className="hero__title">Horário vazio não volta atrás.</h1>
          <p className="hero__lead">
            O Vez põe a agenda do seu estabelecimento na frente de quem está procurando serviço por
            perto, hoje. O cliente vê o horário livre e marca sozinho, sem você parar o atendimento
            para responder mensagem.
          </p>

          <div className="hero__ctas">
            <a href="#cadastro" className="btn btn--primary btn--lg">
              Cadastrar meu estabelecimento
            </a>
            <a href="#funciona" className="link-underline">
              Ver como funciona
            </a>
          </div>
          <p className="hero__fine">
            Sem contrato de fidelidade. Sem taxa de instalação. Você continua recebendo do jeito que
            já recebe.
          </p>
        </div>

        <div data-reveal className="hero__shot">
          <WeekAgenda />
          <p className="caption">tela real do portal · agenda semanal com equipe</p>
        </div>
      </div>
    </section>
  );
}

function WeekAgenda() {
  return (
    <div className="week">
      <div className="week__bar">
        <div>
          <b className="week__mark">v</b>
          <strong>Agenda da semana</strong>
          <span className="mono">14–19 set</span>
        </div>
        <div className="week__tabs">
          <span data-active>Semana</span>
          <span>Dia</span>
        </div>
      </div>
      <div className="week__legend">
        {TEAM.map((pro) => (
          <span key={pro.name}>
            <i className={`swatch tone-${pro.tone}`} />
            {pro.name}
          </span>
        ))}
        <span className="week__legend-blocked">
          <i className="swatch tone-blocked" />
          bloqueado
        </span>
      </div>
      <div className="week__days">
        <div />
        {WEEK_DAYS.map((day, i) => (
          <div key={day} data-today={i === WEEK_DAYS.length - 1 ? "" : undefined}>
            {day}
          </div>
        ))}
      </div>
      <CalendarGrid
        variant="week"
        hours={WEEK_HOURS}
        columns={WEEK_DAYS.length}
        blocks={WEEK_BLOCKS}
      />
      <div className="week__foot mono">
        <span>
          ocupação da semana <b>78%</b>
        </span>
        <span>4 horários livres hoje</span>
        <span className="green">2 confirmados agora</span>
      </div>
    </div>
  );
}
