"use client";

import { useEffect } from "react";

import { VezSymbol } from "@/components/brand";

/** Falha ao carregar o painel: explica em português e oferece tentar de novo. */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Falha ao carregar o painel administrativo", error);
  }, [error]);

  return (
    <main className="auth-shell">
      <section aria-labelledby="error-title" className="auth-card">
        <VezSymbol className="auth-brand" height={40} />
        <p className="auth-eyebrow">Vez · operação da plataforma</p>
        <h1 id="error-title">Não foi possível carregar o painel</h1>
        <p className="auth-copy">
          Nenhuma alteração foi feita. Confira a conexão e tente de novo; se continuar, avise quem
          cuida da infraestrutura.
        </p>
        {error.digest ? (
          <p className="auth-copy">
            Código do erro: <code>{error.digest}</code>
          </p>
        ) : null}
        <div className="auth-actions">
          <button className="primary" onClick={() => retry()} type="button">
            Tentar de novo
          </button>
        </div>
      </section>
    </main>
  );
}
