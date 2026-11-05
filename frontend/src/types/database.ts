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
      match_games: {
        Row: {
          away_points: number
          game_number: number
          home_points: number
          match_id: string
        }
        ComputedFields: never
        Insert: {
          away_points: number
          game_number: number
          home_points: number
          match_id: string
        }
        Update: {
          away_points?: number
          game_number?: number
          home_points?: number
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'match_games_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: {
          away_entry_id: string | null
          away_source_match_id: string | null
          away_source_outcome: string | null
          bracket: string
          conditional: boolean
          created_at: string
          event_id: string
          finalized_at: string | null
          home_entry_id: string | null
          home_source_match_id: string | null
          home_source_outcome: string | null
          id: string
          position: number
          recorded_at: string | null
          recorded_by: string | null
          reset: boolean
          result_kind: string
          round: number
          status: string
          updated_at: string
          winner_entry_id: string | null
        }
        ComputedFields: never
        Insert: {
          away_entry_id?: string | null
          away_source_match_id?: string | null
          away_source_outcome?: string | null
          bracket: string
          conditional?: boolean
          created_at?: string
          event_id: string
          finalized_at?: string | null
          home_entry_id?: string | null
          home_source_match_id?: string | null
          home_source_outcome?: string | null
          id?: string
          position: number
          recorded_at?: string | null
          recorded_by?: string | null
          reset?: boolean
          result_kind?: string
          round: number
          status?: string
          updated_at?: string
          winner_entry_id?: string | null
        }
        Update: {
          away_entry_id?: string | null
          away_source_match_id?: string | null
          away_source_outcome?: string | null
          bracket?: string
          conditional?: boolean
          created_at?: string
          event_id?: string
          finalized_at?: string | null
          home_entry_id?: string | null
          home_source_match_id?: string | null
          home_source_outcome?: string | null
          id?: string
          position?: number
          recorded_at?: string | null
          recorded_by?: string | null
          reset?: boolean
          result_kind?: string
          round?: number
          status?: string
          updated_at?: string
          winner_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'matches_away_entry_id_fkey'
            columns: ['away_entry_id']
            isOneToOne: false
            referencedRelation: 'tournament_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_away_source_match_id_fkey'
            columns: ['away_source_match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'tournament_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_home_entry_id_fkey'
            columns: ['home_entry_id']
            isOneToOne: false
            referencedRelation: 'tournament_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_home_source_match_id_fkey'
            columns: ['home_source_match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_winner_entry_id_fkey'
            columns: ['winner_entry_id']
            isOneToOne: false
            referencedRelation: 'tournament_entries'
            referencedColumns: ['id']
          },
        ]
      }
      payment_receipts: {
        Row: {
          amount: number
          created_at: string
          entry_payment_id: string | null
          fee_period_id: string | null
          id: string
          jersey_payment_id: string | null
          method: string
          paid_on: string
          player_id: string
          purpose: string
          receipt_path: string
          reference_no: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          target_label: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          entry_payment_id?: string | null
          fee_period_id?: string | null
          id?: string
          jersey_payment_id?: string | null
          method?: string
          paid_on?: string
          player_id: string
          purpose: string
          receipt_path: string
          reference_no?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          target_label: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          entry_payment_id?: string | null
          fee_period_id?: string | null
          id?: string
          jersey_payment_id?: string | null
          method?: string
          paid_on?: string
          player_id?: string
          purpose?: string
          receipt_path?: string
          reference_no?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          target_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payment_receipts_entry_payment_id_fkey'
            columns: ['entry_payment_id']
            isOneToOne: false
            referencedRelation: 'tournament_entry_payments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_receipts_fee_period_id_fkey'
            columns: ['fee_period_id']
            isOneToOne: false
            referencedRelation: 'training_fee_periods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_receipts_jersey_payment_id_fkey'
            columns: ['jersey_payment_id']
            isOneToOne: false
            referencedRelation: 'jersey_order_payments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_receipts_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_receipts_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_receipts_submitted_by_fkey'
            columns: ['submitted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      placement_credits: {
        Row: {
          id: string
          match_id: string
          player_id: string
          recorded_at: string
          rule_version: string | null
          source: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        ComputedFields: never
        Insert: {
          id?: string
          match_id: string
          player_id: string
          recorded_at?: string
          rule_version?: string | null
          source: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          id?: string
          match_id?: string
          player_id?: string
          recorded_at?: string
          rule_version?: string | null
          source?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'placement_credits_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'placement_credits_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      placement_qualifications: {
        Row: {
          created_at: string
          credit_count: number
          player_id: string
          published_sp: number
          qualified_at: string
          rule_version: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          credit_count: number
          player_id: string
          published_sp: number
          qualified_at?: string
          rule_version?: string | null
        }
        Update: {
          created_at?: string
          credit_count?: number
          player_id?: string
          published_sp?: number
          qualified_at?: string
          rule_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'placement_qualifications_player_id_fkey'
            columns: ['player_id']
            isOneToOne: true
            referencedRelation: 'players'
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
          player_code: string
          profile_id: string | null
          rating_status: string
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
          rating_status?: string
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
          rating_status?: string
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
      player_friendships: {
        Row: {
          addressee_player_id: string
          created_at: string
          id: string
          requested_at: string
          requester_player_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          addressee_player_id: string
          created_at?: string
          id?: string
          requested_at?: string
          requester_player_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_player_id?: string
          created_at?: string
          id?: string
          requested_at?: string
          requester_player_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'player_friendships_addressee_player_id_fkey'
            columns: ['addressee_player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'player_friendships_requester_player_id_fkey'
            columns: ['requester_player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          actor_profile_id: string | null
          body: string | null
          created_at: string
          id: string
          link_path: string | null
          profile_id: string
          read_at: string | null
          title: string
          tournament_id: string | null
          type: string
        }
        ComputedFields: never
        Insert: {
          actor_profile_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link_path?: string | null
          profile_id: string
          read_at?: string | null
          title: string
          tournament_id?: string | null
          type: string
        }
        Update: {
          actor_profile_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link_path?: string | null
          profile_id?: string
          read_at?: string | null
          title?: string
          tournament_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_profile_id_fkey'
            columns: ['actor_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
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
      season_balances: {
        Row: {
          created_at: string
          player_id: string
          season_id: string
          seasonal_sp: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          player_id: string
          season_id: string
          seasonal_sp?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          player_id?: string
          season_id?: string
          seasonal_sp?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'season_balances_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'season_balances_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
      season_deduction_batches: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          generated_at: string
          id: string
          rejection_reason: string | null
          season_id: string
          status: string
        }
        ComputedFields: never
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          generated_at?: string
          id?: string
          rejection_reason?: string | null
          season_id: string
          status?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          generated_at?: string
          id?: string
          rejection_reason?: string | null
          season_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'season_deduction_batches_decided_by_fkey'
            columns: ['decided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'season_deduction_batches_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
      season_deduction_entries: {
        Row: {
          applied_amount: number | null
          batch_id: string
          created_at: string
          id: string
          player_id: string
          position: number
          proposed_amount: number
          tier: number
          transaction_id: string | null
          waived_amount: number | null
        }
        ComputedFields: never
        Insert: {
          applied_amount?: number | null
          batch_id: string
          created_at?: string
          id?: string
          player_id: string
          position: number
          proposed_amount: number
          tier: number
          transaction_id?: string | null
          waived_amount?: number | null
        }
        Update: {
          applied_amount?: number | null
          batch_id?: string
          created_at?: string
          id?: string
          player_id?: string
          position?: number
          proposed_amount?: number
          tier?: number
          transaction_id?: string | null
          waived_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'season_deduction_entries_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'season_deduction_batches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'season_deduction_entries_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'season_deduction_entries_transaction_id_fkey'
            columns: ['transaction_id']
            isOneToOne: false
            referencedRelation: 'sp_transactions'
            referencedColumns: ['id']
          },
        ]
      }
      season_player_results: {
        Row: {
          current_sp: number
          deduction_position: number | null
          excluded_reason: string | null
          game_difference: number | null
          id: string
          matches_played: number | null
          player_id: string
          point_difference: number | null
          position: number | null
          previous_position: number | null
          recorded_at: string
          rule_version: string | null
          season_id: string
          seasonal_sp: number
          tournament_matches: number | null
          tournament_wins: number | null
          wins: number | null
        }
        ComputedFields: never
        Insert: {
          current_sp: number
          deduction_position?: number | null
          excluded_reason?: string | null
          game_difference?: number | null
          id?: string
          matches_played?: number | null
          player_id: string
          point_difference?: number | null
          position?: number | null
          previous_position?: number | null
          recorded_at?: string
          rule_version?: string | null
          season_id: string
          seasonal_sp: number
          tournament_matches?: number | null
          tournament_wins?: number | null
          wins?: number | null
        }
        Update: {
          current_sp?: number
          deduction_position?: number | null
          excluded_reason?: string | null
          game_difference?: number | null
          id?: string
          matches_played?: number | null
          player_id?: string
          point_difference?: number | null
          position?: number | null
          previous_position?: number | null
          recorded_at?: string
          rule_version?: string | null
          season_id?: string
          seasonal_sp?: number
          tournament_matches?: number | null
          tournament_wins?: number | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'season_player_results_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'season_player_results_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
      season_transition_steps: {
        Row: {
          attempts: number
          completed_at: string | null
          last_error: string | null
          season_id: string
          status: string
          step: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          attempts?: number
          completed_at?: string | null
          last_error?: string | null
          season_id: string
          status?: string
          step: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          last_error?: string | null
          season_id?: string
          status?: string
          step?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'season_transition_steps_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
      season_transitions: {
        Row: {
          attempts: number
          completed_at: string | null
          id: string
          last_error: string | null
          season_id: string
          started_at: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          attempts?: number
          completed_at?: string | null
          id?: string
          last_error?: string | null
          season_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          id?: string
          last_error?: string | null
          season_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'season_transitions_season_id_fkey'
            columns: ['season_id']
            isOneToOne: true
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
      seasons: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          label: string
          started_at: string | null
          starts_on: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          label: string
          started_at?: string | null
          starts_on: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          label?: string
          started_at?: string | null
          starts_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'seasons_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
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
      sp_rule_versions: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          effective_from: string | null
          id: string
          is_enabled: boolean
          notes: string | null
          status: string
          updated_at: string
          version: string
        }
        ComputedFields: never
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sp_rule_versions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
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
      training_attendance: {
        Row: {
          player_id: string
          recorded_at: string
          recorded_by: string | null
          session_id: string
          status: string
        }
        ComputedFields: never
        Insert: {
          player_id: string
          recorded_at?: string
          recorded_by?: string | null
          session_id: string
          status?: string
        }
        Update: {
          player_id?: string
          recorded_at?: string
          recorded_by?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'training_attendance_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'training_attendance_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'training_attendance_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'training_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      training_fee_periods: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          due_on: string | null
          ends_on: string
          id: string
          label: string
          starts_on: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          ends_on: string
          id?: string
          label: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          ends_on?: string
          id?: string
          label?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'training_fee_periods_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      training_payments: {
        Row: {
          amount: number
          created_at: string
          fee_period_id: string
          id: string
          method: string
          paid_on: string
          player_id: string
          recorded_by: string | null
          status: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          fee_period_id: string
          id?: string
          method?: string
          paid_on?: string
          player_id: string
          recorded_by?: string | null
          status?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          fee_period_id?: string
          id?: string
          method?: string
          paid_on?: string
          player_id?: string
          recorded_by?: string | null
          status?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'training_payments_fee_period_id_fkey'
            columns: ['fee_period_id']
            isOneToOne: false
            referencedRelation: 'training_fee_periods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'training_payments_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'training_payments_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'training_payments_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      training_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          notes: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          venue: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'training_sessions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          status: string
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendly_matches: {
        Row: {
          auto_approval_due_at: string | null
          challenger_approved_at: string | null
          challenger_id: string
          challenger_partner_approved_at: string | null
          challenger_partner_id: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          dispute_reason: string | null
          disputed_at: string | null
          id: string
          match_type: string
          note: string | null
          opponent_approved_at: string | null
          opponent_id: string
          opponent_partner_approved_at: string | null
          opponent_partner_id: string | null
          responded_at: string | null
          responded_by: string | null
          result_kind: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          auto_approval_due_at?: string | null
          challenger_approved_at?: string | null
          challenger_id: string
          challenger_partner_approved_at?: string | null
          challenger_partner_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          id?: string
          match_type?: string
          note?: string | null
          opponent_approved_at?: string | null
          opponent_id: string
          opponent_partner_approved_at?: string | null
          opponent_partner_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          result_kind?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          auto_approval_due_at?: string | null
          challenger_approved_at?: string | null
          challenger_id?: string
          challenger_partner_approved_at?: string | null
          challenger_partner_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          id?: string
          match_type?: string
          note?: string | null
          opponent_approved_at?: string | null
          opponent_id?: string
          opponent_partner_approved_at?: string | null
          opponent_partner_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          result_kind?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'friendly_matches_challenger_id_fkey'
            columns: ['challenger_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friendly_matches_challenger_partner_id_fkey'
            columns: ['challenger_partner_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friendly_matches_opponent_id_fkey'
            columns: ['opponent_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friendly_matches_opponent_partner_id_fkey'
            columns: ['opponent_partner_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friendly_matches_winner_id_fkey'
            columns: ['winner_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      jersey_designs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          position: number
          project_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name: string
          position?: number
          project_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name?: string
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'jersey_designs_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'jersey_projects'
            referencedColumns: ['id']
          },
        ]
      }
      jersey_orders: {
        Row: {
          created_at: string
          created_by: string | null
          design_id: string
          id: string
          player_id: string
          project_id: string
          quantity: number
          size_id: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          design_id: string
          id?: string
          player_id: string
          project_id: string
          quantity?: number
          size_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          design_id?: string
          id?: string
          player_id?: string
          project_id?: string
          quantity?: number
          size_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'jersey_orders_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'jersey_projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jersey_orders_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      jersey_order_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          marked_at: string | null
          marked_by: string | null
          note: string | null
          order_id: string
          player_id: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          order_id: string
          player_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          order_id?: string
          player_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'jersey_order_payments_marked_by_fkey'
            columns: ['marked_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jersey_order_payments_order_id_fkey'
            columns: ['order_id']
            isOneToOne: true
            referencedRelation: 'jersey_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jersey_order_payments_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      jersey_projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          order_deadline: string | null
          price: number | null
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          order_deadline?: string | null
          price?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          order_deadline?: string | null
          price?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      jersey_sizes: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          project_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          label: string
          position?: number
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'jersey_sizes_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'jersey_projects'
            referencedColumns: ['id']
          },
        ]
      }
      poll_options: {
        Row: {
          created_at: string
          id: string
          label: string
          poll_id: string
          position: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          label: string
          poll_id: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'poll_options_poll_id_fkey'
            columns: ['poll_id']
            isOneToOne: false
            referencedRelation: 'polls'
            referencedColumns: ['id']
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          option_id: string
          player_id: string
          poll_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          option_id: string
          player_id: string
          poll_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          player_id?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'poll_votes_poll_id_fkey'
            columns: ['poll_id']
            isOneToOne: false
            referencedRelation: 'polls'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'poll_votes_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      polls: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_anonymous: boolean
          mode: string
          opens_at: string | null
          question: string
          show_results: boolean
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_anonymous?: boolean
          mode?: string
          opens_at?: string | null
          question: string
          show_results?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_anonymous?: boolean
          mode?: string
          opens_at?: string | null
          question?: string
          show_results?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          guest_gender: string | null
          guest_name: string | null
          id: string
          player_id: string | null
          team_id: string
        }
        ComputedFields: never
        Insert: {
          guest_gender?: string | null
          guest_name?: string | null
          id?: string
          player_id?: string | null
          team_id: string
        }
        Update: {
          guest_gender?: string | null
          guest_name?: string | null
          id?: string
          player_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'team_members_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_members_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'teams_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'tournament_events'
            referencedColumns: ['id']
          },
        ]
      }
      tournament_entry_payments: {
        Row: {
          amount: number
          created_at: string
          entry_id: string
          guest_name: string | null
          id: string
          marked_at: string | null
          marked_by: string | null
          note: string | null
          player_id: string | null
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount?: number
          created_at?: string
          entry_id: string
          guest_name?: string | null
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          player_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          entry_id?: string
          guest_name?: string | null
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          player_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_entry_payments_entry_id_fkey'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'tournament_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_entry_payments_marked_by_fkey'
            columns: ['marked_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_entry_payments_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      tournament_partner_invitations: {
        Row: {
          created_at: string
          created_by: string | null
          entry_id: string | null
          event_id: string
          id: string
          inviter_player_id: string
          partner_player_id: string
          responded_at: string | null
          status: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_id?: string | null
          event_id: string
          id?: string
          inviter_player_id: string
          partner_player_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_id?: string | null
          event_id?: string
          id?: string
          inviter_player_id?: string
          partner_player_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_partner_invitations_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_partner_invitations_entry_id_fkey'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'tournament_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_partner_invitations_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'tournament_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_partner_invitations_inviter_player_id_fkey'
            columns: ['inviter_player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_partner_invitations_partner_player_id_fkey'
            columns: ['partner_player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      tournament_entries: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          player_id: string | null
          seed: number | null
          status: string
          team_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          player_id?: string | null
          seed?: number | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          player_id?: string | null
          seed?: number | null
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_entries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_entries_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'tournament_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_entries_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_entries_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }
      tournament_events: {
        Row: {
          created_at: string
          discipline: string
          draw_generated_at: string | null
          format: string
          id: string
          max_entries: number
          tournament_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          discipline: string
          draw_generated_at?: string | null
          format: string
          id?: string
          max_entries: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discipline?: string
          draw_generated_at?: string | null
          format?: string
          id?: string
          max_entries?: number
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_events_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string
          entrance_fee: number
          id: string
          name: string
          poster_path: string | null
          registration_deadline: string | null
          starts_on: string
          status: string
          updated_at: string
          venue: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on: string
          entrance_fee?: number
          id?: string
          name: string
          poster_path?: string | null
          registration_deadline?: string | null
          starts_on: string
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string
          entrance_fee?: number
          id?: string
          name?: string
          poster_path?: string | null
          registration_deadline?: string | null
          starts_on?: string
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tournaments_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
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
      placement_audit: {
        Row: {
          credits: number
          current_sp: number
          full_name: string
          player_id: string
          published_sp: number | null
          qualification_rule_version: string | null
          qualified_at: string | null
          rating_status: string
          required: number
        }
        Relationships: []
      }
      placement_progress: {
        Row: {
          credits: number
          player_id: string
          qualified_at: string | null
          rating_status: string
          required: number
        }
        Relationships: []
      }
      published_sp_balances: {
        Row: {
          current_sp: number
          player_id: string
          updated_at: string
        }
        Relationships: []
      }
      published_sp_leaderboard: {
        Row: {
          current_sp: number
          full_name: string
          player_id: string
          rating_status: string
          status: string
          updated_at: string
        }
        Relationships: []
      }
      published_sp_transactions: {
        Row: {
          created_at: string
          id: string
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
        Relationships: []
      }
    }
    Functions: {
      apply_match_result: {
        Args: { p_actor: string; p_games: Json; p_match_id: string }
        Returns: Json
      }
      approve_registration: {
        Args: { p_player_id?: string; p_request_id: string; p_role_keys?: string[] }
        Returns: Json
      }
      can_view_tournament: {
        Args: { p_profile_id: string; p_tournament_id: string }
        Returns: boolean
      }
      cancel_tournament_partner_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      close_season: { Args: { p_season_id: string }; Returns: Json }
      correct_match_result: {
        Args: { p_games: Json; p_match_id: string; p_reason: string }
        Returns: Json
      }
      create_season: {
        Args: { p_ends_on: string; p_label: string; p_starts_on: string }
        Returns: Json
      }
      decide_season_deduction_batch: {
        Args: { p_approve: boolean; p_batch_id: string; p_reason?: string | null }
        Returns: Json
      }
      run_season_transition: { Args: { p_force?: boolean }; Returns: Json }
      seasonal_standings: { Args: { p_season_id?: string | null }; Returns: Json }
      start_season: { Args: { p_season_id: string }; Returns: Json }
      create_tournament: {
        Args: {
          p_description?: string | null
          p_ends_on: string
          p_entrance_fee?: number
          p_name: string
          p_registration_deadline?: string | null
          p_starts_on: string
          p_venue?: string | null
        }
        Returns: Json
      }
      create_tournament_event: {
        Args: {
          p_discipline: string
          p_format: string
          p_max_entries: number
          p_tournament_id: string
        }
        Returns: Json
      }
      entry_payment_complete: { Args: { p_entry_id: string }; Returns: boolean }
      grant_starting_sp: {
        Args: { p_player_id: string; p_registration_request_id?: string }
        Returns: Json
      }
      has_role: { Args: { p_profile_id: string; p_role_key: string }; Returns: boolean }
      is_club_member: { Args: { p_profile_id: string }; Returns: boolean }
      is_friend: { Args: { p_first: string; p_second: string }; Returns: boolean }
      is_tournament_staff: { Args: { p_profile_id: string }; Returns: boolean }
      join_tournament_event: {
        Args: {
          p_event_id: string
          p_guest_name?: string | null
          p_partner_player_id?: string | null
        }
        Returns: Json
      }
      link_player_account: {
        Args: { p_player_id: string; p_profile_id: string }
        Returns: Json
      }
      mark_all_notifications_read: {
        Args: Record<string, never>
        Returns: Json
      }
      mark_match_unplayed: {
        Args: {
          p_match_id: string
          p_reason: string
          p_result_kind: string
          p_winner_entry_id: string
        }
        Returns: Json
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      record_match_result: {
        Args: { p_games: Json; p_match_id: string }
        Returns: Json
      }
      reconcile_sp_balances: {
        Args: Record<string, never>
        Returns: Json
      }
      register_tournament_entry: {
        Args: { p_event_id: string; p_player_ids: string[]; p_seed?: number | null }
        Returns: Json
      }
      reject_registration: { Args: { p_reason: string; p_request_id: string }; Returns: Json }
      remove_player_friend: { Args: { p_player_id: string }; Returns: Json }
      require_super_admin: { Args: Record<PropertyKey, never>; Returns: string }
      require_tournament_staff: { Args: Record<PropertyKey, never>; Returns: string }
      respond_player_friend_request: {
        Args: { p_accept: boolean; p_friendship_id: string }
        Returns: Json
      }
      respond_tournament_partner_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: Json
      }
      save_tournament_draw: {
        Args: { p_event_id: string; p_matches: Json; p_replace?: boolean }
        Returns: Json
      }
      score_match_games: {
        Args: { p_away_entry_id: string; p_games: Json; p_home_entry_id: string }
        Returns: Json
      }
      send_player_friend_request: { Args: { p_player_code: string }; Returns: Json }
      set_entry_payment: {
        Args: { p_note?: string | null; p_payment_id: string; p_status: string }
        Returns: Json
      }
      set_jersey_order_payment: {
        Args: { p_note?: string | null; p_payment_id: string; p_status: string }
        Returns: Json
      }
      set_profile_roles: { Args: { p_profile_id: string; p_role_keys: string[] }; Returns: Json }
      set_profile_status: { Args: { p_profile_id: string; p_status: string }; Returns: Json }
      set_tournament_entrance_fee: {
        Args: { p_fee: number; p_tournament_id: string }
        Returns: Json
      }
      set_tournament_poster: {
        Args: { p_poster_path: string | null; p_tournament_id: string }
        Returns: Json
      }
      set_tournament_status: {
        Args: { p_status: string; p_tournament_id: string }
        Returns: Json
      }
      submit_payment_receipt: {
        Args: {
          p_amount: number
          p_method: string
          p_paid_on: string
          p_purpose: string
          p_receipt_path: string
          p_reference_no: string | null
          p_target_id: string
        }
        Returns: Json
      }
      submit_registration: { Args: { p_full_name?: string }; Returns: Json }
      unlink_player_account: { Args: { p_player_id: string }; Returns: Json }
      update_tournament_event: {
        Args: { p_event_id: string; p_format: string; p_max_entries: number }
        Returns: Json
      }
      withdraw_tournament_entry: {
        Args: { p_entry_id: string }
        Returns: Json
      }
      withdraw_own_tournament_entry: {
        Args: { p_entry_id: string }
        Returns: Json
      }
      create_training_session: {
        Args: {
          p_ends_at: string
          p_notes?: string | null
          p_starts_at: string
          p_title: string
          p_venue?: string | null
        }
        Returns: Json
      }
      set_training_session_status: {
        Args: { p_session_id: string; p_status: string }
        Returns: Json
      }
      mark_training_attendance: {
        Args: { p_entries: Json; p_session_id: string }
        Returns: Json
      }
      create_training_fee_period: {
        Args: {
          p_amount: number
          p_due_on?: string | null
          p_ends_on: string
          p_label: string
          p_starts_on: string
        }
        Returns: Json
      }
      record_training_payment: {
        Args: {
          p_amount: number
          p_fee_period_id: string
          p_method?: string | null
          p_paid_on?: string | null
          p_player_id: string
        }
        Returns: Json
      }
      void_training_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: Json
      }
      add_jersey_design: {
        Args: { p_description?: string | null; p_name: string; p_project_id: string }
        Returns: Json
      }
      add_jersey_size: { Args: { p_label: string; p_project_id: string }; Returns: Json }
      cancel_jersey_order: { Args: { p_order_id: string }; Returns: Json }
      cast_poll_vote: { Args: { p_option_ids: string[]; p_poll_id: string }; Returns: Json }
      create_announcement: { Args: { p_body: string; p_title: string }; Returns: Json }
      create_jersey_project: {
        Args: {
          p_description?: string | null
          p_name: string
          p_order_deadline?: string | null
          p_price?: number | null
        }
        Returns: Json
      }
      create_poll: {
        Args: {
          p_closes_at?: string | null
          p_description?: string | null
          p_is_anonymous?: boolean
          p_mode?: string
          p_opens_at?: string | null
          p_options: Json
          p_question: string
          p_show_results?: boolean
        }
        Returns: Json
      }
      poll_results: { Args: { p_poll_id: string }; Returns: Json }
      approve_friendly_result: { Args: { p_match_id: string }; Returns: Json }
      auto_approve_friendly_matches: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cancel_friendly_challenge: { Args: { p_match_id: string }; Returns: Json }
      create_doubles_friendly_challenge: {
        Args: { p_note?: string | null; p_opponent_id: string; p_partner_id: string }
        Returns: Json
      }
      create_friendly_challenge: {
        Args: { p_note?: string | null; p_opponent_id: string }
        Returns: Json
      }
      dispute_friendly_result: {
        Args: { p_match_id: string; p_reason: string }
        Returns: Json
      }
      respond_doubles_friendly_challenge: {
        Args: { p_accept: boolean; p_match_id: string; p_partner_id?: string | null }
        Returns: Json
      }
      respond_friendly_challenge: {
        Args: { p_accept: boolean; p_match_id: string }
        Returns: Json
      }
      submit_friendly_result: {
        Args: { p_match_id: string; p_winner_id: string }
        Returns: Json
      }
      set_jersey_design_image: {
        Args: { p_design_id: string; p_image_path: string | null }
        Returns: Json
      }
      set_announcement_status: {
        Args: { p_announcement_id: string; p_status: string }
        Returns: Json
      }
      set_jersey_project_status: {
        Args: { p_project_id: string; p_status: string }
        Returns: Json
      }
      set_poll_status: { Args: { p_poll_id: string; p_status: string }; Returns: Json }
      submit_jersey_order: {
        Args: {
          p_design_id: string
          p_project_id: string
          p_quantity?: number
          p_size_id: string
        }
        Returns: Json
      }
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
