import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type SessionState = {
  session: Session | null;
  user: User | null;
  /**
   * Verdadeiro até o Keychain responder. Enquanto estiver ligado, ninguém pode
   * concluir que o usuário está deslogado — só que ainda não se sabe. Sem esta
   * distinção o app pisca a tela de entrar em todo lançamento a frio.
   */
  loading: boolean;
};

/**
 * Cria o par provider/hook amarrado ao cliente Supabase de um app.
 *
 * É função e não componente porque cada app tem o seu cliente: o do
 * estabelecimento e o do cliente final guardam sessões diferentes no mesmo
 * aparelho. Um `SessionProvider` que importasse o cliente escolheria por eles.
 */
export function createSessionContext(supabase: SupabaseClient) {
  const SessionContext = createContext<SessionState | null>(null);

  function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let active = true;

      // O `catch` não é zelo excessivo: se a leitura da sessão rejeitar — e ela
      // rejeita quando o armazenamento seguro não existe na plataforma —, sem
      // ele `loading` fica ligado para sempre e o app inteiro nunca sai da tela
      // em branco. Falhar em ler a sessão significa "não há sessão", não
      // "espere mais um pouco".
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (active) setSession(data.session);
        })
        .catch(() => {
          if (active) setSession(null);
        })
        .finally(() => {
          if (active) setLoading(false);
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

  function useSession(): SessionState {
    const value = useContext(SessionContext);
    if (!value) throw new Error("useSession precisa estar dentro de <SessionProvider>");
    return value;
  }

  return { SessionProvider, useSession };
}
