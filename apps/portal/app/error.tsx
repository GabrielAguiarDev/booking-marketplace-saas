"use client";

import { useEffect } from "react";

import { VezSymbol } from "@/components/brand";

/** Falha ao carregar o portal: explica em português e oferece tentar de novo. */
export default function PortalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Falha ao carregar o portal", error);
  }, [error]);

  return (
    <main className="auth-shell">
      <section aria-labelledby="error-title" className="auth-card">
        <VezSymbol className="auth-brand" height={40} />
        <p className="auth-eyebrow">Vez · portal do estabelecimento</p>
        <h1 id="error-title">Não foi possível carregar o portal</h1>
        <p className="auth-copy">
          Seus dados não foram alterados. Confira a conexão e tente de novo; se continuar, fale com
          o suporte do Vez.
        </p>
        {error.digest ? (
          <p className="auth-copy">
            Código para o suporte: <code>{error.digest}</code>
          </p>
        ) : null}
        <div className="auth-actions">
          <button className="primary auth-submit" onClick={() => retry()} type="button">
            Tentar de novo
          </button>
        </div>
      </section>
    </main>
  );
}
