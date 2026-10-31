export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: NonNullable<Json>
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: 'app_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          metadata: NonNullable<Json>
          target_id: string | null
          target_table: string
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          metadata?: NonNullable<Json>
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          metadata?: NonNullable<Json>
          target_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          full_name: string
          gender: string | null
          id: string
          joined_on: string
          profile_id: string | null
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          full_name: string
          gender?: string | null
          id?: string
          joined_on?: string
          profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          joined_on?: string
          profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'players_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          full_name: string
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      registration_requests: {
        Row: {
          decision_note: string | null
          email: string
          full_name: string
          id: string
          linked_player_id: string | null
          profile_id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        ComputedFields: never
        Insert: {
          decision_note?: string | null
          email: string
          full_name: string
          id?: string
          linked_player_id?: string | null
          profile_id: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          decision_note?: string | null
          email?: string
          full_name?: string
          id?: string
          linked_player_id?: string | null
          profile_id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'registration_requests_linked_player_id_fkey'
            columns: ['linked_player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registration_requests_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registration_requests_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      sp_accounts: {
        Row: {
          created_at: string
          current_sp: number
          player_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          current_sp?: number
          player_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_sp?: number
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sp_accounts_player_id_fkey'
            columns: ['player_id']
            isOneToOne: true
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      sp_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string
          metadata: NonNullable<Json>
          player_id: string
          reference_id: string | null
          reference_type: string | null
          rule_version: string | null
          sp_after: number
          sp_before: number
          sp_delta: number
          transaction_type: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key: string
          metadata?: NonNullable<Json>
          player_id: string
          reference_id?: string | null
          reference_type?: string | null
          rule_version?: string | null
          sp_after: number
          sp_before: number
          sp_delta: number
          transaction_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string
          metadata?: NonNullable<Json>
          player_id?: string
          reference_id?: string | null
          reference_type?: string | null
          rule_version?: string | null
          sp_after?: number
          sp_before?: number
          sp_delta?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sp_transactions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sp_transactions_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          profile_id: string
          role_id: string
        }
        ComputedFields: never
        Insert: {
          granted_at?: string
          granted_by?: string | null
          profile_id: string
          role_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_roles_granted_by_fkey'
            columns: ['granted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_roles_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_roles_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_registration: {
        Args: { p_player_id?: string; p_request_id: string; p_role_keys?: string[] }
        Returns: Json
      }
      grant_starting_sp: {
        Args: { p_player_id: string; p_registration_request_id?: string }
        Returns: Json
      }
      has_role: { Args: { p_profile_id: string; p_role_key: string }; Returns: boolean }
      reject_registration: { Args: { p_reason: string; p_request_id: string }; Returns: Json }
      require_super_admin: { Args: Record<PropertyKey, never>; Returns: string }
      set_profile_status: { Args: { p_profile_id: string; p_status: string }; Returns: Json }
      submit_registration: { Args: { p_full_name?: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
