import { useParams } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout'
import { useCurrentPlayer, useGuesses, usePlayers } from '@/lib/api/hooks'

const resultLabels: Record<string, string> = {
  pending: 'Pending',
  correct_pre_action: 'Correct (before action)',
  correct_post_action: 'Correct (after action)',
  incorrect: 'Incorrect',
  void: 'Void',
}

export function GuessPage() {
  const { gameId } = useParams({ from: '/game/$gameId' })
  const { data: currentPlayer } = useCurrentPlayer(gameId)
  const { data: guesses } = useGuesses(gameId)
  const { data: players } = usePlayers(gameId)

  const playerMap = Object.fromEntries((players ?? []).map((p) => [p.id, p.display_name]))

  return (
    <>
      <PageHeader
        title="Guesses"
        subtitle={`You have ${currentPlayer?.guesses_remaining ?? 0} guesses remaining`}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How Guessing Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              When a target correctly guesses an action you are trying to get them to do, hold that
              action on your board and report the outcome.
            </p>
            <p>
              Correct guesses before the action earn the target points. Correct guesses after the
              action cost you a giveaway penalty.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guess History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {guesses?.length === 0 && (
              <p className="text-sm text-muted-foreground">No guesses reported yet.</p>
            )}
            {guesses?.map((g) => (
              <div key={g.id} className="rounded-md border border-border p-3 text-sm space-y-1">
                <p>
                  <span className="font-medium">{playerMap[g.target_player_id]}</span>
                  {' guessed '}
                  <span className="italic">&ldquo;{g.guess_text}&rdquo;</span>
                </p>
                <p className="text-muted-foreground">
                  Reported by {playerMap[g.guessed_by_player_id]}
                </p>
                <Badge variant="outline">{resultLabels[g.result] ?? g.result}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
