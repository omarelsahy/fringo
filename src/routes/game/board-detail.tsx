import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { PageHeader, LoadingScreen, ErrorBanner } from '@/components/layout'
import { BingoGrid } from '@/components/game/bingo-grid'
import { GuessReportMenu } from '@/components/game/guess-report-menu'
import type { GuessReportResult } from '@/components/game/guess-report-menu'
import {
  useBoard,
  useMarkSquare,
  useGameSettings,
  usePlayers,
  useReportGuess,
} from '@/lib/api/hooks'
import { useBoardRealtime } from '@/lib/realtime'
import { Card, CardContent } from '@/components/ui/card'
import type { BoardSquareWithAction } from '@/types/app'

export function BoardDetailPage() {
  const { gameId, boardId } = useParams({ from: '/game/$gameId/boards/$boardId' })
  const { data: board, isLoading } = useBoard(boardId)
  const { data: settings } = useGameSettings(gameId)
  const { data: players } = usePlayers(gameId)
  const markSquare = useMarkSquare(gameId, boardId)
  const reportGuess = useReportGuess(gameId, boardId)
  const [bingoMessage, setBingoMessage] = useState('')
  const [error, setError] = useState('')
  const [guessSquare, setGuessSquare] = useState<BoardSquareWithAction | null>(null)

  useBoardRealtime(boardId)

  const targetPlayer = players?.find((p) => p.id === board?.target_player_id)
  const guessesRemaining = targetPlayer?.guesses_remaining ?? 0

  async function handleMark(squareId: string) {
    setError('')
    setBingoMessage('')
    try {
      const result = await markSquare.mutateAsync(squareId)
      if (result.bingo?.claimed) {
        setBingoMessage(
          `Bingo! +${result.bingo.points} points (${result.bingo.reason === 'multi_bingo' ? 'double bingo' : 'bingo'})`,
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

  if (isLoading || !board || !settings) return <LoadingScreen />

  const disabled = board.state !== 'active'

  return (
    <>
      <PageHeader
        title={`${board.target.display_name}'s Board`}
        subtitle="Tap to mark · hold to report a guess"
        action={
          disabled ? <Badge variant="warning">{board.state}</Badge> : undefined
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {error && <ErrorBanner message={error} />}
        {bingoMessage && (
          <Card className="border-emerald-500/50 bg-emerald-500/10">
            <CardContent className="p-4 text-center font-semibold text-emerald-300">
              {bingoMessage}
            </CardContent>
          </Card>
        )}
        <BingoGrid
          rows={settings.board_rows}
          cols={settings.board_cols}
          squares={board.squares}
          onMark={handleMark}
          onLongPress={disabled ? undefined : setGuessSquare}
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
