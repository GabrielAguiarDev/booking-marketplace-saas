import { Footer, Header } from "./chrome";

/**
 * Casca das páginas de texto (termos, privacidade, app do cliente): o mesmo
 * cabeçalho e rodapé da home e uma coluna de leitura. Sem `Reveal` — texto
 * jurídico não precisa entrar deslizando.
 */
export function DocPage({
  eyebrow,
  title,
  lead,
  meta,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="page">
      <Header />
      <main id="conteudo" tabIndex={-1}>
        <article className="doc">
          <span className="doc__eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          {lead ? <p className="doc__lead">{lead}</p> : null}
          {meta ? <p className="doc__meta">{meta}</p> : null}
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}
