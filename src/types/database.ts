export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      action_submissions: {
        Row: {
          created_at: string
          game_id: string
          id: string
          status: string
          submitted_by_player_id: string
          target_player_id: string
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          status?: string
          submitted_by_player_id: string
          target_player_id: string
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          status?: string
          submitted_by_player_id?: string
          target_player_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_submissions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_submissions_submitted_by_player_id_fkey"
            columns: ["submitted_by_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_submissions_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      action_upvotes: {
        Row: {
          created_at: string
          id: string
          submission_id: string
          voter_player_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          submission_id: string
          voter_player_id: string
        }
        Update: {
          created_at?: string
          id?: string
          submission_id?: string
          voter_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_upvotes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "action_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_upvotes_voter_player_id_fkey"
            columns: ["voter_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      board_squares: {
        Row: {
          board_id: string
          col_index: number
          created_at: string
          id: string
          locked_at: string | null
          marked_at: string | null
          row_index: number
          selected_action_id: string | null
          state: string
        }
        Insert: {
          board_id: string
          col_index: number
          created_at?: string
          id?: string
          locked_at?: string | null
          marked_at?: string | null
          row_index: number
          selected_action_id?: string | null
          state?: string
        }
        Update: {
          board_id?: string
          col_index?: number
          created_at?: string
          id?: string
          locked_at?: string | null
          marked_at?: string | null
          row_index?: number
          selected_action_id?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_squares_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_squares_selected_action_id_fkey"
            columns: ["selected_action_id"]
            isOneToOne: false
            referencedRelation: "selected_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          game_id: string
          id: string
          owner_player_id: string
          state: string
          target_player_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          owner_player_id: string
          state?: string
          target_player_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          owner_player_id?: string
          state?: string
          target_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_owner_player_id_fkey"
            columns: ["owner_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      event_log: {
        Row: {
          actor_player_id: string | null
          created_at: string
          event_type: string
          game_id: string
          id: string
          payload: Json
          visibility: string
        }
        Insert: {
          actor_player_id?: string | null
          created_at?: string
          event_type: string
          game_id: string
          id?: string
          payload?: Json
          visibility?: string
        }
        Update: {
          actor_player_id?: string | null
          created_at?: string
          event_type?: string
          game_id?: string
          id?: string
          payload?: Json
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_log_actor_player_id_fkey"
            columns: ["actor_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_log_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          display_name: string
          game_id: string
          guesses_remaining: number | null
          id: string
          joined_at: string
          role: string
          score: number
          status: string
          user_id: string
        }
        Insert: {
          display_name: string
          game_id: string
          guesses_remaining?: number | null
          id?: string
          joined_at?: string
          role?: string
          score?: number
          status?: string
          user_id: string
        }
        Update: {
          display_name?: string
          game_id?: string
          guesses_remaining?: number | null
          id?: string
          joined_at?: string
          role?: string
          score?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_settings: {
        Row: {
          actions_per_target: number
          allow_diagonals: boolean
          allow_self_upvote: boolean
          allow_submitter_identity_during_game: boolean
          board_cols: number
          board_rows: number
          created_at: string
          end_condition: string
          free_space_col: number | null
          free_space_row: number | null
          game_id: string
          giveaway_penalty_points: number
          guesses_per_target: number
          has_free_space: boolean
          multi_bingo_points: number
          normal_bingo_points: number
          pre_action_guess_points: number
          reveal_marks_after_round: boolean
          updated_at: string
        }
        Insert: {
          actions_per_target?: number
          allow_diagonals?: boolean
          allow_self_upvote?: boolean
          allow_submitter_identity_during_game?: boolean
          board_cols?: number
          board_rows?: number
          created_at?: string
          end_condition?: string
          free_space_col?: number | null
          free_space_row?: number | null
          game_id: string
          giveaway_penalty_points?: number
          guesses_per_target?: number
          has_free_space?: boolean
          multi_bingo_points?: number
          normal_bingo_points?: number
          pre_action_guess_points?: number
          reveal_marks_after_round?: boolean
          updated_at?: string
        }
        Update: {
          actions_per_target?: number
          allow_diagonals?: boolean
          allow_self_upvote?: boolean
          allow_submitter_identity_during_game?: boolean
          board_cols?: number
          board_rows?: number
          created_at?: string
          end_condition?: string
          free_space_col?: number | null
          free_space_row?: number | null
          game_id?: string
          giveaway_penalty_points?: number
          guesses_per_target?: number
          has_free_space?: boolean
          multi_bingo_points?: number
          normal_bingo_points?: number
          pre_action_guess_points?: number
          reveal_marks_after_round?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_settings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          invite_code: string
          name: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          invite_code: string
          name: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          invite_code?: string
          name?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guesses: {
        Row: {
          accused_giveaway_player_id: string | null
          created_at: string
          game_id: string
          guess_text: string
          guessed_by_player_id: string
          id: string
          matched_selected_action_id: string | null
          resolved_at: string | null
          resolved_by_player_id: string | null
          result: string
          target_player_id: string
        }
        Insert: {
          accused_giveaway_player_id?: string | null
          created_at?: string
          game_id: string
          guess_text: string
          guessed_by_player_id: string
          id?: string
          matched_selected_action_id?: string | null
          resolved_at?: string | null
          resolved_by_player_id?: string | null
          result?: string
          target_player_id: string
        }
        Update: {
          accused_giveaway_player_id?: string | null
          created_at?: string
          game_id?: string
          guess_text?: string
          guessed_by_player_id?: string
          id?: string
          matched_selected_action_id?: string | null
          resolved_at?: string | null
          resolved_by_player_id?: string | null
          result?: string
          target_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guesses_accused_giveaway_player_id_fkey"
            columns: ["accused_giveaway_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guesses_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guesses_guessed_by_player_id_fkey"
            columns: ["guessed_by_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guesses_matched_selected_action_id_fkey"
            columns: ["matched_selected_action_id"]
            isOneToOne: false
            referencedRelation: "selected_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guesses_resolved_by_player_id_fkey"
            columns: ["resolved_by_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guesses_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      score_events: {
        Row: {
          created_at: string
          game_id: string
          id: string
          note: string | null
          player_id: string
          points: number
          reason: string
          related_board_id: string | null
          related_guess_id: string | null
          related_selected_action_id: string | null
          related_target_player_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          note?: string | null
          player_id: string
          points: number
          reason: string
          related_board_id?: string | null
          related_guess_id?: string | null
          related_selected_action_id?: string | null
          related_target_player_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          note?: string | null
          player_id?: string
          points?: number
          reason?: string
          related_board_id?: string | null
          related_guess_id?: string | null
          related_selected_action_id?: string | null
          related_target_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_related_board_id_fkey"
            columns: ["related_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_related_guess_id_fkey"
            columns: ["related_guess_id"]
            isOneToOne: false
            referencedRelation: "guesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_related_selected_action_id_fkey"
            columns: ["related_selected_action_id"]
            isOneToOne: false
            referencedRelation: "selected_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_related_target_player_id_fkey"
            columns: ["related_target_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      selected_actions: {
        Row: {
          action_text: string
          created_at: string
          game_id: string
          global_state: string
          id: string
          locked_at: string | null
          locked_reason: string | null
          selected_rank: number | null
          submission_id: string
          target_player_id: string
        }
        Insert: {
          action_text: string
          created_at?: string
          game_id: string
          global_state?: string
          id?: string
          locked_at?: string | null
          locked_reason?: string | null
          selected_rank?: number | null
          submission_id: string
          target_player_id: string
        }
        Update: {
          action_text?: string
          created_at?: string
          game_id?: string
          global_state?: string
          id?: string
          locked_at?: string | null
          locked_reason?: string | null
          selected_rank?: number | null
          submission_id?: string
          target_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "selected_actions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selected_actions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "action_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selected_actions_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      target_claims: {
        Row: {
          bingo_line_count: number
          board_id: string
          claimed_by_player_id: string
          created_at: string
          game_id: string
          id: string
          points_awarded: number
          target_player_id: string
        }
        Insert: {
          bingo_line_count?: number
          board_id: string
          claimed_by_player_id: string
          created_at?: string
          game_id: string
          id?: string
          points_awarded: number
          target_player_id: string
        }
        Update: {
          bingo_line_count?: number
          board_id?: string
          claimed_by_player_id?: string
          created_at?: string
          game_id?: string
          id?: string
          points_awarded?: number
          target_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_claims_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_claims_claimed_by_player_id_fkey"
            columns: ["claimed_by_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_claims_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_claims_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_score: {
        Args: {
          p_game_id: string
          p_note?: string
          p_player_id: string
          p_points: number
        }
        Returns: string
      }
      admin_remove_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      apply_score_event: {
        Args: {
          p_game_id: string
          p_note?: string
          p_player_id: string
          p_points: number
          p_reason: string
          p_related_board_id?: string
          p_related_guess_id?: string
          p_related_selected_action_id?: string
          p_related_target_player_id?: string
        }
        Returns: string
      }
      can_see_target_data: {
        Args: { p_game_id: string; p_target_player_id: string }
        Returns: boolean
      }
      claim_target_from_bingo: {
        Args: { p_board_id: string; p_line_count: number }
        Returns: Json
      }
      create_game: {
        Args: {
          p_actions_per_target?: number
          p_allow_diagonals?: boolean
          p_board_cols?: number
          p_board_rows?: number
          p_category?: string
          p_end_condition?: string
          p_giveaway_penalty_points?: number
          p_guesses_per_target?: number
          p_has_free_space?: boolean
          p_multi_bingo_points?: number
          p_name: string
          p_normal_bingo_points?: number
          p_pre_action_guess_points?: number
        }
        Returns: string
      }
      current_player_id: { Args: { p_game_id: string }; Returns: string }
      default_free_space_position: {
        Args: { p_cols: number; p_rows: number }
        Returns: {
          col_idx: number
          row_idx: number
        }[]
      }
      edit_own_submission: {
        Args: { p_submission_id: string; p_text: string }
        Returns: undefined
      }
      end_game: { Args: { p_game_id: string }; Returns: undefined }
      evaluate_bingo: {
        Args: { p_board_id: string; p_new_square_id: string }
        Returns: number
      }
      finalize_actions_for_target: {
        Args: { p_game_id: string; p_target_player_id: string }
        Returns: undefined
      }
      finalize_setup: { Args: { p_game_id: string }; Returns: undefined }
      generate_boards: { Args: { p_game_id: string }; Returns: undefined }
      generate_invite_code: { Args: never; Returns: string }
      get_setup_feed: {
        Args: { p_game_id: string }
        Returns: {
          created_at: string
          game_id: string
          id: string
          is_mine: boolean
          status: string
          target_display_name: string
          target_player_id: string
          text: string
          vote_count: number
          voted_by_me: boolean
        }[]
      }
      get_setup_progress: {
        Args: { p_game_id: string }
        Returns: {
          required_count: number
          submission_count: number
          target_display_name: string
          target_player_id: string
        }[]
      }
      is_admin: { Args: { p_game_id: string }; Returns: boolean }
      is_game_member: { Args: { p_game_id: string }; Returns: boolean }
      is_line_complete: {
        Args: { p_board_id: string; p_square_ids: string[] }
        Returns: boolean
      }
      is_revealed: { Args: { p_game_id: string }; Returns: boolean }
      join_game: {
        Args: { p_display_name: string; p_invite_code: string }
        Returns: string
      }
      log_event: {
        Args: {
          p_actor_player_id: string
          p_event_type: string
          p_game_id: string
          p_payload?: Json
          p_visibility?: string
        }
        Returns: undefined
      }
      mark_square: { Args: { p_board_square_id: string }; Returns: Json }
      remove_own_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      remove_upvote: { Args: { p_submission_id: string }; Returns: undefined }
      resolve_guess: {
        Args: {
          p_giveaway_player_id?: string
          p_guess_id: string
          p_matched_selected_action_id?: string
          p_result: string
        }
        Returns: undefined
      }
      reveal_game: { Args: { p_game_id: string }; Returns: undefined }
      start_game: { Args: { p_game_id: string }; Returns: undefined }
      start_setup: { Args: { p_game_id: string }; Returns: undefined }
      submit_action: {
        Args: { p_game_id: string; p_target_player_id: string; p_text: string }
        Returns: string
      }
      submit_guess: {
        Args: { p_game_id: string; p_guess_text: string }
        Returns: string
      }
      upvote_submission: {
        Args: { p_submission_id: string }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

