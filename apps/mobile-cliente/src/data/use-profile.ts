import { useCallback, useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";
import { useSession } from "../auth/session";

export type Profile = {
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

/** O resultado carrega de quem ele é, para nunca ser lido como de outro usuário. */
type Result = { userId: string; profile: Profile | null; error: boolean };

/**
 * Lê a linha do usuário em `public.profiles`.
 *
 * A linha é criada pelo gatilho `handle_new_user()` no momento do cadastro, e a
 * RLS (`profiles_select_own`) só deixa cada um ver a própria. Não existe caminho
 * em que um usuário autenticado não tenha perfil — se vier vazio é erro, não
 * estado normal, e a tela precisa dizer isso.
 *
 * "Deslogado" é derivado, não guardado: gravar esse estado exigiria `setState`
 * dentro do efeito, e o resultado da busca anterior poderia vazar para a conta
 * seguinte na troca de usuário.
 */
export function useProfile() {
  const { user, loading: sessionLoading } = useSession();
  const userId = user?.id ?? null;

  const [result, setResult] = useState<Result | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (sessionLoading || !userId) return;

    let active = true;

    void supabase
      .from("profiles")
      .select("full_name, phone, avatar_url, created_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setResult({ userId, profile: null, error: true });
          return;
        }
        setResult({
          userId,
          profile: {
            fullName: data.full_name,
            phone: data.phone,
            avatarUrl: data.avatar_url,
            createdAt: data.created_at,
          },
          error: false,
        });
      });

    return () => {
      active = false;
    };
  }, [userId, sessionLoading, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Só vale o resultado que pertence ao usuário atual.
  const current = userId && result?.userId === userId ? result : null;

  return {
    profile: current?.profile ?? null,
    error: current?.error ?? false,
    loading: sessionLoading || (userId !== null && current === null),
    reload,
  };
}

/** "Camila Tavares" → "CT". Uma sílaba só quando há um nome só. */
export function initialsOf(fullName: string | null, fallback: string): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "2026-03-14T…" → "DESDE MAR 2026". */
export function memberSince(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return `DESDE ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
