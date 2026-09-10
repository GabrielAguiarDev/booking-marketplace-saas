"use client";

const NEXT_STEPS = [
  "Alguém do time chama no seu WhatsApp em até um dia útil. Pessoa, não robô.",
  "Numa chamada de uns 30 minutos, cadastramos seus serviços, preços e horários junto com você.",
  "Sua página entra no ar e você começa a aparecer na busca no mesmo dia. A primeira cobrança é só 14 dias depois.",
];

export function Signup() {
  return (
    <section id="cadastro" className="signup">
      <div className="wrap signup__inner">
        <div className="signup__grid">
          <div data-reveal>
            <h2 className="signup__title">Coloque sua agenda no Vez.</h2>
            <p className="signup__lead">
              Sem contrato de fidelidade e sem taxa de instalação. O plano você escolhe na conversa,
              com as contas feitas para o seu movimento.
            </p>
            <div className="signup__next">
              <div className="mono">o que acontece depois de enviar</div>
              {NEXT_STEPS.map((step, i) => (
                <div key={step} className="signup__step">
                  <span className="mono">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ainda não há para onde enviar: não existe tabela de interessados nem
              a Edge Function de cadastro (ver docs/funcionalidades.md). */}
          <form
            data-reveal
            className="signup__form"
            style={{ transitionDelay: "100ms" }}
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="signup__form-title">Cadastrar meu estabelecimento</div>
            <div className="mono signup__form-sub">3 campos · sem cartão agora</div>
            <div className="signup__fields">
              <label className="field">
                <span>Seu nome</span>
                <input name="name" placeholder="Como te chamam" autoComplete="name" required />
              </label>
              <label className="field">
                <span>Nome do estabelecimento</span>
                <input
                  name="establishment"
                  placeholder="Ex.: Studio Bela Rua"
                  autoComplete="organization"
                  required
                />
              </label>
              <label className="field">
                <span>WhatsApp</span>
                <input
                  name="whatsapp"
                  className="mono"
                  type="tel"
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  autoComplete="tel-national"
                  required
                />
              </label>
              <button type="submit" className="btn btn--primary btn--xl">
                Enviar
              </button>
              <p className="signup__fine">
                Enviando, você só entra na conversa. Nada é cobrado agora.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
