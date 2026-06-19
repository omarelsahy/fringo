import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getCurrentUserId } from '@/lib/supabase'

export const queryKeys = {
  game: (id: string) => ['game', id] as const,
  settings: (id: string) => ['game-settings', id] as const,
  players: (id: string) => ['players', id] as const,
  currentPlayer: (gameId: string, userId: string) => ['current-player', gameId, userId] as const,
  setupFeed: (id: string) => ['setup-feed', id] as const,
  setupProgress: (id: string) => ['setup-progress', id] as const,
  myBoards: (gameId: string, playerId: string) => ['my-boards', gameId, playerId] as const,
  board: (id: string) => ['board', id] as const,
  scores: (id: string) => ['scores', id] as const,
  claims: (id: string) => ['claims', id] as const,
  guesses: (id: string) => ['guesses', id] as const,
  revealBoards: (id: string) => ['reveal-boards', id] as const,
  revealSubmissions: (id: string) => ['reveal-submissions', id] as const,
}

export function useGame(gameId: string) {
  return useQuery({
    queryKey: queryKeys.game(gameId),
    queryFn: () => api.getGame(gameId),
    enabled: !!gameId,
  })
}

export function useGameSettings(gameId: string) {
  return useQuery({
    queryKey: queryKeys.settings(gameId),
    queryFn: () => api.getGameSettings(gameId),
    enabled: !!gameId,
  })
}

export function usePlayers(gameId: string) {
  return useQuery({
    queryKey: queryKeys.players(gameId),
    queryFn: () => api.getPlayers(gameId),
    enabled: !!gameId,
  })
}

export function useCurrentPlayer(gameId: string) {
  return useQuery({
    queryKey: queryKeys.currentPlayer(gameId, 'self'),
    queryFn: async () => {
      const userId = await getCurrentUserId()
      if (!userId) return null
      return api.getCurrentPlayer(gameId, userId)
    },
    enabled: !!gameId,
  })
}

export function useSetupFeed(gameId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.setupFeed(gameId),
    queryFn: () => api.getSetupFeed(gameId),
    enabled: !!gameId && enabled,
  })
}

export function useSetupProgress(gameId: string) {
  return useQuery({
    queryKey: queryKeys.setupProgress(gameId),
    queryFn: () => api.getSetupProgress(gameId),
    enabled: !!gameId,
  })
}

export function useMyBoards(gameId: string, playerId?: string) {
  return useQuery({
    queryKey: queryKeys.myBoards(gameId, playerId ?? ''),
    queryFn: () => api.getMyBoards(gameId, playerId!),
    enabled: !!gameId && !!playerId,
  })
}

export function useBoard(boardId: string) {
  return useQuery({
    queryKey: queryKeys.board(boardId),
    queryFn: () => api.getBoardDetails(boardId),
    enabled: !!boardId,
  })
}

export function useScoreEvents(gameId: string) {
  return useQuery({
    queryKey: queryKeys.scores(gameId),
    queryFn: () => api.getScoreEvents(gameId),
    enabled: !!gameId,
  })
}

export function useTargetClaims(gameId: string) {
  return useQuery({
    queryKey: queryKeys.claims(gameId),
    queryFn: () => api.getTargetClaims(gameId),
    enabled: !!gameId,
  })
}

export function useGuesses(gameId: string) {
  return useQuery({
    queryKey: queryKeys.guesses(gameId),
    queryFn: () => api.getGuesses(gameId),
    enabled: !!gameId,
  })
}

export function useInvalidateGame(gameId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.game(gameId) })
    void qc.invalidateQueries({ queryKey: queryKeys.players(gameId) })
    void qc.invalidateQueries({ queryKey: queryKeys.setupFeed(gameId) })
    void qc.invalidateQueries({ queryKey: queryKeys.setupProgress(gameId) })
    void qc.invalidateQueries({ queryKey: queryKeys.scores(gameId) })
    void qc.invalidateQueries({ queryKey: queryKeys.claims(gameId) })
    void qc.invalidateQueries({ queryKey: queryKeys.guesses(gameId) })
  }
}

export function useCreateGame() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createGame,
    onSuccess: () => {
      void qc.invalidateQueries()
    },
  })
}

export function useJoinGame() {
  return useMutation({ mutationFn: ({ code, name }: { code: string; name: string }) => api.joinGame(code, name) })
}

export function useSubmitAction(gameId: string) {
  const invalidate = useInvalidateGame(gameId)
  return useMutation({
    mutationFn: ({ targetId, text }: { targetId: string; text: string }) =>
      api.submitAction(gameId, targetId, text),
    onSuccess: invalidate,
  })
}

export function useToggleUpvote(gameId: string) {
  const invalidate = useInvalidateGame(gameId)
  return useMutation({
    mutationFn: ({ submissionId, voted }: { submissionId: string; voted: boolean }) =>
      voted ? api.removeUpvote(submissionId) : api.upvoteSubmission(submissionId),
    onSuccess: invalidate,
  })
}

export function useMarkSquare(gameId: string, boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (squareId: string) => api.markSquare(squareId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.board(boardId) })
      void qc.invalidateQueries({ queryKey: queryKeys.scores(gameId) })
      void qc.invalidateQueries({ queryKey: queryKeys.claims(gameId) })
      void qc.invalidateQueries({ queryKey: queryKeys.game(gameId) })
    },
  })
}
