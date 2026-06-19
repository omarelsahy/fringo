import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/api/hooks'
import { useQueryClient } from '@tanstack/react-query'

export function useGameRealtime(gameId: string, playerId?: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!gameId) return

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.game(gameId) })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.players(gameId) })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'action_submissions', filter: `game_id=eq.${gameId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.setupFeed(gameId) })
          void qc.invalidateQueries({ queryKey: queryKeys.setupProgress(gameId) })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'action_upvotes' },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.setupFeed(gameId) })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'score_events', filter: `game_id=eq.${gameId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.scores(gameId) })
          void qc.invalidateQueries({ queryKey: queryKeys.players(gameId) })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'target_claims', filter: `game_id=eq.${gameId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.claims(gameId) })
          void qc.invalidateQueries({ queryKey: queryKeys.myBoards(gameId, playerId ?? '') })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guesses', filter: `game_id=eq.${gameId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.guesses(gameId) })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [gameId, playerId, qc])
}

export function useBoardRealtime(boardId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!boardId) return

    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'board_squares', filter: `board_id=eq.${boardId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeys.board(boardId) })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [boardId, qc])
}
