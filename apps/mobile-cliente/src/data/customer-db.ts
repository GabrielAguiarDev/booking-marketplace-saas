import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";

/**
 * Tipos das tabelas e funções da migration `20260917120000_cliente_conta.sql`.
 *
 * Moram aqui, e não em `@vez/supabase/types`, porque aquele arquivo é gerado
 * a partir do banco local (`pnpm db:types`) e é compartilhado com portal e
 * admin. Quando ele for regenerado com esta migration aplicada, apague este
 * arquivo e troque `customerDb` por `supabase` — os nomes batem.
 */
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type AddressRow = {
  id: string;
  customer_id: string;
  label: string;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type FavoriteRow = {
  customer_id: string;
  establishment_id: string;
  created_at: string;
};

export type NotificationPrefsRow = {
  customer_id: string;
  queue_turn: boolean;
  appointment_reminder: boolean;
  appointment_changes: boolean;
  review_request: boolean;
  marketing: boolean;
  updated_at: string;
};

type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled_by_customer"
  | "cancelled_by_establishment"
  | "no_show";

export type CustomerDatabase = {
  public: {
    Tables: {
      customer_addresses: Table<AddressRow, "customer_id" | "label" | "street">;
      customer_favorites: Table<FavoriteRow, "customer_id" | "establishment_id">;
      customer_notification_prefs: Table<NotificationPrefsRow, "customer_id">;
    };
    Views: Record<string, never>;
    Functions: {
      customer_set_default_address: {
        Args: { p_address_id: string };
        Returns: undefined;
      };
      customer_reschedule_appointment: {
        Args: { p_appointment_id: string; p_starts_at: string; p_professional_id?: string };
        Returns: {
          id: string;
          starts_at: string;
          ends_at: string;
          professional_id: string;
          status: AppointmentStatus;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** O mesmo cliente (mesma sessão), visto com os tipos das tabelas novas. */
export const customerDb = supabase as unknown as SupabaseClient<CustomerDatabase>;
