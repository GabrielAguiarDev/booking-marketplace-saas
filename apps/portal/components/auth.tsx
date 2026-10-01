"use client";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { VezSymbol } from "./brand";

type AuthMode =
  "login" | "signup" | "forgot" | "verify-signup" | "verify-recovery" | "update-password";

/**
 * O Auth responde em inglês. O código do erro é estável entre versões; o texto
 * fica como segunda tentativa. O que não for reconhecido vira uma frase genérica
 * em vez de vazar a mensagem crua.
 */
function friendlyAuthError(cause: unknown): string {
  const code =
    typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  const message = cause instanceof Error ? cause.message : "";
  if (code === "invalid_credentials" || message === "Invalid login credentials") {
    return "E-mail ou senha inválidos.";
  }
  if (code === "email_not_confirmed") {
    return "Este e-mail ainda não foi confirmado. Use “Já tenho um código” para confirmar.";
  }
  if (code === "user_already_exists" || /already registered/i.test(message)) {
    return "Este e-mail já tem uma conta. Entre com a senha.";
  }
  if (code === "weak_password" || (/password/i.test(message) && /least/i.test(message))) {
    return "A senha precisa ter ao menos 8 caracteres.";
  }
  if (code === "same_password") return "A nova senha precisa ser diferente da atual.";
  if (code === "otp_expired" || /token has expired|invalid.*token/i.test(message)) {
    return "Código inválido ou expirado. Peça um novo código e tente de novo.";
  }
  if (code.startsWith("over_") || /rate limit/i.test(message)) {
    return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return "Confira o e-mail informado.";
  }
  if (/fetch|network/i.test(message)) {
    return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  }
  return "Não foi possível continuar. Tente de novo em instantes.";
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
  const [showPassword, setShowPassword] = useState(false);
  // Trocar de tela limpa o erro da tela anterior.
  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

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
        <VezSymbol className="auth-brand" height={40} />
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
              setError(friendlyAuthError(cause));
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
              <span className="password-field">
                <input
                  aria-describedby={mode === "signup" ? "auth-password-hint" : undefined}
                  aria-label={mode === "update-password" ? "Nova senha" : "Senha"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  autoFocus={mode === "update-password"}
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </span>
              {mode === "signup" ? (
                <small id="auth-password-hint">Ao menos 8 caracteres.</small>
              ) : null}
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
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          ) : null}
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
              <button onClick={() => switchMode("forgot")} type="button">
                Esqueci minha senha
              </button>
              <button onClick={() => switchMode("signup")} type="button">
                Cadastrar minha loja
              </button>
              <button onClick={() => switchMode("verify-signup")} type="button">
                Já tenho um código
              </button>
            </>
          ) : mode === "verify-signup" || mode === "verify-recovery" ? (
            <>
              <button
                disabled={pending || !email.trim()}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  setNotice("");
                  const supabase = createBrowserSupabaseClient();
                  const { error: resendError } =
                    mode === "verify-signup"
                      ? await supabase.auth.resend({ type: "signup", email: email.trim() })
                      : await supabase.auth.resetPasswordForEmail(email.trim());
                  if (resendError) setError(friendlyAuthError(resendError));
                  else setNotice("Enviamos um novo código. Confira também a caixa de spam.");
                  setPending(false);
                }}
                type="button"
              >
                Reenviar código
              </button>
              <button onClick={() => switchMode("login")} type="button">
                Voltar para o login
              </button>
            </>
          ) : mode !== "update-password" ? (
            <button onClick={() => switchMode("login")} type="button">
              Voltar para o login
            </button>
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
        // Mesmo sem rede a sessão local é encerrada; o refresh mostra o login.
        await createBrowserSupabaseClient()
          .auth.signOut()
          .catch(() => undefined);
        router.refresh();
        setPending(false);
      }}
      type="button"
    >
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
