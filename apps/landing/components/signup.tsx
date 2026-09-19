"use client";

import { useEffect, useRef, useState } from "react";

import { PORTAL_SIGNUP } from "./portal";
import { SITE } from "./site";

// Sem e-mail configurado, a mensagem não manda ninguém para um endereço que
// talvez não exista.
const RETRY_LATER = SITE.contactEmail
  ? `Não conseguimos enviar agora. Tente de novo em alguns instantes ou escreva para ${SITE.contactEmail}.`
  : "Não conseguimos enviar agora. Tente de novo em alguns instantes.";

const NEXT_STEPS = [
  "Alguém do time chama no seu WhatsApp em até um dia útil. Pessoa, não robô.",
  "Numa chamada de uns 30 minutos, cadastramos seus serviços, preços e horários junto com você.",
  "Sua página entra no ar e você começa a aparecer na busca no mesmo dia. A primeira cobrança é só 14 dias depois.",
];

/** Os mesmos rótulos do portal e do admin (`CATEGORY_LABEL`). */
const CATEGORIES = [
  ["barbershop", "Barbearia"],
  ["salon", "Salão de beleza"],
  ["aesthetic_clinic", "Clínica de estética"],
  ["dermatology", "Dermatologia"],
  ["petshop", "Pet shop"],
  ["nail_salon", "Manicure e unhas"],
  ["dentistry", "Odontologia"],
  ["massage", "Massagem"],
] as const;

type Category = (typeof CATEGORIES)[number][0];

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string }
  | { kind: "sent"; contact: string };

export function Signup() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const sending = status.kind === "sending";
  const doneRef = useRef<HTMLDivElement>(null);

  // O formulário some e o aviso de recebido nasce no lugar: sem mover o foco,
  // quem navega por teclado ou leitor de tela fica apontando para um botão que
  // não existe mais.
  useEffect(() => {
    if (status.kind === "sent") doneRef.current?.focus();
  }, [status.kind]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const contact = text("whatsapp");
    const category = text("category") as Category | "";
    const message = text("message");

    setStatus({ kind: "sending" });
    try {
      // O supabase-js só é baixado quando alguém envia de verdade. É a única
      // parte da landing que fala com o banco, e ela fica no fim da página:
      // carregá-lo no primeiro byte cobraria de todo visitante um cliente que
      // quase ninguém chega a usar.
      const { createBrowserSupabaseClient } = await import("@vez/supabase/browser");
      const { error } = await createBrowserSupabaseClient().rpc("submit_lead", {
        p_name: text("name"),
        p_establishment_name: text("establishment"),
        p_contact: contact,
        p_category: category === "" ? undefined : category,
        p_message: message === "" ? undefined : message,
      });

      if (error) {
        // `P0001` é a validação e o freio contra abuso da própria `submit_lead`:
        // o texto já é para o dono ler. Qualquer outro código é defeito nosso, e
        // devolver o erro cru do Postgres não ajudaria ninguém.
        throw new Error(error.code === "P0001" ? error.message : RETRY_LATER);
      }

      setStatus({ kind: "sent", contact });
    } catch (cause) {
      setStatus({
        kind: "error",
        message:
          cause instanceof Error && cause.message
            ? cause.message
            : "Não conseguimos enviar agora. Confira sua conexão e tente de novo.",
      });
    }
  }

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

          {status.kind === "sent" ? (
            // Sem `data-reveal`: o observador de `Reveal` só olha o que existia
            // quando a página montou, e este painel nasce depois do envio —
            // marcado, ele ficaria invisível.
            <div className="signup__form" role="status" ref={doneRef} tabIndex={-1}>
              <div className="signup__form-title">Recebemos seu contato.</div>
              <p className="signup__done">
                Alguém do time chama no WhatsApp <b className="mono">{status.contact}</b> em até um
                dia útil. Se preferir não esperar, você já pode criar sua conta e cadastrar a loja
                sozinho — a conversa continua valendo.
              </p>
              <a href={PORTAL_SIGNUP} className="btn btn--ghost btn--block">
                Cadastrar minha loja agora
              </a>
            </div>
          ) : (
            <form
              data-reveal
              className="signup__form"
              style={{ transitionDelay: "100ms" }}
              onSubmit={handleSubmit}
              aria-busy={sending}
              aria-describedby={status.kind === "error" ? "signup-error" : undefined}
            >
              <div className="signup__form-title">Cadastrar meu estabelecimento</div>
              <div className="mono signup__form-sub">3 campos obrigatórios · sem cartão agora</div>
              <div className="signup__fields">
                <label className="field">
                  <span>Seu nome</span>
                  <input
                    name="name"
                    placeholder="Como te chamam"
                    autoComplete="name"
                    maxLength={80}
                    disabled={sending}
                    required
                  />
                </label>
                <label className="field">
                  <span>Nome do estabelecimento</span>
                  <input
                    name="establishment"
                    placeholder="Ex.: Studio Bela Rua"
                    autoComplete="organization"
                    maxLength={120}
                    disabled={sending}
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
                    maxLength={40}
                    disabled={sending}
                    required
                  />
                </label>
                <label className="field">
                  <span>
                    Tipo de negócio <i className="field__optional">opcional</i>
                  </span>
                  <select name="category" defaultValue="" disabled={sending}>
                    <option value="">Conto na conversa</option>
                    {CATEGORIES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    Quer adiantar alguma coisa? <i className="field__optional">opcional</i>
                  </span>
                  <textarea
                    name="message"
                    rows={3}
                    maxLength={1000}
                    placeholder="Ex.: somos 3 profissionais e hoje a agenda é no caderno."
                    disabled={sending}
                  />
                </label>

                {status.kind === "error" && (
                  <p className="signup__error" role="alert" id="signup-error">
                    {status.message}
                  </p>
                )}

                <button type="submit" className="btn btn--primary btn--xl" disabled={sending}>
                  {sending ? "Enviando…" : "Enviar"}
                </button>
                <p className="signup__fine">
                  Enviando, você só entra na conversa. Nada é cobrado agora. Prefere fazer sozinho?{" "}
                  <a href={PORTAL_SIGNUP}>Cadastre sua loja no portal</a>.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
