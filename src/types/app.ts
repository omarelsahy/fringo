import type { Database } from './database'

export type Game = Database['public']['Tables']['games']['Row']
export type GameSettings = Database['public']['Tables']['game_settings']['Row']
export type GamePlayer = Database['public']['Tables']['game_players']['Row']
export type Board = Database['public']['Tables']['boards']['Row']
export type BoardSquare = Database['public']['Tables']['board_squares']['Row']
export type ScoreEvent = Database['public']['Tables']['score_events']['Row']
export type TargetClaim = Database['public']['Tables']['target_claims']['Row']
export type Guess = Database['public']['Tables']['guesses']['Row']
export type SelectedAction = Database['public']['Tables']['selected_actions']['Row']

export type BoardSquareWithAction = BoardSquare & {
  selected_actions: Pick<SelectedAction, 'action_text' | 'global_state'> | null
}

export type BoardWithDetails = Board & {
  target: Pick<GamePlayer, 'id' | 'display_name'>
  squares: BoardSquareWithAction[]
}

export type { Database }
