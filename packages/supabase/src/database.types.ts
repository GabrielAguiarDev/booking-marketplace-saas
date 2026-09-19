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
      account_deletions: {
        Row: {
          anonymized_reviews: number
          cancelled_appointments: number
          requested_at: string
          user_id: string
        }
        Insert: {
          anonymized_reviews?: number
          cancelled_appointments?: number
          requested_at?: string
          user_id: string
        }
        Update: {
          anonymized_reviews?: number
          cancelled_appointments?: number
          requested_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_access_sessions: {
        Row: {
          admin_id: string | null
          admin_name: string
          admin_role: Database["public"]["Enums"]["platform_role"]
          ended_at: string | null
          ended_by: string | null
          establishment_id: string | null
          establishment_name: string
          expires_at: string
          id: string
          reason: string
          started_at: string
        }
        Insert: {
          admin_id?: string | null
          admin_name: string
          admin_role: Database["public"]["Enums"]["platform_role"]
          ended_at?: string | null
          ended_by?: string | null
          establishment_id?: string | null
          establishment_name: string
          expires_at: string
          id?: string
          reason: string
          started_at?: string
        }
        Update: {
          admin_id?: string | null
          admin_name?: string
          admin_role?: Database["public"]["Enums"]["platform_role"]
          ended_at?: string | null
          ended_by?: string | null
          establishment_id?: string | null
          establishment_name?: string
          expires_at?: string
          id?: string
          reason?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_sessions_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_access_sessions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          account_access: boolean
          action: string
          actor_id: string | null
          actor_name: string
          actor_role: Database["public"]["Enums"]["platform_role"] | null
          created_at: string
          establishment_id: string | null
          establishment_name: string | null
          id: string
          meta: string
        }
        Insert: {
          account_access?: boolean
          action: string
          actor_id?: string | null
          actor_name: string
          actor_role?: Database["public"]["Enums"]["platform_role"] | null
          created_at?: string
          establishment_id?: string | null
          establishment_name?: string | null
          id?: string
          meta?: string
        }
        Update: {
          account_access?: boolean
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: Database["public"]["Enums"]["platform_role"] | null
          created_at?: string
          establishment_id?: string | null
          establishment_name?: string | null
          id?: string
          meta?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_id: string | null
          deposit_cents: number
          ends_at: string
          establishment_id: string
          guest_name: string | null
          guest_phone: string | null
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
          customer_id?: string | null
          deposit_cents?: number
          ends_at: string
          establishment_id: string
          guest_name?: string | null
          guest_phone?: string | null
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
          customer_id?: string | null
          deposit_cents?: number
          ends_at?: string
          establishment_id?: string
          guest_name?: string | null
          guest_phone?: string | null
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
      catalog_items: {
        Row: {
          category: Database["public"]["Enums"]["establishment_category"]
          created_at: string
          duration_minutes: number
          id: string
          name: string
          synonyms: string[]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["establishment_category"]
          created_at?: string
          duration_minutes?: number
          id?: string
          name: string
          synonyms?: string[]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["establishment_category"]
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          synonyms?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          ibge_code: string | null
          id: string
          is_active: boolean
          launch_status: Database["public"]["Enums"]["city_launch_status"]
          monthly_price_cents: number | null
          monthly_quota: number
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
          launch_status?: Database["public"]["Enums"]["city_launch_status"]
          monthly_price_cents?: number | null
          monthly_quota?: number
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
          launch_status?: Database["public"]["Enums"]["city_launch_status"]
          monthly_price_cents?: number | null
          monthly_quota?: number
          name?: string
          slug?: string
          state_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          complement: string | null
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          number: string | null
          postal_code: string | null
          street: string
          updated_at: string
        }
        Insert: {
          complement?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          postal_code?: string | null
          street: string
          updated_at?: string
        }
        Update: {
          complement?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          postal_code?: string | null
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_blocks: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          reason: string
          user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_blocks_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_favorites: {
        Row: {
          created_at: string
          customer_id: string
          establishment_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          establishment_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          establishment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notification_prefs: {
        Row: {
          appointment_changes: boolean
          appointment_reminder: boolean
          customer_id: string
          marketing: boolean
          queue_turn: boolean
          review_request: boolean
          updated_at: string
        }
        Insert: {
          appointment_changes?: boolean
          appointment_reminder?: boolean
          customer_id: string
          marketing?: boolean
          queue_turn?: boolean
          review_request?: boolean
          updated_at?: string
        }
        Update: {
          appointment_changes?: boolean
          appointment_reminder?: boolean
          customer_id?: string
          marketing?: boolean
          queue_turn?: boolean
          review_request?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notification_prefs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_decisions: {
        Row: {
          decided_at: string
          decided_by: string | null
          decision: Database["public"]["Enums"]["application_decision"]
          establishment_id: string
          id: string
          message: string | null
          plan_id: string | null
        }
        Insert: {
          decided_at?: string
          decided_by?: string | null
          decision: Database["public"]["Enums"]["application_decision"]
          establishment_id: string
          id?: string
          message?: string | null
          plan_id?: string | null
        }
        Update: {
          decided_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["application_decision"]
          establishment_id?: string
          id?: string
          message?: string | null
          plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishment_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_decisions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_decisions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          establishment_id: string
          id: string
          invited_at: string
          invited_by: string | null
          name: string
          professional_id: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["establishment_role"]
          sent_by_auth: boolean
          status: Database["public"]["Enums"]["establishment_invite_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          establishment_id: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          name: string
          professional_id?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["establishment_role"]
          sent_by_auth: boolean
          status?: Database["public"]["Enums"]["establishment_invite_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          establishment_id?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          name?: string
          professional_id?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["establishment_role"]
          sent_by_auth?: boolean
          status?: Database["public"]["Enums"]["establishment_invite_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishment_invitations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_invitations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_invitations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      establishment_queue_codes: {
        Row: {
          code: string
          establishment_id: string
          rotated_at: string
          rotated_by: string | null
        }
        Insert: {
          code: string
          establishment_id: string
          rotated_at?: string
          rotated_by?: string | null
        }
        Update: {
          code?: string
          establishment_id?: string
          rotated_at?: string
          rotated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishment_queue_codes_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "establishment_queue_codes_rotated_by_fkey"
            columns: ["rotated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_settings: {
        Row: {
          accept_app_payment: boolean
          auto_approve: boolean
          created_at: string
          deposit_refundable: boolean
          establishment_id: string
          queue_arrival_method: Database["public"]["Enums"]["queue_arrival_method"]
          queue_auto_close: boolean
          queue_auto_skip: boolean
          queue_close_after_minutes: number
          queue_notify_channel: Database["public"]["Enums"]["queue_notify_channel"]
          queue_notify_enabled: boolean
          queue_per_professional: boolean
          queue_qr_enabled: boolean
          queue_remote_join: boolean
          queue_require_arrival: boolean
          updated_at: string
        }
        Insert: {
          accept_app_payment?: boolean
          auto_approve?: boolean
          created_at?: string
          deposit_refundable?: boolean
          establishment_id: string
          queue_arrival_method?: Database["public"]["Enums"]["queue_arrival_method"]
          queue_auto_close?: boolean
          queue_auto_skip?: boolean
          queue_close_after_minutes?: number
          queue_notify_channel?: Database["public"]["Enums"]["queue_notify_channel"]
          queue_notify_enabled?: boolean
          queue_per_professional?: boolean
          queue_qr_enabled?: boolean
          queue_remote_join?: boolean
          queue_require_arrival?: boolean
          updated_at?: string
        }
        Update: {
          accept_app_payment?: boolean
          auto_approve?: boolean
          created_at?: string
          deposit_refundable?: boolean
          establishment_id?: string
          queue_arrival_method?: Database["public"]["Enums"]["queue_arrival_method"]
          queue_auto_close?: boolean
          queue_auto_skip?: boolean
          queue_close_after_minutes?: number
          queue_notify_channel?: Database["public"]["Enums"]["queue_notify_channel"]
          queue_notify_enabled?: boolean
          queue_per_professional?: boolean
          queue_qr_enabled?: boolean
          queue_remote_join?: boolean
          queue_require_arrival?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
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
          cnpj: string | null
          contact_email: string | null
          created_at: string
          deposit_percent: number
          description: string | null
          discount_percent: number | null
          discount_until: string | null
          id: string
          latitude: number | null
          legal_name: string | null
          longitude: number | null
          min_lead_minutes: number
          name: string
          neighborhood: string | null
          phone: string | null
          plan_changed_at: string | null
          plan_id: string | null
          rating_avg: number | null
          rating_count: number
          responsible_name: string | null
          slot_interval_minutes: number
          slug: string
          status: Database["public"]["Enums"]["establishment_status"]
          status_changed_at: string
          status_reason: string | null
          submitted_at: string
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
          cnpj?: string | null
          contact_email?: string | null
          created_at?: string
          deposit_percent?: number
          description?: string | null
          discount_percent?: number | null
          discount_until?: string | null
          id?: string
          latitude?: number | null
          legal_name?: string | null
          longitude?: number | null
          min_lead_minutes?: number
          name: string
          neighborhood?: string | null
          phone?: string | null
          plan_changed_at?: string | null
          plan_id?: string | null
          rating_avg?: number | null
          rating_count?: number
          responsible_name?: string | null
          slot_interval_minutes?: number
          slug: string
          status?: Database["public"]["Enums"]["establishment_status"]
          status_changed_at?: string
          status_reason?: string | null
          submitted_at?: string
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
          cnpj?: string | null
          contact_email?: string | null
          created_at?: string
          deposit_percent?: number
          description?: string | null
          discount_percent?: number | null
          discount_until?: string | null
          id?: string
          latitude?: number | null
          legal_name?: string | null
          longitude?: number | null
          min_lead_minutes?: number
          name?: string
          neighborhood?: string | null
          phone?: string | null
          plan_changed_at?: string | null
          plan_id?: string | null
          rating_avg?: number | null
          rating_count?: number
          responsible_name?: string | null
          slot_interval_minutes?: number
          slug?: string
          status?: Database["public"]["Enums"]["establishment_status"]
          status_changed_at?: string
          status_reason?: string | null
          submitted_at?: string
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
          {
            foreignKeyName: "establishments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          category: Database["public"]["Enums"]["establishment_category"] | null
          contact: string
          contact_digits: string
          created_at: string
          establishment_name: string
          handled_at: string | null
          handled_by: string | null
          handled_note: string | null
          id: string
          message: string | null
          name: string
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          category?:
            | Database["public"]["Enums"]["establishment_category"]
            | null
          contact: string
          contact_digits: string
          created_at?: string
          establishment_name: string
          handled_at?: string | null
          handled_by?: string | null
          handled_note?: string | null
          id?: string
          message?: string | null
          name: string
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          category?:
            | Database["public"]["Enums"]["establishment_category"]
            | null
          contact?: string
          contact_digits?: string
          created_at?: string
          establishment_name?: string
          handled_at?: string | null
          handled_by?: string | null
          handled_note?: string | null
          id?: string
          message?: string | null
          name?: string
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_notification_prefs: {
        Row: {
          created_at: string
          establishment_id: string
          notify_cancellation: boolean
          notify_daily_summary: boolean
          notify_new_appointment: boolean
          notify_queue_join: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          notify_cancellation?: boolean
          notify_daily_summary?: boolean
          notify_new_appointment?: boolean
          notify_queue_join?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          notify_cancellation?: boolean
          notify_daily_summary?: boolean
          notify_new_appointment?: boolean
          notify_queue_join?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notification_prefs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_attempts: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          method: string
          succeeded: boolean
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          method: string
          succeeded: boolean
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          method?: string
          succeeded?: boolean
          user_id?: string
        }
        Relationships: []
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          app: Database["public"]["Enums"]["notification_app"] | null
          attempts: number
          available_at: string
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          data: Json
          dedupe_key: string | null
          email: string | null
          establishment_id: string | null
          expires_at: string
          id: string
          kind: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          phone: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          app?: Database["public"]["Enums"]["notification_app"] | null
          attempts?: number
          available_at?: string
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          email?: string | null
          establishment_id?: string | null
          expires_at?: string
          id?: string
          kind: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          phone?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          app?: Database["public"]["Enums"]["notification_app"] | null
          attempts?: number
          available_at?: string
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          email?: string | null
          establishment_id?: string | null
          expires_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          phone?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      plans: {
        Row: {
          commission_percent: number | null
          created_at: string
          id: string
          integrated_payment: string
          is_active: boolean
          is_default: boolean
          kind: Database["public"]["Enums"]["plan_kind"]
          max_branches: number | null
          max_professionals: number | null
          name: string
          queue_included: boolean
          search_highlight: boolean
          updated_at: string
        }
        Insert: {
          commission_percent?: number | null
          created_at?: string
          id?: string
          integrated_payment?: string
          is_active?: boolean
          is_default?: boolean
          kind: Database["public"]["Enums"]["plan_kind"]
          max_branches?: number | null
          max_professionals?: number | null
          name: string
          queue_included?: boolean
          search_highlight?: boolean
          updated_at?: string
        }
        Update: {
          commission_percent?: number | null
          created_at?: string
          id?: string
          integrated_payment?: string
          is_active?: boolean
          is_default?: boolean
          kind?: Database["public"]["Enums"]["plan_kind"]
          max_branches?: number | null
          max_professionals?: number | null
          name?: string
          queue_included?: boolean
          search_highlight?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          last_seen_at: string | null
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          last_seen_at?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          last_seen_at?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          admin_mfa_required: boolean
          cancellation_window_hours: number
          delinquency_grace_days: number
          id: boolean
          no_show_block_threshold: number
          plan_change_interval_days: number
          queue_max_per_professional: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_mfa_required?: boolean
          cancellation_window_hours?: number
          delinquency_grace_days?: number
          id?: boolean
          no_show_block_threshold?: number
          plan_change_interval_days?: number
          queue_max_per_professional?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_mfa_required?: boolean
          cancellation_window_hours?: number
          delinquency_grace_days?: number
          id?: boolean
          no_show_block_threshold?: number
          plan_change_interval_days?: number
          queue_max_per_professional?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      push_devices: {
        Row: {
          app: Database["public"]["Enums"]["notification_app"]
          created_at: string
          device_name: string | null
          disabled_at: string | null
          disabled_reason: string | null
          expo_token: string
          id: string
          last_seen_at: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app: Database["public"]["Enums"]["notification_app"]
          created_at?: string
          device_name?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          expo_token: string
          id?: string
          last_seen_at?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app?: Database["public"]["Enums"]["notification_app"]
          created_at?: string
          device_name?: string | null
          disabled_at?: string | null
          disabled_reason?: string | null
          expo_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_entries: {
        Row: {
          arrived_at: string | null
          called_at: string | null
          created_at: string
          customer_id: string | null
          establishment_id: string
          finished_at: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          joined_at: string
          professional_id: string | null
          served_at: string | null
          service_id: string | null
          source: Database["public"]["Enums"]["queue_source"]
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          called_at?: string | null
          created_at?: string
          customer_id?: string | null
          establishment_id: string
          finished_at?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          joined_at?: string
          professional_id?: string | null
          served_at?: string | null
          service_id?: string | null
          source?: Database["public"]["Enums"]["queue_source"]
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          called_at?: string | null
          created_at?: string
          customer_id?: string | null
          establishment_id?: string
          finished_at?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          joined_at?: string
          professional_id?: string | null
          served_at?: string | null
          service_id?: string | null
          source?: Database["public"]["Enums"]["queue_source"]
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
      review_reports: {
        Row: {
          clarification_answer: string | null
          clarification_answered_at: string | null
          clarification_request: string | null
          decided_at: string | null
          decided_by: string | null
          decision_motive: string | null
          decision_note: string | null
          establishment_id: string
          id: string
          justification: string
          notify_author: boolean | null
          opened_at: string
          opened_by: string | null
          reason: string
          review_id: string
          status: Database["public"]["Enums"]["review_report_status"]
        }
        Insert: {
          clarification_answer?: string | null
          clarification_answered_at?: string | null
          clarification_request?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_motive?: string | null
          decision_note?: string | null
          establishment_id: string
          id?: string
          justification?: string
          notify_author?: boolean | null
          opened_at?: string
          opened_by?: string | null
          reason: string
          review_id: string
          status?: Database["public"]["Enums"]["review_report_status"]
        }
        Update: {
          clarification_answer?: string | null
          clarification_answered_at?: string | null
          clarification_request?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_motive?: string | null
          decision_note?: string | null
          establishment_id?: string
          id?: string
          justification?: string
          notify_author?: boolean | null
          opened_at?: string
          opened_by?: string | null
          reason?: string
          review_id?: string
          status?: Database["public"]["Enums"]["review_report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
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
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
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
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
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
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
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
          {
            foreignKeyName: "reviews_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      search_events: {
        Row: {
          city_id: string | null
          created_at: string
          id: number
          results: number
          term: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          id?: never
          results: number
          term: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          id?: never
          results?: number
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          catalog_dismissed_at: string | null
          catalog_item_id: string | null
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
          catalog_dismissed_at?: string | null
          catalog_item_id?: string | null
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
          catalog_dismissed_at?: string | null
          catalog_item_id?: string | null
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
            foreignKeyName: "services_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_banners: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          image_path: string
          is_active: boolean
          sort_order: number
          starts_at: string | null
          subtitle: string
          target_category:
            | Database["public"]["Enums"]["establishment_category"]
            | null
          target_establishment_id: string | null
          target_kind: Database["public"]["Enums"]["showcase_target"]
          target_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_path: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string
          target_category?:
            | Database["public"]["Enums"]["establishment_category"]
            | null
          target_establishment_id?: string | null
          target_kind: Database["public"]["Enums"]["showcase_target"]
          target_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string
          target_category?:
            | Database["public"]["Enums"]["establishment_category"]
            | null
          target_establishment_id?: string | null
          target_kind?: Database["public"]["Enums"]["showcase_target"]
          target_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showcase_banners_target_establishment_id_fkey"
            columns: ["target_establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          expires_at: string
          file_name: string
          from_staff: boolean
          id: string
          message_id: string | null
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          file_name: string
          from_staff: boolean
          id?: string
          message_id?: string | null
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          file_name?: string
          from_staff?: boolean
          id?: string
          message_id?: string | null
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          created_at: string
          from_staff: boolean
          id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          body: string
          created_at?: string
          from_staff: boolean
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          created_at?: string
          from_staff?: boolean
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["support_ticket_category"]
          created_at: string
          establishment_id: string | null
          first_response_at: string | null
          id: string
          last_message_at: string
          last_message_from_staff: boolean
          number: number
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          requester_id: string | null
          requester_kind: Database["public"]["Enums"]["support_requester_kind"]
          requester_name: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at: string
          waiting_since: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          establishment_id?: string | null
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          last_message_from_staff?: boolean
          number?: never
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          requester_id?: string | null
          requester_kind: Database["public"]["Enums"]["support_requester_kind"]
          requester_name: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at?: string
          waiting_since?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          establishment_id?: string | null
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          last_message_from_staff?: boolean
          number?: never
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          requester_id?: string | null
          requester_kind?: Database["public"]["Enums"]["support_requester_kind"]
          requester_name?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          updated_at?: string
          waiting_since?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "support_tickets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_account_agenda: {
        Args: { p_establishment_id: string; p_session_id: string }
        Returns: {
          customer: string
          ends_at: string
          id: string
          price_cents: number
          professional: string
          service: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      admin_account_professionals: {
        Args: { p_establishment_id: string; p_session_id: string }
        Returns: {
          bio: string
          id: string
          is_active: boolean
          name: string
          services: string[]
          title: string
        }[]
      }
      admin_account_reviews: {
        Args: { p_establishment_id: string; p_session_id: string }
        Returns: {
          comment: string
          created_at: string
          customer: string
          id: string
          professional: string
          rating: number
          tags: string[]
        }[]
      }
      admin_account_services: {
        Args: { p_establishment_id: string; p_session_id: string }
        Returns: {
          description: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          professionals: number
        }[]
      }
      admin_account_settings: {
        Args: { p_establishment_id: string; p_session_id: string }
        Returns: {
          accept_app_payment: boolean
          auto_approve: boolean
          booking_mode: Database["public"]["Enums"]["booking_mode"]
          cancellation_window_minutes: number
          deposit_percent: number
          deposit_refundable: boolean
          min_lead_minutes: number
          queue_arrival_method: Database["public"]["Enums"]["queue_arrival_method"]
          queue_auto_close: boolean
          queue_auto_skip: boolean
          queue_close_after_minutes: number
          queue_notify_channel: Database["public"]["Enums"]["queue_notify_channel"]
          queue_notify_enabled: boolean
          queue_per_professional: boolean
          queue_remote_join: boolean
          queue_require_arrival: boolean
          slot_interval_minutes: number
          timezone: string
        }[]
      }
      admin_active_access_sessions: {
        Args: never
        Returns: {
          establishment_id: string
          establishment_name: string
          expires_at: string
          id: string
          reason: string
          started_at: string
        }[]
      }
      admin_add_team_member: {
        Args: {
          p_email: string
          p_invited?: boolean
          p_name: string
          p_role: Database["public"]["Enums"]["platform_role"]
        }
        Returns: string
      }
      admin_applications: {
        Args: never
        Returns: {
          address: string
          category: Database["public"]["Enums"]["establishment_category"]
          city: string
          city_id: string
          cnpj: string
          email: string
          id: string
          legal_name: string
          name: string
          phone: string
          photos: number
          professionals: number
          responsible: string
          services: string[]
          submitted_at: string
        }[]
      }
      admin_apply_discount: {
        Args: { p_ids: string[]; p_months: number; p_percent: number }
        Returns: undefined
      }
      admin_assign_ticket: {
        Args: { p_admin_id: string; p_ticket_id: string }
        Returns: undefined
      }
      admin_audit: {
        Args: never
        Returns: {
          account_access: boolean
          action: string
          created_at: string
          id: string
          meta: string
          who: string
        }[]
      }
      admin_brl: { Args: { p_cents: number }; Returns: string }
      admin_catalog_items: {
        Args: never
        Returns: {
          appointments_month: number
          average_price_cents: number
          category: Database["public"]["Enums"]["establishment_category"]
          cities: number
          duration_minutes: number
          establishments: number
          id: string
          name: string
          searches_month: number
          synonyms: string[]
        }[]
      }
      admin_catalog_suggestions: {
        Args: never
        Returns: {
          category: Database["public"]["Enums"]["establishment_category"]
          city: string
          establishment: string
          key: string
          name: string
          requests: number
        }[]
      }
      admin_change_plan: {
        Args: {
          p_ids: string[]
          p_kind: Database["public"]["Enums"]["plan_kind"]
        }
        Returns: undefined
      }
      admin_cities: {
        Args: never
        Returns: {
          appointments_month: number
          categories: string[]
          customers: number
          establishments: number
          gaps: string[]
          id: string
          launch_status: Database["public"]["Enums"]["city_launch_status"]
          monthly_price_cents: number
          name: string
          quota_total: number
          quota_used: number
          uf: string
        }[]
      }
      admin_create_catalog_item: {
        Args: {
          p_category: Database["public"]["Enums"]["establishment_category"]
          p_name: string
        }
        Returns: string
      }
      admin_customers: {
        Args: never
        Returns: {
          appointments: number
          blocked: boolean
          city: string
          id: string
          misses: Json
          name: string
          no_shows: number
          since: string
        }[]
      }
      admin_decide_application: {
        Args: {
          p_decision: Database["public"]["Enums"]["application_decision"]
          p_establishment_id: string
          p_message: string
          p_plan: Database["public"]["Enums"]["plan_kind"]
        }
        Returns: undefined
      }
      admin_decide_report: {
        Args: {
          p_decision: string
          p_motive: string
          p_note: string
          p_notify_author: boolean
          p_report_id: string
        }
        Returns: undefined
      }
      admin_decisions: {
        Args: never
        Returns: {
          city: string
          decided_at: string
          decision: Database["public"]["Enums"]["application_decision"]
          id: string
          name: string
          plan_kind: Database["public"]["Enums"]["plan_kind"]
          who: string
        }[]
      }
      admin_delete_banner: { Args: { p_id: string }; Returns: string }
      admin_end_access_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      admin_establishments: {
        Args: never
        Returns: {
          address: string
          appointments_month: number
          category: Database["public"]["Enums"]["establishment_category"]
          city: string
          city_id: string
          city_price_cents: number
          cnpj: string
          commission_percent: number
          completed_month_cents: number
          created_at: string
          discount_percent: number
          id: string
          last_appointment_at: string
          name: string
          plan_id: string
          plan_kind: Database["public"]["Enums"]["plan_kind"]
          previous_60: number
          professionals: number
          recent_30: number
          responsible: string
          status: Database["public"]["Enums"]["establishment_status"]
          uf: string
          usage: number[]
        }[]
      }
      admin_has_active_access_session: {
        Args: { p_establishment_id: string; p_session_id: string }
        Returns: boolean
      }
      admin_leads: {
        Args: never
        Returns: {
          category: Database["public"]["Enums"]["establishment_category"]
          contact: string
          created_at: string
          establishment_name: string
          handled_at: string
          handled_by: string
          handled_note: string
          id: string
          message: string
          name: string
          previous_attempts: number
          source: string
          status: Database["public"]["Enums"]["lead_status"]
        }[]
      }
      admin_me: {
        Args: never
        Returns: {
          id: string
          name: string
          role: Database["public"]["Enums"]["platform_role"]
        }[]
      }
      admin_mfa_policy: { Args: never; Returns: boolean }
      admin_mfa_reset_check: { Args: { p_user_id: string }; Returns: string }
      admin_no_result_searches: {
        Args: never
        Returns: {
          city: string
          searches: number
          term: string
        }[]
      }
      admin_notification_health: {
        Args: never
        Returns: {
          channel: Database["public"]["Enums"]["notification_channel"]
          last_error: string
          oldest_due: string
          status: Database["public"]["Enums"]["notification_status"]
          total: number
        }[]
      }
      admin_open_city: {
        Args: {
          p_name: string
          p_price_cents: number
          p_quota: number
          p_uf: string
        }
        Returns: string
      }
      admin_overview: {
        Args: never
        Returns: {
          active_establishments: number
          appointments_month: number
          approved_month: number
          paid_in_app_month: number
          series: Json
          suspended_month: number
        }[]
      }
      admin_plans: {
        Args: never
        Returns: {
          commission_percent: number
          id: string
          integrated_payment: string
          is_active: boolean
          is_default: boolean
          kind: Database["public"]["Enums"]["plan_kind"]
          max_branches: number
          max_professionals: number
          name: string
          queue_included: boolean
          search_highlight: boolean
        }[]
      }
      admin_quota_used: { Args: { p_city_id: string }; Returns: number }
      admin_register_contact: {
        Args: { p_establishment_id: string; p_note: string }
        Returns: undefined
      }
      admin_register_customer_contact: {
        Args: { p_note: string; p_user_id: string }
        Returns: undefined
      }
      admin_remove_team_member: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_reorder_banners: { Args: { p_ids: string[] }; Returns: undefined }
      admin_reply_ticket: {
        Args: {
          p_body: string
          p_status?: Database["public"]["Enums"]["support_ticket_status"]
          p_ticket_id: string
        }
        Returns: undefined
      }
      admin_request_clarification: {
        Args: { p_message: string; p_report_id: string }
        Returns: undefined
      }
      admin_require: {
        Args: { p_roles?: Database["public"]["Enums"]["platform_role"][] }
        Returns: undefined
      }
      admin_require_active_access_session: {
        Args: { p_establishment_id: string; p_session_id: string }
        Returns: undefined
      }
      admin_require_team_admin: { Args: never; Returns: undefined }
      admin_resolve_suggestion: {
        Args: { p_key: string; p_resolution: string; p_target_id: string }
        Returns: undefined
      }
      admin_review_panorama: {
        Args: never
        Returns: {
          average: number
          city: string
          delta_30: number
          establishment_id: string
          month: number
          name: string
          recent: Json
          reports: number
          total: number
        }[]
      }
      admin_review_reports: {
        Args: never
        Returns: {
          appointment_at: string
          author: string
          author_average: number
          author_removed: number
          author_reviews: number
          city: string
          clarification_answer: string
          clarification_answered_at: string
          clarification_request: string
          comment: string
          establishment: string
          establishment_average: number
          establishment_id: string
          establishment_reports: number
          establishment_reviews: number
          id: string
          justification: string
          opened_at: string
          professional: string
          rating: number
          reason: string
          review_id: string
          reviewed_at: string
          service: string
          status: Database["public"]["Enums"]["review_report_status"]
          value_cents: number
        }[]
      }
      admin_role_label: {
        Args: { p_role: Database["public"]["Enums"]["platform_role"] }
        Returns: string
      }
      admin_save_banner: {
        Args: {
          p_ends_at?: string
          p_id?: string
          p_image_path: string
          p_starts_at?: string
          p_subtitle: string
          p_target_kind: Database["public"]["Enums"]["showcase_target"]
          p_target_value: string
          p_title: string
        }
        Returns: string
      }
      admin_save_catalog_item: {
        Args: {
          p_duration_minutes: number
          p_id: string
          p_name: string
          p_synonyms: string[]
        }
        Returns: undefined
      }
      admin_save_quotas: {
        Args: { p_prices?: Json; p_totals: Json }
        Returns: undefined
      }
      admin_set_banner_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      admin_set_city_status: {
        Args: {
          p_city_id: string
          p_status: Database["public"]["Enums"]["city_launch_status"]
        }
        Returns: undefined
      }
      admin_set_customer_blocked: {
        Args: { p_blocked: boolean; p_reason: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_establishment_status: {
        Args: {
          p_ids: string[]
          p_reason: string
          p_status: Database["public"]["Enums"]["establishment_status"]
        }
        Returns: undefined
      }
      admin_set_lead_status: {
        Args: {
          p_lead_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["lead_status"]
        }
        Returns: undefined
      }
      admin_set_mfa_required: {
        Args: { p_required: boolean }
        Returns: undefined
      }
      admin_set_team_role: {
        Args: {
          p_role: Database["public"]["Enums"]["platform_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_set_ticket_priority: {
        Args: {
          p_priority: Database["public"]["Enums"]["support_ticket_priority"]
          p_ticket_id: string
        }
        Returns: undefined
      }
      admin_set_ticket_status: {
        Args: {
          p_status: Database["public"]["Enums"]["support_ticket_status"]
          p_ticket_id: string
        }
        Returns: undefined
      }
      admin_settings: {
        Args: never
        Returns: {
          cancellation_window_hours: number
          default_commission_percent: number
          delinquency_grace_days: number
          no_show_block_threshold: number
          plan_change_interval_days: number
          queue_max_per_professional: number
        }[]
      }
      admin_showcase_banners: {
        Args: never
        Returns: {
          created_at: string
          created_by: string
          ends_at: string
          id: string
          image_path: string
          is_active: boolean
          is_live: boolean
          sort_order: number
          starts_at: string
          subtitle: string
          target_available: boolean
          target_kind: Database["public"]["Enums"]["showcase_target"]
          target_label: string
          target_value: string
          title: string
          updated_at: string
        }[]
      }
      admin_start_access_session: {
        Args: {
          p_establishment_id: string
          p_minutes: number
          p_reason: string
        }
        Returns: string
      }
      admin_support_ticket_messages: {
        Args: { p_ticket_id: string }
        Returns: {
          author_name: string
          body: string
          created_at: string
          from_staff: boolean
          id: string
        }[]
      }
      admin_support_tickets: {
        Args: never
        Returns: {
          assigned_to: string
          assignee: string
          category: Database["public"]["Enums"]["support_ticket_category"]
          created_at: string
          establishment: string
          establishment_id: string
          first_response_at: string
          id: string
          last_message_at: string
          last_message_from_staff: boolean
          messages: number
          number: number
          preview: string
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          requester_email: string
          requester_id: string
          requester_kind: Database["public"]["Enums"]["support_requester_kind"]
          requester_name: string
          resolved_at: string
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          waiting_since: string
        }[]
      }
      admin_team: {
        Args: never
        Returns: {
          email: string
          id: string
          invited_at: string
          last_seen_at: string
          name: string
          pending: boolean
          role: Database["public"]["Enums"]["platform_role"]
        }[]
      }
      admin_update_param: {
        Args: { p_key: string; p_value: number }
        Returns: undefined
      }
      admin_update_plan: {
        Args: {
          p_city_prices: Json
          p_commission_percent: number
          p_max_professionals: number
          p_plan_id: string
        }
        Returns: undefined
      }
      admin_write_audit: {
        Args: {
          p_account_access?: boolean
          p_action: string
          p_establishment_id?: string
          p_meta: string
        }
        Returns: undefined
      }
      answer_review_clarification: {
        Args: { p_answer: string; p_report_id: string }
        Returns: undefined
      }
      assert_establishment_manager: {
        Args: { p_establishment_id: string }
        Returns: undefined
      }
      assistant_usage_today: {
        Args: never
        Returns: {
          day_limit: number
          remaining: number
          used: number
        }[]
      }
      attach_support_file: {
        Args: {
          p_file_name: string
          p_message_id?: string
          p_storage_path: string
          p_ticket_id: string
        }
        Returns: string
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
      block_impact: {
        Args: {
          p_date?: string
          p_ends_at?: string
          p_establishment_id: string
          p_professional_id?: string
          p_starts_at?: string
        }
        Returns: {
          customer_name: string
          ends_at: string
          id: string
          professional_name: string
          service_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      create_establishment_application: {
        Args: { p_application: Json; p_owner: string }
        Returns: string
      }
      current_establishment_ids: { Args: never; Returns: string[] }
      customer_cancel_appointment: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: {
          deposit_cents: number
          minutes_until_start: number
          within_free_window: boolean
        }[]
      }
      customer_delete_account: {
        Args: { p_user_id: string }
        Returns: {
          anonymized_reviews: number
          cancelled_appointments: number
        }[]
      }
      customer_reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_professional_id?: string
          p_starts_at: string
        }
        Returns: {
          ends_at: string
          id: string
          professional_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      customer_set_default_address: {
        Args: { p_address_id: string }
        Returns: undefined
      }
      customer_support_ticket_messages: {
        Args: { p_ticket_id: string }
        Returns: {
          author_name: string
          body: string
          created_at: string
          from_staff: boolean
          id: string
        }[]
      }
      customer_support_tickets: {
        Args: { p_ticket_id?: string }
        Returns: {
          category: Database["public"]["Enums"]["support_ticket_category"]
          created_at: string
          establishment_id: string
          establishment_name: string
          id: string
          last_message_at: string
          last_message_from_staff: boolean
          number: number
          preview: string
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
        }[]
      }
      default_cancellation_window_minutes: { Args: never; Returns: number }
      establishment_accept_invites: {
        Args: never
        Returns: {
          accepted: number
          establishment_id: string
        }[]
      }
      establishment_add_member: {
        Args: {
          p_email: string
          p_establishment_id: string
          p_name: string
          p_professional_id?: string
          p_role: Database["public"]["Enums"]["establishment_role"]
          p_sent_by_auth?: boolean
        }
        Returns: string
      }
      establishment_application_normalize: {
        Args: { p_application: Json; p_establishment_id?: string }
        Returns: Json
      }
      establishment_invite_check: {
        Args: {
          p_email: string
          p_establishment_id: string
          p_professional_id?: string
          p_role: Database["public"]["Enums"]["establishment_role"]
        }
        Returns: undefined
      }
      establishment_invites: {
        Args: { p_establishment_id: string }
        Returns: {
          accepted_at: string
          email: string
          id: string
          invited_at: string
          name: string
          professional_id: string
          role: Database["public"]["Enums"]["establishment_role"]
          sent_by_auth: boolean
          status: Database["public"]["Enums"]["establishment_invite_status"]
        }[]
      }
      establishment_photo_can_write: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      establishment_record_invite: {
        Args: {
          p_email: string
          p_establishment_id: string
          p_invited_by: string
          p_name: string
          p_professional_id: string
          p_role: Database["public"]["Enums"]["establishment_role"]
          p_sent_by_auth: boolean
        }
        Returns: string
      }
      establishment_reviews: {
        Args: { p_establishment_id: string }
        Returns: {
          appointment_at: string
          author: string
          clarification_answer: string
          clarification_answered_at: string
          clarification_request: string
          comment: string
          created_at: string
          decided_at: string
          decision_motive: string
          decision_note: string
          professional: string
          rating: number
          removed: boolean
          report_id: string
          report_justification: string
          report_opened_at: string
          report_reason: string
          report_status: Database["public"]["Enums"]["review_report_status"]
          review_id: string
          service: string
          tags: string[]
        }[]
      }
      establishment_revoke_invite: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
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
      is_support_agent: { Args: never; Returns: boolean }
      mfa_recovery_completed: {
        Args: { p_actor_id?: string; p_method: string; p_user_id: string }
        Returns: undefined
      }
      mfa_recovery_generate_codes: { Args: never; Returns: string[] }
      mfa_recovery_status: {
        Args: never
        Returns: {
          generated_at: string
          remaining: number
          total: number
        }[]
      }
      mfa_redeem_recovery_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: boolean
      }
      normalize_cnpj: { Args: { p_value: string }; Returns: string }
      notification_appointment_reminders: { Args: never; Returns: number }
      notification_claim: {
        Args: {
          p_channels: Database["public"]["Enums"]["notification_channel"][]
          p_limit?: number
        }
        Returns: {
          app: Database["public"]["Enums"]["notification_app"]
          attempts: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          data: Json
          email: string
          expo_tokens: string[]
          id: string
          kind: string
          phone: string
          title: string
        }[]
      }
      notification_complete: { Args: { p_results: Json }; Returns: number }
      notification_customer_allows: {
        Args: { p_pref: string; p_user_id: string }
        Returns: boolean
      }
      notification_daily_summaries: { Args: never; Returns: number }
      notification_dispatch_kick: { Args: never; Returns: string }
      notification_expire: { Args: never; Returns: number }
      notification_hold_unconfigured: {
        Args: {
          p_channels: Database["public"]["Enums"]["notification_channel"][]
        }
        Returns: number
      }
      notification_staff_recipients: {
        Args: {
          p_establishment_id: string
          p_pref: string
          p_professional_id?: string
        }
        Returns: string[]
      }
      notification_when: {
        Args: { p_at: string; p_establishment_id: string }
        Returns: string
      }
      notify_enqueue: {
        Args: {
          p_app?: Database["public"]["Enums"]["notification_app"]
          p_available_at?: string
          p_body: string
          p_channel: Database["public"]["Enums"]["notification_channel"]
          p_data?: Json
          p_dedupe_key?: string
          p_email?: string
          p_establishment_id?: string
          p_kind: string
          p_phone?: string
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      open_support_ticket: {
        Args: {
          p_body: string
          p_category?: Database["public"]["Enums"]["support_ticket_category"]
          p_establishment_id?: string
          p_subject: string
        }
        Returns: {
          id: string
          number: number
        }[]
      }
      portal_create_guest_appointment: {
        Args: {
          p_establishment_id: string
          p_guest_name: string
          p_guest_phone?: string
          p_notes?: string
          p_professional_id: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: string
      }
      portal_operation_customers: {
        Args: { p_establishment_id: string }
        Returns: {
          appointments: number
          completed: number
          customer_id: string
          has_account: boolean
          identity_key: string
          last_seen_at: string
          name: string
          no_shows: number
          phone: string
          queue_visits: number
          spent_cents: number
        }[]
      }
      portal_operation_summary: {
        Args: { p_establishment_id: string }
        Returns: {
          booking_mode: Database["public"]["Enums"]["booking_mode"]
          completed_today: number
          confirmed_today: number
          finalized_30: number
          local_day: string
          no_show_30: number
          pending_approval: number
          queue_active: number
          revenue_today_cents: number
          scheduled_today: number
          timezone: string
        }[]
      }
      portal_reorder_queue_entry: {
        Args: {
          p_before_id: string
          p_entry_id: string
          p_establishment_id: string
        }
        Returns: undefined
      }
      portal_reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_establishment_id: string
          p_starts_at: string
        }
        Returns: string
      }
      queue_code_matches: {
        Args: { p_code: string; p_establishment_id: string }
        Returns: boolean
      }
      queue_confirm_arrival: {
        Args: { p_code?: string; p_entry_id: string }
        Returns: undefined
      }
      queue_join: {
        Args: {
          p_code?: string
          p_establishment_id: string
          p_professional_id?: string
          p_service_id?: string
        }
        Returns: string
      }
      queue_leave: { Args: { p_entry_id: string }; Returns: undefined }
      queue_maintenance: { Args: never; Returns: number }
      queue_new_code: { Args: never; Returns: string }
      queue_qr_code: { Args: { p_establishment_id: string }; Returns: string }
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
      queue_wait_for_newcomer: {
        Args: { p_establishment_id: string; p_professional_id?: string }
        Returns: number
      }
      register_push_device: {
        Args: {
          p_app: Database["public"]["Enums"]["notification_app"]
          p_device_name?: string
          p_expo_token: string
          p_platform: string
        }
        Returns: string
      }
      reply_support_ticket: {
        Args: { p_body: string; p_ticket_id: string }
        Returns: undefined
      }
      report_review: {
        Args: { p_justification: string; p_reason: string; p_review_id: string }
        Returns: string
      }
      resolve_signup_city: { Args: never; Returns: string }
      resubmit_establishment_application: {
        Args: { p_application: Json; p_establishment_id: string }
        Returns: string
      }
      review_in_moderation: { Args: { p_review_id: string }; Returns: boolean }
      review_report_reasons: { Args: never; Returns: string[] }
      rotate_queue_qr_code: {
        Args: { p_establishment_id: string }
        Returns: string
      }
      schedule_change_impact: {
        Args: {
          p_establishment_id: string
          p_professional_id?: string
          p_weekday?: number
          p_windows?: Json
        }
        Returns: {
          customer_name: string
          ends_at: string
          id: string
          professional_name: string
          service_name: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
        }[]
      }
      search_establishments: {
        Args: {
          p_category: Database["public"]["Enums"]["establishment_category"]
          p_city_id: string
          p_term: string
        }
        Returns: {
          accent_color: string
          booking_mode: Database["public"]["Enums"]["booking_mode"]
          category: Database["public"]["Enums"]["establishment_category"]
          deposit_percent: number
          id: string
          latitude: number
          longitude: number
          name: string
          neighborhood: string
          rating_avg: number
          rating_count: number
          slug: string
        }[]
      }
      shares_establishment_with: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      showcase_banners: {
        Args: never
        Returns: {
          id: string
          image_path: string
          subtitle: string
          target_kind: Database["public"]["Enums"]["showcase_target"]
          target_value: string
          title: string
        }[]
      }
      showcase_can_manage: { Args: never; Returns: boolean }
      showcase_is_live: {
        Args: {
          p_banner: Database["public"]["Tables"]["showcase_banners"]["Row"]
        }
        Returns: boolean
      }
      showcase_target_label: {
        Args: {
          p_banner: Database["public"]["Tables"]["showcase_banners"]["Row"]
        }
        Returns: string
      }
      showcase_window_text: {
        Args: { p_ends_at: string; p_starts_at: string }
        Returns: string
      }
      submit_lead: {
        Args: {
          p_category?: Database["public"]["Enums"]["establishment_category"]
          p_contact: string
          p_establishment_name: string
          p_message?: string
          p_name: string
          p_source?: string
        }
        Returns: string
      }
      support_attachment_ticket_id: {
        Args: { p_object_name: string }
        Returns: string
      }
      support_attachment_upload_allowed: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      support_attachments_orphans: {
        Args: never
        Returns: {
          created_at: string
          name: string
        }[]
      }
      support_attachments_prunable: {
        Args: never
        Returns: {
          attached: boolean
          name: string
        }[]
      }
      support_attachments_prune_metadata: {
        Args: { p_names: string[] }
        Returns: number
      }
      support_priority_label: {
        Args: {
          p_priority: Database["public"]["Enums"]["support_ticket_priority"]
        }
        Returns: string
      }
      support_status_label: {
        Args: { p_status: Database["public"]["Enums"]["support_ticket_status"] }
        Returns: string
      }
      support_ticket_attachments: {
        Args: { p_ticket_id: string }
        Returns: {
          created_at: string
          file_name: string
          from_staff: boolean
          id: string
          message_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }[]
      }
      support_ticket_can_access: {
        Args: { p_ticket_id: string }
        Returns: boolean
      }
      unregister_push_device: {
        Args: { p_expo_token: string }
        Returns: undefined
      }
    }
    Enums: {
      application_decision: "approved" | "rejected" | "correction"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled_by_customer"
        | "cancelled_by_establishment"
        | "no_show"
      assistant_role: "user" | "assistant"
      booking_mode: "scheduled" | "queue" | "both"
      city_launch_status: "active" | "pre_launch" | "evaluating"
      establishment_category:
        | "barbershop"
        | "salon"
        | "aesthetic_clinic"
        | "dermatology"
        | "petshop"
        | "nail_salon"
        | "dentistry"
        | "massage"
      establishment_invite_status: "pending" | "accepted" | "revoked"
      establishment_role: "owner" | "manager" | "staff"
      establishment_status: "pending" | "active" | "suspended" | "rejected"
      lead_status: "new" | "contacted" | "discarded"
      notification_app: "cliente" | "staff"
      notification_channel: "push" | "email" | "sms" | "whatsapp"
      notification_status:
        | "pending"
        | "sending"
        | "sent"
        | "failed"
        | "unconfigured"
        | "skipped"
      payment_method: "pix" | "credit_card" | "debit_card" | "cash" | "other"
      payment_status:
        | "pending"
        | "authorized"
        | "paid"
        | "refunded"
        | "partially_refunded"
        | "failed"
        | "cancelled"
      plan_kind: "monthly" | "commission"
      platform_role: "admin" | "operations" | "finance" | "support"
      queue_arrival_method: "qr" | "staff" | "location"
      queue_notify_channel: "push" | "sms" | "whatsapp"
      queue_source: "app" | "qr" | "counter"
      queue_status:
        | "waiting"
        | "called"
        | "in_service"
        | "done"
        | "left"
        | "no_show"
      review_report_status:
        | "open"
        | "awaiting_establishment"
        | "kept"
        | "removed"
      showcase_target: "establishment" | "category" | "url"
      support_requester_kind: "establishment" | "customer"
      support_ticket_category:
        | "account"
        | "billing"
        | "booking"
        | "payment"
        | "technical"
        | "other"
      support_ticket_priority: "low" | "normal" | "high"
      support_ticket_status: "open" | "waiting_customer" | "resolved"
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
      application_decision: ["approved", "rejected", "correction"],
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
      city_launch_status: ["active", "pre_launch", "evaluating"],
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
      establishment_invite_status: ["pending", "accepted", "revoked"],
      establishment_role: ["owner", "manager", "staff"],
      establishment_status: ["pending", "active", "suspended", "rejected"],
      lead_status: ["new", "contacted", "discarded"],
      notification_app: ["cliente", "staff"],
      notification_channel: ["push", "email", "sms", "whatsapp"],
      notification_status: [
        "pending",
        "sending",
        "sent",
        "failed",
        "unconfigured",
        "skipped",
      ],
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
      plan_kind: ["monthly", "commission"],
      platform_role: ["admin", "operations", "finance", "support"],
      queue_arrival_method: ["qr", "staff", "location"],
      queue_notify_channel: ["push", "sms", "whatsapp"],
      queue_source: ["app", "qr", "counter"],
      queue_status: [
        "waiting",
        "called",
        "in_service",
        "done",
        "left",
        "no_show",
      ],
      review_report_status: [
        "open",
        "awaiting_establishment",
        "kept",
        "removed",
      ],
      showcase_target: ["establishment", "category", "url"],
      support_requester_kind: ["establishment", "customer"],
      support_ticket_category: [
        "account",
        "billing",
        "booking",
        "payment",
        "technical",
        "other",
      ],
      support_ticket_priority: ["low", "normal", "high"],
      support_ticket_status: ["open", "waiting_customer", "resolved"],
    },
  },
} as const

