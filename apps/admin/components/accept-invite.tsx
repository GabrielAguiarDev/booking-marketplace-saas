"use client";

/**
 * Chegada pelo link do convite da equipe.
 *
 * O e-mail de convite leva ao Auth, que confere o token e devolve a pessoa ao
 * painel com a sessão no fragmento da URL (`#access_token=…&type=invite`). O
 * cliente do navegador usa PKCE e não lê esse formato sozinho, então a sessão é
 * gravada aqui, à mão, e a pessoa define a senha antes de entrar — sem senha,
 * ela não conseguiria voltar quando a sessão expirasse.
 */

import { createBrowserSupabaseClient } from "@vez/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Landing = { step: "loading" } | { step: "password" } | { step: "error"; message: string };

/** Lê o fragmento uma vez. `null`: não é uma chegada por convite. */
export function useInviteLanding(): Landing | null {
  const [landing, setLanding] = useState<Landing | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const isInvite = hash.get("type") === "invite";
    const failed = hash.get("error_code") ?? hash.get("error");
    if (!isInvite && !failed) return;

    // Tira o token da barra de endereço: não fica no histórico nem é lido de novo.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    void (async () => {
      if (failed || !accessToken || !refreshToken) {
        setLanding({
          step: "error",
          message:
            failed === "otp_expired"
              ? "Este convite expirou ou já foi usado. Peça a quem convidou que envie de novo."
              : "Não foi possível aceitar o convite. Peça a quem convidou que envie de novo.",
        });
        return;
      }
      setLanding({ step: "loading" });
      const { error } = await createBrowserSupabaseClient().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      setLanding(
        error
          ? {
              step: "error",
              message: "O convite não abriu uma sessão válida. Peça que enviem de novo.",
            }
          : { step: "password" },
      );
    })();
  }, []);

  return landing;
}

export function AcceptInvite({ landing }: { landing: Landing }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const ready = password.length >= 8 && password === confirm;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="invite-accept-title">
        <div className="auth-brand" aria-hidden="true">
          V
        </div>
        <p className="auth-eyebrow">Vez · operação da plataforma</p>
        <h1 id="invite-accept-title">Bem-vindo à equipe</h1>

        {landing.step === "loading" ? <p className="auth-copy">Abrindo o convite…</p> : null}

        {landing.step === "error" ? (
          <>
            <p className="auth-error" role="alert">
              {landing.message}
            </p>
            <button className="primary" onClick={() => window.location.reload()} type="button">
              Ir para o login
            </button>
          </>
        ) : null}

        {landing.step === "password" ? (
          <>
            <p className="auth-copy">Defina a senha que você vai usar para entrar no painel.</p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!ready) return;
                setPending(true);
                setError("");
                const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({
                  password,
                });
                if (updateError) {
                  setError(
                    updateError.code === "weak_password"
                      ? "Senha fraca. Use ao menos 8 caracteres, misturando letras e números."
                      : "Não foi possível salvar a senha. Tente de novo.",
                  );
                  setPending(false);
                  return;
                }
                router.refresh();
              }}
            >
              <label>
                <span>Nova senha</span>
                <input
                  autoComplete="new-password"
                  autoFocus
                  id="invite-password"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </label>
              <label>
                <span>Repita a senha</span>
                <input
                  autoComplete="new-password"
                  id="invite-password-confirm"
                  onChange={(event) => setConfirm(event.target.value)}
                  type="password"
                  value={confirm}
                />
              </label>
              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : password.length > 0 && password.length < 8 ? (
                <p className="auth-copy">A senha precisa de ao menos 8 caracteres.</p>
              ) : confirm.length > 0 && password !== confirm ? (
                <p className="auth-copy">As duas senhas precisam ser iguais.</p>
              ) : null}
              <button className="primary" disabled={!ready || pending} type="submit">
                {pending ? "Salvando…" : "Salvar senha e entrar"}
              </button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}
