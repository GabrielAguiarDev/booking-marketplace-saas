import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

/**
 * O que precisa sobreviver à navegação.
 *
 * A reserva é montada em quatro telas (loja → horário → confirmar) e só vira
 * linha no banco no fim. Enquanto isso ela é este objeto. Passar tudo por
 * parâmetro de rota transformaria a URL num formulário serializado, e um
 * `router.back()` perderia metade da escolha.
 *
 * O que é local de uma tela — aba ativa, rascunho de comentário — fica na tela.
 */
export type BookingDraft = {
  establishmentId: string | null;
  serviceId: string | null;
  professionalId: string | null;
  /** ISO do início do horário escolhido. */
  slotStart: string | null;
};

const EMPTY: BookingDraft = {
  establishmentId: null,
  serviceId: null,
  professionalId: null,
  slotStart: null,
};

type AppState = {
  booking: BookingDraft;
  /** Começa uma reserva nova. Sempre limpa o resto: reaproveitar o horário da
   *  loja anterior é como se vende um horário que não existe naquela agenda. */
  startBooking: (establishmentId: string, serviceId: string) => void;
  setProfessional: (professionalId: string | null) => void;
  setSlot: (slotStart: string | null) => void;
  clearBooking: () => void;
};

const Context = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState<BookingDraft>(EMPTY);

  const startBooking = useCallback((establishmentId: string, serviceId: string) => {
    setBooking({ establishmentId, serviceId, professionalId: null, slotStart: null });
  }, []);

  const setProfessional = useCallback((professionalId: string | null) => {
    // Trocar de profissional invalida o horário: a agenda é de cada um.
    setBooking((prev) => ({ ...prev, professionalId, slotStart: null }));
  }, []);

  const setSlot = useCallback((slotStart: string | null) => {
    setBooking((prev) => ({ ...prev, slotStart }));
  }, []);

  const clearBooking = useCallback(() => setBooking(EMPTY), []);

  const value = useMemo<AppState>(
    () => ({
      booking,
      startBooking,
      setProfessional,
      setSlot,
      clearBooking,
    }),
    [booking, startBooking, setProfessional, setSlot, clearBooking],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error("useAppState precisa estar dentro de <AppStateProvider>");
  return value;
}
