"use client";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AuthMode =
  | "login"
  | "signup"
  | "forgot"
  | "verify-signup"
  | "verify-recovery"
  | "update-password";

function friendlyAuthError(message: string): string {
  if (message === "Invalid login credentials") return "E-mail ou senha inválidos.";
  if (/already registered/i.test(message)) return "Este e-mail já tem uma conta. Entre com a senha.";
  if (/password/i.test(message) && /least/i.test(message)) return "A senha precisa ter ao menos 8 caracteres.";
  return message;
}

export function PortalAuth({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update-password");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const title =
    mode === "signup"
      ? "Crie sua conta de dono"
      : mode === "forgot"
        ? "Recupere sua senha"
        : mode === "verify-signup"
          ? "Confirme sua conta"
          : mode === "verify-recovery"
            ? "Confirme o código"
        : mode === "update-password"
          ? "Defina uma nova senha"
          : "Entre no portal";

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand" aria-hidden="true">V</div>
        <p className="auth-eyebrow">Vez · portal do estabelecimento</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-copy">
          {mode === "signup"
            ? "Depois da conta, você cadastra a loja para análise da equipe do Vez."
            : mode === "forgot"
              ? "Enviaremos um código para você escolher outra senha."
              : mode === "verify-signup" || mode === "verify-recovery"
                ? `Digite o código de seis dígitos enviado para ${email}.`
              : mode === "update-password"
                ? "Use ao menos 8 caracteres."
                : "Use o e-mail e a senha cadastrados no Vez."}
        </p>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            setNotice("");
            const supabase = createBrowserSupabaseClient();
            try {
              if (mode === "forgot") {
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(
                  email.trim(),
                  { redirectTo: `${window.location.origin}/?mode=recovery` },
                );
                if (resetError) throw resetError;
                setMode("verify-recovery");
                setNotice("Confira sua caixa de entrada. O código já foi enviado.");
              } else if (mode === "verify-signup" || mode === "verify-recovery") {
                const { error: verifyError } = await supabase.auth.verifyOtp({
                  email: email.trim(),
                  token: code,
                  type: mode === "verify-signup" ? "signup" : "recovery",
                });
                if (verifyError) throw verifyError;
                if (mode === "verify-recovery") setMode("update-password");
                else router.refresh();
              } else if (mode === "update-password") {
                const { error: updateError } = await supabase.auth.updateUser({ password });
                if (updateError) throw updateError;
                window.history.replaceState(null, "", "/");
                setNotice("Senha atualizada. Entrando no portal…");
                router.refresh();
              } else if (mode === "signup") {
                const { data, error: signupError } = await supabase.auth.signUp({
                  email: email.trim(),
                  password,
                  options: { data: { full_name: name.trim() } },
                });
                if (signupError) throw signupError;
                if (data.session) router.refresh();
                else {
                  setMode("verify-signup");
                  setNotice("Conta criada. Digite o código enviado por e-mail.");
                }
              } else {
                const { error: loginError } = await supabase.auth.signInWithPassword({
                  email: email.trim(),
                  password,
                });
                if (loginError) throw loginError;
                router.refresh();
              }
            } catch (cause) {
              setError(
                friendlyAuthError(cause instanceof Error ? cause.message : "Não foi possível continuar."),
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {mode === "signup" ? (
            <label>
              <span>Seu nome</span>
              <input
                autoComplete="name"
                autoFocus
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
          ) : null}
          {mode !== "update-password" ? (
            <label>
              <span>E-mail</span>
              <input
                autoComplete="email"
                autoFocus={mode !== "signup"}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
          ) : null}
          {mode !== "forgot" && mode !== "verify-signup" && mode !== "verify-recovery" ? (
            <label>
              <span>{mode === "update-password" ? "Nova senha" : "Senha"}</span>
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
          ) : null}
          {mode === "verify-signup" || mode === "verify-recovery" ? (
            <label>
              <span>Código de seis dígitos</span>
              <input
                autoComplete="one-time-code"
                autoFocus
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                pattern="[0-9]{6}"
                required
                value={code}
              />
            </label>
          ) : null}
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
          <button className="primary auth-submit" disabled={pending} type="submit">
            {pending
              ? "Aguarde…"
              : mode === "signup"
                ? "Criar conta"
                : mode === "forgot"
                  ? "Enviar código"
                  : mode === "verify-signup" || mode === "verify-recovery"
                    ? "Confirmar código"
                  : mode === "update-password"
                    ? "Salvar nova senha"
                    : "Entrar"}
          </button>
        </form>

        <div className="auth-links">
          {mode === "login" ? (
            <>
              <button onClick={() => setMode("forgot")} type="button">Esqueci minha senha</button>
              <button onClick={() => setMode("signup")} type="button">Cadastrar minha loja</button>
              <button onClick={() => setMode("verify-signup")} type="button">Já tenho um código</button>
            </>
          ) : mode !== "update-password" ? (
            <button onClick={() => setMode("login")} type="button">Voltar para o login</button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      className="ghost"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await createBrowserSupabaseClient().auth.signOut();
        router.refresh();
      }}
      type="button"
    >
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
