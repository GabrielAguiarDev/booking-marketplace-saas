"use client";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogin({ deniedEmail }: { deniedEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(deniedEmail ?? "");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(
    deniedEmail
      ? "Esta conta não faz parte da equipe da plataforma. Entre com uma conta administrativa."
      : "",
  );

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand" aria-hidden="true">
          V
        </div>
        <p className="auth-eyebrow">Vez · operação da plataforma</p>
        <h1 id="auth-title">Acesso administrativo</h1>
        <p className="auth-copy">Entre com a conta cadastrada na equipe da plataforma.</p>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const supabase = createBrowserSupabaseClient();
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (signInError) {
              setError(
                signInError.message === "Invalid login credentials"
                  ? "E-mail ou senha inválidos."
                  : signInError.message,
              );
              setPending(false);
              return;
            }
            setPending(false);
            router.refresh();
          }}
        >
          <label>
            <span>E-mail</span>
            <input
              autoComplete="email"
              autoFocus
              id="admin-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Senha</span>
            <input
              autoComplete="current-password"
              id="admin-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="primary"
            disabled={pending || !email.trim() || !password}
            type="submit"
          >
            {pending ? "Entrando…" : "Entrar no painel"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      aria-label="Sair do painel"
      className="sign-out"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await createBrowserSupabaseClient().auth.signOut();
        router.refresh();
      }}
      title="Sair"
      type="button"
    >
      <svg
        fill="none"
        height="16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
        width="16"
      >
        <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      </svg>
    </button>
  );
}
