export const GAME_PRESETS = {
  game_night: {
    label: 'Game Night',
    description: '3×3 board, ~2–4 hours',
    board_rows: 3,
    board_cols: 3,
    has_free_space: true,
    actions_per_target: 8,
    guesses_per_target: 2,
    allow_diagonals: true,
  },
  night_out: {
    label: 'Night Out',
    description: '5×5 board, one evening',
    board_rows: 5,
    board_cols: 5,
    has_free_space: true,
    actions_per_target: 24,
    guesses_per_target: 4,
    allow_diagonals: true,
  },
  spring_break: {
    label: 'Spring Break',
    description: '5×5 board, multi-day trip',
    board_rows: 5,
    board_cols: 5,
    has_free_space: true,
    actions_per_target: 24,
    guesses_per_target: 6,
    allow_diagonals: true,
  },
  custom: {
    label: 'Custom',
    description: 'Configure all settings',
    board_rows: 5,
    board_cols: 5,
    has_free_space: true,
    actions_per_target: 24,
    guesses_per_target: 4,
    allow_diagonals: true,
  },
} as const

export type PresetKey = keyof typeof GAME_PRESETS

export type GameStatus = 'lobby' | 'setup' | 'active' | 'ended' | 'revealed' | 'archived'

export interface CreateGameInput {
  name: string
  category?: string
  board_rows: number
  board_cols: number
  has_free_space: boolean
  actions_per_target: number
  guesses_per_target: number
  allow_diagonals: boolean
}

export interface SetupFeedItem {
  id: string
  game_id: string
  target_player_id: string
  target_display_name: string
  text: string
  status: string
  vote_count: number
  voted_by_me: boolean
  is_mine: boolean
  created_at: string
}

export interface MarkSquareResult {
  marked: boolean
  bingo: {
    claimed: boolean
    points?: number
    reason?: string
  } | null
}
