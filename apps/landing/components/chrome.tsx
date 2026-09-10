const NAV = [
  { href: "#problema", label: "O problema" },
  { href: "#funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
  { href: "#duvidas", label: "Dúvidas" },
];

export function Logo({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <span className={`logo logo--${size}`}>
      <b>v</b>
      <strong>Vez</strong>
    </span>
  );
}

export function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <a href="#topo" className="header__logo" aria-label="Vez, voltar ao topo">
          <Logo />
        </a>
        <nav className="header__nav">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header__actions">
          <a href="#entrar" className="header__login">
            Entrar
          </a>
          <a href="#cadastro" className="btn btn--primary btn--sm">
            Cadastrar
          </a>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__grid">
        <div>
          <Logo size="sm" />
          <p className="footer__about">
            Agendamento para barbearias, salões, clínicas de estética e petshops.
          </p>
          <p className="footer__note">nome provisório</p>
        </div>
        <FooterColumn title="Para o estabelecimento">
          <a href="#cadastro">Cadastrar estabelecimento</a>
          <a href="#entrar">Entrar no portal</a>
          <a href="#planos">Planos</a>
          <a href="#duvidas">Dúvidas frequentes</a>
        </FooterColumn>
        <FooterColumn title="Para o cliente">
          <a href="#app" id="app">
            Baixar o app do Vez
          </a>
          <a href="#app">Como agendar</a>
          <a href="#app">Fila de espera</a>
        </FooterColumn>
        <FooterColumn title="Contato e legal">
          <a href="mailto:ola@vez.app" className="mono">
            ola@vez.app
          </a>
          <a href="#termos">Termos de uso</a>
          <a href="#privacidade">Privacidade</a>
        </FooterColumn>
      </div>
      <div className="footer__legal">© 2026 Vez Tecnologia · CNPJ 00.000.000/0001-00</div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="footer__col">
      <span>{title}</span>
      {children}
    </div>
  );
}
