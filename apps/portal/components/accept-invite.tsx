"use client";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Step = "loading" | "password" | "accept" | "error";

/** Aceita o fragmento devolvido pelo Auth e garante uma senha para o próximo acesso. */
export function AcceptEstablishmentInvite() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [message, setMessage] = useState("Abrindo o convite…");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const failure = hash.get("error_code") ?? hash.get("error");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      window.history.replaceState(null, "", window.location.pathname);

      const client = createBrowserSupabaseClient();
      if (!accessToken || !refreshToken) {
        const { data } = await client.auth.getSession();
        if (data.session) {
          setStep("accept");
          setMessage("Confirme para entrar na equipe que enviou o convite.");
          return;
        }
      }
      if (failure || hash.get("type") !== "invite" || !accessToken || !refreshToken) {
        setStep("error");
        setMessage(
          failure === "otp_expired"
            ? "Este convite expirou ou já foi usado. Peça ao dono da loja para reenviar."
            : "Este link não contém um convite válido. Peça ao dono da loja para reenviar.",
        );
        return;
      }

      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        setStep("error");
        setMessage("Não foi possível abrir a sessão do convite. Peça um novo envio.");
      } else {
        setStep("password");
        setMessage("Defina a senha que você usará no portal e no app da loja.");
      }
    })();
  }, []);

  const ready = password.length >= 8 && password === confirm;
  async function acceptInvites() {
    const { error } = await createBrowserSupabaseClient().rpc("establishment_accept_invites");
    if (error) {
      setMessage(
        error.hint === "not_found"
          ? "Este convite já foi aceito, revogado ou não pertence a esta conta."
          : "Não foi possível aceitar o convite. Tente de novo.",
      );
      setStep("error");
      setPending(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="invite-title">
        <div className="auth-brand" aria-hidden="true">
          V
        </div>
        <p className="auth-eyebrow">Vez · portal do estabelecimento</p>
        <h1 id="invite-title">Bem-vindo à equipe</h1>
        <p className={step === "error" ? "auth-error" : "auth-copy"}>{message}</p>

        {step === "password" ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!ready) return;
              setPending(true);
              const { error } = await createBrowserSupabaseClient().auth.updateUser({ password });
              if (error) {
                setMessage(
                  error.code === "weak_password"
                    ? "Senha fraca. Use ao menos 8 caracteres, misturando letras e números."
                    : "Não foi possível salvar a senha. Tente de novo.",
                );
                setPending(false);
                return;
              }
              await acceptInvites();
            }}
          >
            <label>
              <span>Nova senha</span>
              <input
                autoComplete="new-password"
                autoFocus
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <label>
              <span>Repita a senha</span>
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setConfirm(event.target.value)}
                type="password"
                value={confirm}
              />
            </label>
            {confirm && password !== confirm ? (
              <p className="auth-error">As duas senhas precisam ser iguais.</p>
            ) : null}
            <button className="primary auth-submit" disabled={!ready || pending} type="submit">
              {pending ? "Salvando…" : "Salvar senha e entrar"}
            </button>
          </form>
        ) : null}

        {step === "accept" ? (
          <button
            className="primary auth-submit"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await acceptInvites();
            }}
            type="button"
          >
            {pending ? "Aceitando…" : "Aceitar convite"}
          </button>
        ) : null}

        {step === "error" ? (
          <button className="primary auth-submit" onClick={() => router.replace("/")} type="button">
            Ir para o login
          </button>
        ) : null}
      </section>
    </main>
  );
}
