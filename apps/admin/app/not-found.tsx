import Link from "next/link";

import { VezSymbol } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section aria-labelledby="not-found-title" className="auth-card">
        <VezSymbol className="auth-brand" height={40} />
        <p className="auth-eyebrow">Erro 404</p>
        <h1 id="not-found-title">Esta página não existe</h1>
        <p className="auth-copy">O endereço pode ter mudado ou estar digitado errado.</p>
        <div className="auth-actions">
          <Link className="primary" href="/">
            Voltar para o painel
          </Link>
        </div>
      </section>
    </main>
  );
}
