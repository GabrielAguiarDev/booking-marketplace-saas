export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_id: string
          deposit_cents: number
          ends_at: string
          establishment_id: string
          id: string
          notes: string | null
          price_cents: number
          professional_id: string
          service_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          deposit_cents?: number
          ends_at: string
          establishment_id: string
          id?: string
          notes?: string | null
          price_cents: number
          professional_id: string
          service_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          deposit_cents?: number
          ends_at?: string
          establishment_id?: string
          id?: string
          notes?: string | null
          price_cents?: number
          professional_id?: string
          service_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          cards: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["assistant_role"]
          user_id: string
        }
        Insert: {
          cards?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["assistant_role"]
          user_id: string
        }
        Update: {
          cards?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["assistant_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          closes_at: string
          establishment_id: string
          id: string
          opens_at: string
          weekday: number
        }
        Insert: {
          closes_at: string
          establishment_id: string
          id?: string
          opens_at: string
          weekday: number
        }
        Update: {
          closes_at?: string
          establishment_id?: string
          id?: string
          opens_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          ibge_code: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          state_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ibge_code?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          state_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ibge_code?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          state_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      establishment_members: {
        Row: {
          created_at: string
          establishment_id: string
          role: Database["public"]["Enums"]["establishment_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          role?: Database["public"]["Enums"]["establishment_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          role?: Database["public"]["Enums"]["establishment_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_members_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_photos: {
        Row: {
          alt_text: string | null
          created_at: string
          establishment_id: string
          id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_photos_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          accent_color: string | null
          address_line: string | null
          booking_mode: Database["public"]["Enums"]["booking_mode"]
          cancellation_window_minutes: number
          category: Database["public"]["Enums"]["establishment_category"]
          city_id: string
          created_at: string
          deposit_percent: number
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          min_lead_minutes: number
          name: string
          neighborhood: string | null
          phone: string | null
          rating_avg: number | null
          rating_count: number
          slot_interval_minutes: number
          slug: string
          status: Database["public"]["Enums"]["establishment_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          address_line?: string | null
          booking_mode?: Database["public"]["Enums"]["booking_mode"]
          cancellation_window_minutes?: number
          category: Database["public"]["Enums"]["establishment_category"]
          city_id: string
          created_at?: string
          deposit_percent?: number
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          min_lead_minutes?: number
          name: string
          neighborhood?: string | null
          phone?: string | null
          rating_avg?: number | null
          rating_count?: number
          slot_interval_minutes?: number
          slug: string
          status?: Database["public"]["Enums"]["establishment_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          address_line?: string | null
          booking_mode?: Database["public"]["Enums"]["booking_mode"]
          cancellation_window_minutes?: number
          category?: Database["public"]["Enums"]["establishment_category"]
          city_id?: string
          created_at?: string
          deposit_percent?: number
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          min_lead_minutes?: number
          name?: string
          neighborhood?: string | null
          phone?: string | null
          rating_avg?: number | null
          rating_count?: number
          slot_interval_minutes?: number
          slug?: string
          status?: Database["public"]["Enums"]["establishment_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishments_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          appointment_id: string
          created_at: string
          customer_id: string
          establishment_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string | null
          provider: string | null
          provider_charge_id: string | null
          provider_payload: Json | null
          refunded_at: string | null
          refunded_cents: number
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointment_id: string
          created_at?: string
          customer_id: string
          establishment_id: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          provider?: string | null
          provider_charge_id?: string | null
          provider_payload?: Json | null
          refunded_at?: string | null
          refunded_cents?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string
          created_at?: string
          customer_id?: string
          establishment_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          provider?: string | null
          provider_charge_id?: string | null
          provider_payload?: Json | null
          refunded_at?: string | null
          refunded_cents?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_schedules: {
        Row: {
          ends_at: string
          id: string
          professional_id: string
          starts_at: string
          weekday: number
        }
        Insert: {
          ends_at: string
          id?: string
          professional_id: string
          starts_at: string
          weekday: number
        }
        Update: {
          ends_at?: string
          id?: string
          professional_id?: string
          starts_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_schedules_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          created_at: string
          professional_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          professional_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          establishment_id: string
          id: string
          is_active: boolean
          sort_order: number
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          establishment_id: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      queue_entries: {
        Row: {
          arrived_at: string | null
          called_at: string | null
          created_at: string
          customer_id: string
          establishment_id: string
          finished_at: string | null
          id: string
          joined_at: string
          professional_id: string | null
          served_at: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          called_at?: string | null
          created_at?: string
          customer_id: string
          establishment_id: string
          finished_at?: string | null
          id?: string
          joined_at?: string
          professional_id?: string | null
          served_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          called_at?: string | null
          created_at?: string
          customer_id?: string
          establishment_id?: string
          finished_at?: string | null
          id?: string
          joined_at?: string
          professional_id?: string | null
          served_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string
          comment: string | null
          created_at: string
          customer_id: string
          establishment_id: string
          id: string
          professional_id: string | null
          rating: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          appointment_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          establishment_id: string
          id?: string
          professional_id?: string | null
          rating: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          establishment_id?: string
          id?: string
          professional_id?: string | null
          rating?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          ends_at: string | null
          establishment_id: string
          exception_date: string
          id: string
          is_available: boolean
          professional_id: string | null
          reason: string | null
          starts_at: string | null
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          establishment_id: string
          exception_date: string
          id?: string
          is_available?: boolean
          professional_id?: string | null
          reason?: string | null
          starts_at?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          establishment_id?: string
          exception_date?: string
          id?: string
          is_available?: boolean
          professional_id?: string | null
          reason?: string | null
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes: number
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assistant_usage_today: {
        Args: never
        Returns: {
          day_limit: number
          remaining: number
          used: number
        }[]
      }
      availability_summary: {
        Args: {
          p_days?: number
          p_establishment_id: string
          p_from: string
          p_professional_id?: string
          p_service_id: string
        }
        Returns: {
          day: string
          free_count: number
          is_open: boolean
        }[]
      }
      available_slots: {
        Args: {
          p_date: string
          p_establishment_id: string
          p_professional_id?: string
          p_service_id: string
        }
        Returns: {
          professional_id: string
          slot_end: string
          slot_start: string
        }[]
      }
      current_establishment_ids: { Args: never; Returns: string[] }
      has_establishment_role: {
        Args: {
          p_establishment_id: string
          p_roles: Database["public"]["Enums"]["establishment_role"][]
        }
        Returns: boolean
      }
      is_establishment_member: {
        Args: { p_establishment_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      queue_state: {
        Args: { p_establishment_id: string }
        Returns: {
          customer_id: string
          entry_id: string
          estimated_wait_minutes: number
          joined_at: string
          queue_position: number
          status: Database["public"]["Enums"]["queue_status"]
        }[]
      }
      shares_establishment_with: {
        Args: { p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled_by_customer"
        | "cancelled_by_establishment"
        | "no_show"
      assistant_role: "user" | "assistant"
      booking_mode: "scheduled" | "queue" | "both"
      establishment_category:
        | "barbershop"
        | "salon"
        | "aesthetic_clinic"
        | "dermatology"
        | "petshop"
        | "nail_salon"
        | "dentistry"
        | "massage"
      establishment_role: "owner" | "manager" | "staff"
      establishment_status: "pending" | "active" | "suspended"
      payment_method: "pix" | "credit_card" | "debit_card" | "cash" | "other"
      payment_status:
        | "pending"
        | "authorized"
        | "paid"
        | "refunded"
        | "partially_refunded"
        | "failed"
        | "cancelled"
      queue_status:
        | "waiting"
        | "called"
        | "in_service"
        | "done"
        | "left"
        | "no_show"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled_by_customer",
        "cancelled_by_establishment",
        "no_show",
      ],
      assistant_role: ["user", "assistant"],
      booking_mode: ["scheduled", "queue", "both"],
      establishment_category: [
        "barbershop",
        "salon",
        "aesthetic_clinic",
        "dermatology",
        "petshop",
        "nail_salon",
        "dentistry",
        "massage",
      ],
      establishment_role: ["owner", "manager", "staff"],
      establishment_status: ["pending", "active", "suspended"],
      payment_method: ["pix", "credit_card", "debit_card", "cash", "other"],
      payment_status: [
        "pending",
        "authorized",
        "paid",
        "refunded",
        "partially_refunded",
        "failed",
        "cancelled",
      ],
      queue_status: [
        "waiting",
        "called",
        "in_service",
        "done",
        "left",
        "no_show",
      ],
    },
  },
} as const

