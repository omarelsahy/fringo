import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageHeader, ErrorBanner } from '@/components/layout'
import {
  useCurrentPlayer,
  useGuesses,
  usePlayers,
  useInvalidateGame,
} from '@/lib/api/hooks'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

export function GuessPage() {
  const { gameId } = useParams({ from: '/game/$gameId' })
  const { data: currentPlayer } = useCurrentPlayer(gameId)
  const { data: guesses } = useGuesses(gameId)
  const { data: players } = usePlayers(gameId)
  const [guessText, setGuessText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const invalidate = useInvalidateGame(gameId)

  const isHost = currentPlayer?.role === 'host' || currentPlayer?.role === 'admin'

  const { data: allActions } = useQuery({
    queryKey: ['all-selected-actions', gameId],
    queryFn: () => api.getAllSelectedActions(gameId),
    enabled: !!isHost && !!gameId,
  })

  async function handleSubmitGuess(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.submitGuess(gameId, guessText.trim())
      setGuessText('')
      invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guess failed')
    } finally {
      setBusy(false)
    }
  }

  async function resolveGuess(
    guessId: string,
    result: string,
    actionId?: string,
    giveawayId?: string,
  ) {
    setBusy(true)
    setError('')
    try {
      await api.resolveGuess(guessId, result, actionId, giveawayId)
      invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve failed')
    } finally {
      setBusy(false)
    }
  }

  const pendingGuesses = guesses?.filter((g) => g.result === 'pending') ?? []
  const playerMap = Object.fromEntries((players ?? []).map((p) => [p.id, p.display_name]))

  return (
    <>
      <PageHeader
        title="Guesses"
        subtitle={`${currentPlayer?.guesses_remaining ?? 0} guesses remaining`}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {error && <ErrorBanner message={error} />}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit a Guess</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitGuess} className="space-y-3">
              <div className="space-y-2">
                <Label>What action is about you?</Label>
                <Input
                  value={guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  placeholder="Is one of my actions..."
                  disabled={(currentPlayer?.guesses_remaining ?? 0) <= 0}
                />
              </div>
              <Button
                type="submit"
                disabled={!guessText.trim() || busy || (currentPlayer?.guesses_remaining ?? 0) <= 0}
              >
                Use Guess
              </Button>
            </form>
          </CardContent>
        </Card>

        {isHost && pendingGuesses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolve Pending (Host)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingGuesses.map((g) => (
                <div key={g.id} className="rounded-md border border-border p-3 space-y-2">
                  <p className="font-medium">{playerMap[g.target_player_id]} guessed:</p>
                  <p className="text-sm italic">&ldquo;{g.guess_text}&rdquo;</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => resolveGuess(g.id, 'incorrect')}>
                      Incorrect
                    </Button>
                  </div>
                  {allActions && (
                    <div className="space-y-2 border-t border-border pt-2">
                      <p className="text-xs text-muted-foreground">
                        Match to action for {playerMap[g.target_player_id]}:
                      </p>
                      {allActions
                        .filter((a) => a.target_player_id === g.target_player_id)
                        .map((action) => (
                          <div key={action.id} className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">{action.action_text}</Badge>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => resolveGuess(g.id, 'correct_pre_action', action.id)}
                            >
                              Pre-action ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                const giveaway = players?.find((p) => p.id !== g.target_player_id)?.id
                                if (giveaway) resolveGuess(g.id, 'correct_post_action', action.id, giveaway)
                              }}
                            >
                              Post-action ✓
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guess History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {guesses?.length === 0 && (
              <p className="text-sm text-muted-foreground">No guesses yet.</p>
            )}
            {guesses?.map((g) => (
              <div key={g.id} className="text-sm">
                <span className="font-medium">{playerMap[g.target_player_id]}</span>: {g.guess_text}
                {' '}
                <Badge variant="outline">{g.result}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
