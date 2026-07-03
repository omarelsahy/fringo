import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BoardSquareWithAction } from '@/types/app'

export type GuessReportResult = 'correct_pre_action' | 'correct_post_action' | 'incorrect'

interface GuessReportMenuProps {
  square: BoardSquareWithAction
  targetName: string
  guessesRemaining: number
  busy?: boolean
  onReport: (result: GuessReportResult) => void
  onClose: () => void
}

export function GuessReportMenu({
  square,
  targetName,
  guessesRemaining,
  busy,
  onReport,
  onClose,
}: GuessReportMenuProps) {
  const actionText = square.selected_actions?.action_text ?? 'this action'
  const isMarked = square.state === 'marked' || square.state === 'winning'
  const isLocked = square.state === 'locked'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <Card
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle className="text-base">Report a Guess</CardTitle>
          <p className="text-sm text-muted-foreground">
            Did {targetName} guess &ldquo;{actionText}&rdquo;?
          </p>
          <p className="text-xs text-muted-foreground">
            {targetName} has {guessesRemaining} guess{guessesRemaining === 1 ? '' : 'es'} remaining
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLocked ? (
            <p className="text-sm text-muted-foreground">This action is locked.</p>
          ) : guessesRemaining <= 0 ? (
            <p className="text-sm text-muted-foreground">
              {targetName} has no guesses remaining.
            </p>
          ) : (
            <>
              <Button
                className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                variant="secondary"
                disabled={busy || isMarked}
                onClick={() => onReport('correct_pre_action')}
              >
                Target guessed correctly before committing the action
              </Button>
              <Button
                className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                variant="secondary"
                disabled={busy || !isMarked}
                onClick={() => onReport('correct_post_action')}
              >
                Target guessed correctly after committing the action
              </Button>
              <Button
                className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                variant="outline"
                disabled={busy}
                onClick={() => onReport('incorrect')}
              >
                Target guessed incorrectly
              </Button>
            </>
          )}
          <Button className="w-full" variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
