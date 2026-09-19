import Link from "next/link";

import { SITE } from "./site";

/** Data da versão em vigor dos Termos e da Privacidade. Mude junto com o texto. */
export const LEGAL_UPDATED_AT = "17 de setembro de 2026";

/**
 * Quem responde pelo serviço. Mostra só o que foi configurado; o que faltar é
 * dito como pendente, nunca preenchido com exemplo.
 */
export function CompanyCard() {
  const missing = !SITE.companyName || !SITE.companyCnpj;
  return (
    <div className={missing ? "doc__card doc__card--warn" : "doc__card"}>
      <dl>
        <dt>Razão social</dt>
        <dd>{SITE.companyName ?? "a publicar"}</dd>
        <dt>CNPJ</dt>
        <dd className="mono">{SITE.companyCnpj ?? "a publicar"}</dd>
        {SITE.companyAddress ? (
          <>
            <dt>Endereço</dt>
            <dd>{SITE.companyAddress}</dd>
          </>
        ) : null}
        <dt>Contato</dt>
        <dd>
          <ContactLinks />
        </dd>
      </dl>
      {missing ? (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          A identificação completa da empresa ainda não foi publicada nesta página. Até lá, fale com
          a gente pelos canais acima antes de contratar.
        </p>
      ) : null}
    </div>
  );
}

export function ContactLinks({ privacy = false }: { privacy?: boolean }) {
  const email = privacy ? SITE.privacyEmail : SITE.contactEmail;
  const parts: React.ReactNode[] = [];
  if (email) {
    parts.push(
      <a key="email" href={`mailto:${email}`} className="mono">
        {email}
      </a>,
    );
  }
  if (SITE.contactWhatsappUrl) {
    parts.push(
      <a key="wa" href={SITE.contactWhatsappUrl} rel="noopener" target="_blank">
        WhatsApp {SITE.contactWhatsappLabel}
        <span className="sr-only"> (abre em nova aba)</span>
      </a>,
    );
  }
  if (parts.length === 0) {
    return <Link href="/#cadastro">o formulário da página inicial</Link>;
  }
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? " ou " : null}
          {part}
        </span>
      ))}
    </>
  );
}
