import Link from "next/link";

import { VezLogo } from "./brand";
import { PORTAL_LOGIN, PORTAL_SIGNUP } from "./portal";
import { ROUTES, SITE } from "./site";

// Âncoras a partir da raiz: o mesmo cabeçalho serve às páginas de Termos,
// Privacidade e do app do cliente, onde `#planos` sozinho não levaria a lugar
// nenhum. Na home, `/#planos` continua sendo só rolagem.
const NAV = [
  { href: "/#problema", label: "O problema" },
  { href: "/#funciona", label: "Como funciona" },
  { href: "/#recursos", label: "Recursos" },
  { href: "/#planos", label: "Planos" },
  { href: "/#duvidas", label: "Dúvidas" },
];

export function Logo({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <span className={`logo logo--${size}`}>
      <VezLogo height={size === "sm" ? 24 : 26} title="Vez" />
    </span>
  );
}

export function Header() {
  return (
    <header className="header">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className="header__inner">
        <Link href="/#topo" className="header__logo" aria-label="Vez, página inicial">
          <Logo />
        </Link>
        <nav className="header__nav" aria-label="Seções da página">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        {/* Quem já é cliente entra no portal; quem quer fazer sozinho cria a
            conta lá e cai no cadastro da loja. O formulário desta página é o
            outro caminho: falar com alguém antes. */}
        <div className="header__actions">
          <a href={PORTAL_LOGIN} className="header__login">
            Entrar
          </a>
          <a href={PORTAL_SIGNUP} className="btn btn--primary btn--sm">
            Cadastrar minha loja
          </a>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const company = SITE.companyName ?? "Vez";
  return (
    <footer className="footer">
      <div className="footer__grid">
        <div>
          <Logo size="sm" />
          <p className="footer__about">
            Agendamento para barbearias, salões, clínicas de estética e petshops.
          </p>
        </div>
        <FooterColumn title="Para o estabelecimento">
          <a href={PORTAL_SIGNUP}>Cadastrar minha loja</a>
          <a href={PORTAL_LOGIN}>Entrar no portal</a>
          <Link href={ROUTES.signupForm}>Falar com a gente antes</Link>
          <Link href={ROUTES.plans}>Planos</Link>
          <Link href={ROUTES.faq}>Dúvidas frequentes</Link>
        </FooterColumn>
        <FooterColumn title="Para o cliente">
          <Link href={ROUTES.customerDownload}>Baixar o app do Vez</Link>
          <Link href={ROUTES.customerBooking}>Como agendar</Link>
          <Link href={ROUTES.customerQueue}>Fila de espera</Link>
        </FooterColumn>
        <FooterColumn title="Contato e legal">
          {/* Só o canal que existe de verdade. Sem e-mail configurado, o
              caminho de contato é o formulário da própria página. */}
          {SITE.contactEmail ? (
            <a href={`mailto:${SITE.contactEmail}`} className="mono">
              {SITE.contactEmail}
            </a>
          ) : null}
          {SITE.contactWhatsappUrl ? (
            <a href={SITE.contactWhatsappUrl} className="mono" rel="noopener" target="_blank">
              WhatsApp {SITE.contactWhatsappLabel}
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          ) : null}
          {!SITE.contactEmail && !SITE.contactWhatsappUrl ? (
            <Link href={ROUTES.signupForm}>Fale com a gente</Link>
          ) : null}
          <Link href={ROUTES.terms}>Termos de uso</Link>
          <Link href={ROUTES.privacy}>Privacidade</Link>
        </FooterColumn>
      </div>
      <p className="footer__legal">
        © {new Date().getFullYear()} {company}
        {SITE.companyCnpj ? ` · CNPJ ${SITE.companyCnpj}` : null}
        {SITE.companyAddress ? ` · ${SITE.companyAddress}` : null}
      </p>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav className="footer__col" aria-label={title}>
      <span>{title}</span>
      {children}
    </nav>
  );
}
