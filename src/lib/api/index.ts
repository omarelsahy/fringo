import { ensureAnonymousAuth, supabase } from '@/lib/supabase'
import type { CreateGameInput, MarkSquareResult, SetupFeedItem } from '@/lib/constants'
import type {
  Board,
  BoardWithDetails,
  Game,
  GamePlayer,
  GameSettings,
  Guess,
  ScoreEvent,
  SelectedAction,
  TargetClaim,
} from '@/types/app'

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  await ensureAnonymousAuth()
  const { data, error } = await supabase.rpc(fn as never, args as never)
  if (error) throw error
  return data as T
}

export const api = {
  createGame(input: CreateGameInput) {
    return rpc<string>('create_game', {
      p_name: input.name,
      p_category: input.category ?? null,
      p_board_rows: input.board_rows,
      p_board_cols: input.board_cols,
      p_has_free_space: input.has_free_space,
      p_actions_per_target: input.actions_per_target,
      p_guesses_per_target: input.guesses_per_target,
      p_allow_diagonals: input.allow_diagonals,
    })
  },

  joinGame(inviteCode: string, displayName: string) {
    return rpc<string>('join_game', {
      p_invite_code: inviteCode,
      p_display_name: displayName,
    })
  },

  startSetup(gameId: string) {
    return rpc<void>('start_setup', { p_game_id: gameId })
  },

  finalizeSetup(gameId: string) {
    return rpc<void>('finalize_setup', { p_game_id: gameId })
  },

  startGame(gameId: string) {
    return rpc<void>('start_game', { p_game_id: gameId })
  },

  endGame(gameId: string) {
    return rpc<void>('end_game', { p_game_id: gameId })
  },

  revealGame(gameId: string) {
    return rpc<void>('reveal_game', { p_game_id: gameId })
  },

  submitAction(gameId: string, targetPlayerId: string, text: string) {
    return rpc<string>('submit_action', {
      p_game_id: gameId,
      p_target_player_id: targetPlayerId,
      p_text: text,
    })
  },

  upvoteSubmission(submissionId: string) {
    return rpc<void>('upvote_submission', { p_submission_id: submissionId })
  },

  removeUpvote(submissionId: string) {
    return rpc<void>('remove_upvote', { p_submission_id: submissionId })
  },

  getSetupFeed(gameId: string) {
    return rpc<SetupFeedItem[]>('get_setup_feed', { p_game_id: gameId })
  },

  getSetupProgress(gameId: string) {
    return rpc<Array<{
      target_player_id: string
      target_display_name: string
      submission_count: number
      required_count: number
    }>>('get_setup_progress', { p_game_id: gameId })
  },

  markSquare(squareId: string) {
    return rpc<MarkSquareResult>('mark_square', { p_board_square_id: squareId })
  },

  submitGuess(gameId: string, guessText: string) {
    return rpc<string>('submit_guess', {
      p_game_id: gameId,
      p_guess_text: guessText,
    })
  },

  resolveGuess(
    guessId: string,
    result: string,
    matchedActionId?: string,
    giveawayPlayerId?: string,
  ) {
    return rpc<void>('resolve_guess', {
      p_guess_id: guessId,
      p_result: result,
      p_matched_selected_action_id: matchedActionId ?? null,
      p_giveaway_player_id: giveawayPlayerId ?? null,
    })
  },

  async getGame(gameId: string): Promise<Game | null> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle()
    if (error) throw error
    return data
  },

  async getGameSettings(gameId: string): Promise<GameSettings | null> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('game_settings')
      .select('*')
      .eq('game_id', gameId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getPlayers(gameId: string): Promise<GamePlayer[]> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .eq('status', 'active')
      .order('joined_at')
    if (error) throw error
    return data ?? []
  },

  async getCurrentPlayer(gameId: string, userId: string): Promise<GamePlayer | null> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getMyBoards(gameId: string, ownerPlayerId: string): Promise<Board[]> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('game_id', gameId)
      .eq('owner_player_id', ownerPlayerId)
    if (error) throw error
    return data ?? []
  },

  async getBoardDetails(boardId: string): Promise<BoardWithDetails | null> {
    await ensureAnonymousAuth()
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .maybeSingle()
    if (boardError) throw boardError
    if (!board) return null

    const { data: target, error: targetError } = await supabase
      .from('game_players')
      .select('id, display_name')
      .eq('id', board.target_player_id)
      .maybeSingle()
    if (targetError) throw targetError

    const { data: squares, error: sqError } = await supabase
      .from('board_squares')
      .select('*')
      .eq('board_id', boardId)
      .order('row_index')
      .order('col_index')
    if (sqError) throw sqError

    const actionIds = (squares ?? [])
      .map((s) => s.selected_action_id)
      .filter((id): id is string => !!id)

    let actionMap: Record<string, Pick<SelectedAction, 'action_text' | 'global_state'>> = {}
    if (actionIds.length > 0) {
      const { data: actions, error: actError } = await supabase
        .from('selected_actions')
        .select('id, action_text, global_state')
        .in('id', actionIds)
      if (actError) throw actError
      actionMap = Object.fromEntries((actions ?? []).map((a) => [a.id, a]))
    }

    const squaresWithActions = (squares ?? []).map((sq) => ({
      ...sq,
      selected_actions: sq.selected_action_id ? actionMap[sq.selected_action_id] ?? null : null,
    }))

    return {
      ...board,
      target: target ?? { id: board.target_player_id, display_name: 'Unknown' },
      squares: squaresWithActions,
    }
  },

  async getScoreEvents(gameId: string): Promise<ScoreEvent[]> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('score_events')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async getTargetClaims(gameId: string): Promise<TargetClaim[]> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('target_claims')
      .select('*')
      .eq('game_id', gameId)
    if (error) throw error
    return data ?? []
  },

  async getGuesses(gameId: string): Promise<Guess[]> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('guesses')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async getSelectedActionsForTarget(gameId: string, targetPlayerId: string): Promise<SelectedAction[]> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('selected_actions')
      .select('*')
      .eq('game_id', gameId)
      .eq('target_player_id', targetPlayerId)
      .order('selected_rank')
    if (error) throw error
    return data ?? []
  },

  async getMySelectedActions(gameId: string, myPlayerId: string): Promise<SelectedAction[]> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('selected_actions')
      .select('*')
      .eq('game_id', gameId)
      .eq('target_player_id', myPlayerId)
    if (error) throw error
    return data ?? []
  },

  async getAllBoardsForReveal(gameId: string) {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('boards')
      .select('*, owner:game_players!boards_owner_player_id_fkey(display_name), target:game_players!boards_target_player_id_fkey(display_name)')
      .eq('game_id', gameId)
    if (error) throw error
    return data ?? []
  },

  async getAllSelectedActions(gameId: string): Promise<SelectedAction[]> {
    await ensureAnonymousAuth()
    const { data, error } = await supabase
      .from('selected_actions')
      .select('*')
      .eq('game_id', gameId)
      .order('target_player_id')
      .order('selected_rank')
    if (error) throw error
    return data ?? []
  },

  async getSubmissionsForReveal(gameId: string) {
    await ensureAnonymousAuth()
    const { data: submissions, error } = await supabase
      .from('action_submissions')
      .select('*')
      .eq('game_id', gameId)
      .in('status', ['selected', 'rejected', 'submitted'])
    if (error) throw error

    const { data: players } = await supabase
      .from('game_players')
      .select('id, display_name')
      .eq('game_id', gameId)

    const nameMap = Object.fromEntries((players ?? []).map((p) => [p.id, p.display_name]))

    return (submissions ?? []).map((s) => ({
      ...s,
      target: { display_name: nameMap[s.target_player_id] ?? 'Unknown' },
      submitter: { display_name: nameMap[s.submitted_by_player_id] ?? 'Unknown' },
    }))
  },
}
