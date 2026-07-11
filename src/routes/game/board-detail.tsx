import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { PageHeader, LoadingScreen, ErrorBanner } from '@/components/layout'
import { FringoGrid } from '@/components/game/fringo-grid'
import { GuessReportMenu } from '@/components/game/guess-report-menu'
import type { GuessReportResult } from '@/components/game/guess-report-menu'
import {
  useBoard,
  useMarkSquare,
  useGameSettings,
  usePlayers,
  useReportGuess,
  useTargetClaims,
} from '@/lib/api/hooks'
import { useBoardRealtime } from '@/lib/realtime'
import { Card, CardContent } from '@/components/ui/card'
import type { BoardSquareWithAction } from '@/types/app'

export function BoardDetailPage() {
  const { gameId, boardId } = useParams({ from: '/game/$gameId/boards/$boardId' })
  const { data: board, isLoading: boardLoading, error: boardError } = useBoard(boardId)
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useGameSettings(gameId)
  const { data: players } = usePlayers(gameId)
  const { data: claims } = useTargetClaims(gameId)
  const markSquare = useMarkSquare(gameId, boardId)
  const reportGuess = useReportGuess(gameId, boardId)
  const [fringoMessage, setFringoMessage] = useState('')
  const [error, setError] = useState('')
  const [guessSquare, setGuessSquare] = useState<BoardSquareWithAction | null>(null)

  useBoardRealtime(boardId)

  const targetPlayer = players?.find((p) => p.id === board?.target_player_id)
  const guessesRemaining = targetPlayer?.guesses_remaining ?? 0

  async function handleMark(squareId: string) {
    setError('')
    setFringoMessage('')
    try {
      const result = await markSquare.mutateAsync(squareId)
      if (result.fringo?.claimed) {
        setFringoMessage(
          `Fringo! +${result.fringo.points} points (${result.fringo.reason === 'multi_fringo' ? 'double Fringo' : 'Fringo'})`,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mark failed')
    }
  }

  async function handleReportGuess(result: GuessReportResult) {
    if (!guessSquare) return
    setError('')
    try {
      await reportGuess.mutateAsync({ squareId: guessSquare.id, result })
      setGuessSquare(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report failed')
    }
  }

  if (boardLoading || settingsLoading) return <LoadingScreen />

  if (boardError || settingsError) {
    return <ErrorBanner message={boardError?.message ?? settingsError?.message ?? 'Failed to load board'} />
  }

  if (!board || !settings) {
    return <ErrorBanner message="Board not found. Try going back and opening it again." />
  }

  const disabled = board.state !== 'active'
  const playerMap = Object.fromEntries((players ?? []).map((p) => [p.id, p.display_name]))
  const claim = claims?.find((c) => c.target_player_id === board.target_player_id)
  const claimedBy = claim ? playerMap[claim.claimed_by_player_id] : undefined

  return (
    <>
      <PageHeader
        title={`${board.target.display_name}'s Board`}
        subtitle="Tap to mark · hold to report a guess"
        action={
          disabled ? <Badge variant="warning">Fringo claimed</Badge> : undefined
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {error && <ErrorBanner message={error} />}
        {fringoMessage && (
          <Card className="border-emerald-500/50 bg-emerald-500/10">
            <CardContent className="p-4 text-center font-semibold text-emerald-300">
              {fringoMessage}
            </CardContent>
          </Card>
        )}
        <FringoGrid
          rows={settings.board_rows}
          cols={settings.board_cols}
          squares={board.squares}
          onMark={handleMark}
          onLongPress={disabled ? undefined : setGuessSquare}
          locked={disabled}
          claimedBy={claimedBy}
          disabled={disabled || markSquare.isPending}
        />
        <p className="text-center text-xs text-muted-foreground">
          Marks are private. Hold an action card to report if {board.target.display_name} guessed it.
        </p>
      </div>

      {guessSquare && (
        <GuessReportMenu
          square={guessSquare}
          targetName={board.target.display_name}
          guessesRemaining={guessesRemaining}
          busy={reportGuess.isPending}
          onReport={handleReportGuess}
          onClose={() => setGuessSquare(null)}
        />
      )}
    </>
  )
}
