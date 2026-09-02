import type { Session, User } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabase";

type SessionState = {
  session: Session | null;
  user: User | null;
  /**
   * Verdadeiro até o Keychain responder. Enquanto estiver ligado, ninguém pode
   * concluir que o usuário está deslogado — só que ainda não se sabe. Sem esta
   * distinção o app pisca a tela de entrar em todo lançamento a frio.
   */
  loading: boolean;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Cobre login, logout, refresh de token e a troca de sessão que o
    // `verifyOtp` faz na confirmação e na recuperação de senha.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return value;
}
