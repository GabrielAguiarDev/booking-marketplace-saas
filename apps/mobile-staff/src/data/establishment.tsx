import type { Database } from "@vez/supabase/types";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../../lib/supabase";
import { useSession } from "../auth/session";
import { type QueueRow, useQueueLive } from "./queue";

export type Role = Database["public"]["Enums"]["establishment_role"];
export type BookingMode = Database["public"]["Enums"]["booking_mode"];
export type Settings = Database["public"]["Tables"]["establishment_settings"]["Row"];

export type Establishment = {
  id: string;
  name: string;
  slug: string;
  status: Database["public"]["Enums"]["establishment_status"];
  booking_mode: BookingMode;
  description: string | null;
  address_line: string | null;
  neighborhood: string | null;
  phone: string | null;
  accent_color: string | null;
  timezone: string;
  slot_interval_minutes: number;
  min_lead_minutes: number;
  deposit_percent: number;
  cancellation_window_minutes: number;
  rating_avg: number | null;
  rating_count: number;
};

export type Membership = { establishment: Establishment; role: Role };

const COLUMNS =
  "id, name, slug, status, booking_mode, description, address_line, neighborhood, phone," +
  " accent_color, timezone, slot_interval_minutes, min_lead_minutes, deposit_percent," +
  " cancellation_window_minutes, rating_avg, rating_count";

type ContextValue = {
  loading: boolean;
  error: string | null;
  memberships: Membership[];
  establishment: Establishment | null;
  role: Role | null;
  /** Dono ou gerente. É quem pode mudar serviço, horário, regra e perfil. */
  isManager: boolean;
  settings: Settings | null;
  queue: QueueRow[];
  queueError: string | null;
  select: (establishmentId: string) => void;
  reload: () => void;
  patchEstablishment: (patch: Partial<Establishment>) => Promise<boolean>;
  patchSettings: (patch: Partial<Settings>) => Promise<boolean>;
};

const EstablishmentContext = createContext<ContextValue | null>(null);

/**
 * De qual loja é quem está usando o app.
 *
 * Fica num provider e não numa tela porque quase tudo depende da resposta: o
 * cabeçalho, a fila, a agenda, o que a pessoa pode editar. E porque o vínculo é
 * N:N de propósito — o mesmo barbeiro atende em duas unidades, e trocar de loja
 * não pode significar sair da conta.
 *
 * A fila mora aqui pelo mesmo motivo: a barra de abas mostra quantos estão
 * esperando em toda tela do app. Se cada tela assinasse o Realtime por conta
 * própria, seriam cinco assinaturas contando a mesma coisa.
 */
export function EstablishmentProvider({ children }: { children: ReactNode }) {
  const { user, loading: sessionLoading } = useSession();
  // Os dois resultados guardam de qual consulta vieram, e "carregando" é
  // derivado da comparação com a chave atual. Guardar `loading` como estado
  // exigiria `setState` dentro do efeito — e deixaria a loja anterior visível
  // por um instante depois de trocar de loja.
  const [result, setResult] = useState<{
    key: string;
    memberships: Membership[];
    error: string | null;
  } | null>(null);
  const [settingsResult, setSettingsResult] = useState<{
    key: string;
    settings: Settings | null;
  } | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const userId = user?.id ?? null;
  const key = `${userId}:${nonce}`;
  const settingsKey = `${currentId}:${nonce}`;

  useEffect(() => {
    if (sessionLoading || !userId) return;

    let active = true;

    async function load(id: string) {
      // O filtro por `user_id` não é redundante com a RLS: a política deixa um
      // membro ver TODOS os membros da loja dele, então sem ele a lista viria
      // com os vínculos dos colegas também.
      const { data, error: queryError } = await supabase
        .from("establishment_members")
        .select(`role, establishments(${COLUMNS})`)
        .eq("user_id", id);

      if (!active) return;

      if (queryError) {
        setResult({ key, memberships: [], error: "Não foi possível carregar suas lojas." });
        return;
      }

      const rows = ((data ?? []) as unknown as { role: Role; establishments: Establishment }[])
        .filter((row) => row.establishments)
        .map((row) => ({ role: row.role, establishment: row.establishments }))
        .sort((a, b) => a.establishment.name.localeCompare(b.establishment.name, "pt-BR"));

      setResult({ key, memberships: rows, error: null });
      setCurrentId((previous) => {
        if (previous && rows.some((row) => row.establishment.id === previous)) return previous;
        return rows[0]?.establishment.id ?? null;
      });
    }

    void load(userId);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sessionLoading]);

  useEffect(() => {
    if (!currentId) return;

    let active = true;
    void supabase
      .from("establishment_settings")
      .select("*")
      .eq("establishment_id", currentId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setSettingsResult({ key: settingsKey, settings: data });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey]);

  const current = result?.key === key ? result : null;
  const memberships = useMemo(
    () => (userId ? (current?.memberships ?? []) : []),
    [userId, current],
  );
  const settings = settingsResult?.key === settingsKey ? settingsResult.settings : null;
  const loading = sessionLoading || (Boolean(userId) && current === null);
  const error = current?.error ?? null;

  const { rows: queue, error: queueError } = useQueueLive(currentId);

  const membership = useMemo(
    () => memberships.find((row) => row.establishment.id === currentId) ?? null,
    [memberships, currentId],
  );

  const patchEstablishment = useCallback(
    async (patch: Partial<Establishment>) => {
      if (!currentId) return false;
      const { error: writeError } = await supabase
        .from("establishments")
        .update(patch)
        .eq("id", currentId);
      if (writeError) return false;

      setResult((previous) =>
        previous === null
          ? previous
          : {
              ...previous,
              memberships: previous.memberships.map((row) =>
                row.establishment.id === currentId
                  ? { ...row, establishment: { ...row.establishment, ...patch } }
                  : row,
              ),
            },
      );
      return true;
    },
    [currentId],
  );

  const patchSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (!currentId) return false;
      const { error: writeError } = await supabase
        .from("establishment_settings")
        .update(patch)
        .eq("establishment_id", currentId);
      if (writeError) return false;

      setSettingsResult((previous) =>
        previous?.settings
          ? { ...previous, settings: { ...previous.settings, ...patch } }
          : previous,
      );
      return true;
    },
    [currentId],
  );

  const value = useMemo<ContextValue>(
    () => ({
      loading,
      error,
      memberships,
      establishment: membership?.establishment ?? null,
      role: membership?.role ?? null,
      isManager: membership?.role === "owner" || membership?.role === "manager",
      settings,
      queue,
      queueError,
      select: setCurrentId,
      reload: () => setNonce((value) => value + 1),
      patchEstablishment,
      patchSettings,
    }),
    [
      loading,
      error,
      memberships,
      membership,
      settings,
      queue,
      queueError,
      patchEstablishment,
      patchSettings,
    ],
  );

  return <EstablishmentContext.Provider value={value}>{children}</EstablishmentContext.Provider>;
}

export function useEstablishment(): ContextValue {
  const value = useContext(EstablishmentContext);
  if (!value) {
    throw new Error("useEstablishment precisa estar dentro de <EstablishmentProvider>");
  }
  return value;
}

/** Quem espera de verdade, na ordem da fila. */
export function waitingRows(queue: QueueRow[]): QueueRow[] {
  return queue
    .filter((row) => row.status === "waiting" && row.position > 0)
    .sort((a, b) => a.position - b.position);
}

/** Entrou pelo app e ainda não confirmou que chegou. */
export function onTheWayRows(queue: QueueRow[]): QueueRow[] {
  return queue.filter((row) => row.status === "waiting" && row.position === 0);
}
