"use client";

import { createBrowserSupabaseClient } from "@vez/supabase/browser";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AcceptInvite, useInviteLanding } from "./accept-invite";

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
  const invite = useInviteLanding();

  if (invite) return <AcceptInvite landing={invite} />;

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

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

function friendlyMfaError(message: string): string {
  if (/invalid.*code|challenge.*expired|factor.*not found/i.test(message)) {
    return "Código inválido ou expirado. Confira o relógio do aparelho e tente novamente.";
  }
  return message;
}

/**
 * A decisão de exigir esta tela vem do Server Component. Aqui só executamos o
 * cadastro ou o desafio que promove a sessão para aal2; o banco segue sendo a
 * barreira definitiva para qualquer RPC administrativa.
 */
export function AdminMfaGate({
  email,
  needsEnrollment,
}: {
  email: string;
  needsEnrollment: boolean;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const prepare = async () => {
      const supabase = createBrowserSupabaseClient();
      if (needsEnrollment) {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        for (const factor of factors.all.filter(
          (item) =>
            item.factor_type === "totp" &&
            item.status === "unverified" &&
            item.friendly_name === "Vez Admin",
        )) {
          const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          if (removeError) throw removeError;
        }
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Vez Admin",
          issuer: "Vez",
        });
        if (enrollError) throw enrollError;
        const rawQr = data.totp.qr_code.startsWith("data:")
          ? data.totp.qr_code.slice(data.totp.qr_code.indexOf(",") + 1)
          : data.totp.qr_code;
        const qrCode = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawQr.trim())}`;
        setFactorId(data.id);
        setEnrollment({ factorId: data.id, qrCode, secret: data.totp.secret });
      } else {
        const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        const factor = data.totp[0];
        if (!factor) throw new Error("Nenhum autenticador TOTP verificado foi encontrado.");
        setFactorId(factor.id);
      }
    };

    void prepare()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? friendlyMfaError(cause.message) : "Falha ao preparar o segundo fator.");
      })
      .finally(() => setPending(false));
  }, [needsEnrollment]);

  return (
    <main className="auth-shell">
      <section className="auth-card auth-mfa-card" aria-labelledby="mfa-title">
        <div className="auth-brand" aria-hidden="true">
          V
        </div>
        <p className="auth-eyebrow">Vez · proteção administrativa</p>
        <h1 id="mfa-title">{needsEnrollment ? "Cadastre o segundo fator" : "Confirme o segundo fator"}</h1>
        <p className="auth-copy">
          {needsEnrollment
            ? "Escaneie o QR code no seu aplicativo autenticador e confirme o código de seis dígitos."
            : `Abra o autenticador vinculado a ${email} e informe o código atual.`}
        </p>

        {pending ? <p className="auth-copy">Preparando o autenticador…</p> : null}
        {enrollment ? (
          <>
            <div className="auth-mfa-qr">
              <Image
                alt="QR code para cadastrar o autenticador"
                height={176}
                src={enrollment.qrCode}
                unoptimized
                width={176}
              />
            </div>
            <p className="auth-copy">Se preferir, digite esta chave manualmente:</p>
            <code className="auth-mfa-secret">{enrollment.secret}</code>
          </>
        ) : null}

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const { error: verifyError } = await createBrowserSupabaseClient().auth.mfa.challengeAndVerify({
              factorId,
              code,
            });
            if (verifyError) {
              setError(friendlyMfaError(verifyError.message));
              setPending(false);
              return;
            }
            router.refresh();
          }}
        >
          <label>
            <span>Código de seis dígitos</span>
            <input
              autoComplete="one-time-code"
              autoFocus={!needsEnrollment}
              id="admin-totp"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              pattern="[0-9]{6}"
              placeholder="000000"
              value={code}
            />
          </label>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary" disabled={pending || !factorId || code.length !== 6} type="submit">
            {pending ? "Confirmando…" : needsEnrollment ? "Cadastrar e entrar" : "Confirmar e entrar"}
          </button>
        </form>
        <button
          className="auth-secondary"
          onClick={async () => {
            setPending(true);
            await createBrowserSupabaseClient().auth.signOut();
            router.refresh();
          }}
          type="button"
        >
          Sair e usar outra conta
        </button>
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
