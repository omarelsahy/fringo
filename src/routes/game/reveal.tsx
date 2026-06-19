import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader, LoadingScreen, ErrorBanner } from '@/components/layout'
import { Scoreboard } from '@/components/game/scoreboard'
import { usePlayers, useScoreEvents, useTargetClaims, useGame } from '@/lib/api/hooks'
import { api } from '@/lib/api'

export function RevealPage() {
  const { gameId } = useParams({ from: '/game/$gameId' })
  const { data: game } = useGame(gameId)
  const { data: players, isLoading } = usePlayers(gameId)
  const { data: events } = useScoreEvents(gameId)
  const { data: claims } = useTargetClaims(gameId)

  const { data: submissions } = useQuery({
    queryKey: ['reveal-submissions', gameId],
    queryFn: () => api.getSubmissionsForReveal(gameId),
    enabled: game?.status === 'revealed',
  })

  if (game?.status !== 'revealed') {
    return (
      <>
        <PageHeader title="Reveal" subtitle="Available after host reveals the game" />
        <div className="p-4">
          <ErrorBanner message="Game has not been revealed yet. Ask the host to reveal when the round ends." />
        </div>
      </>
    )
  }

  if (isLoading) return <LoadingScreen />

  const playerMap = Object.fromEntries((players ?? []).map((p) => [p.id, p.display_name]))

  return (
    <>
      <PageHeader title="Round Reveal" subtitle="All actions, submitters, and scores" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Scoreboard
          players={players ?? []}
          claims={claims ?? []}
          events={events ?? []}
          playerNameById={playerMap}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {submissions?.map((s) => {
              const sub = s as {
                id: string
                text: string
                status: string
                target?: { display_name: string }
                submitter?: { display_name: string }
              }
              return (
                <div key={sub.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="mb-1 flex flex-wrap gap-2">
                    <Badge>{sub.target?.display_name ?? 'Target'}</Badge>
                    <Badge variant="outline">{sub.status}</Badge>
                  </div>
                  <p>{sub.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted by {sub.submitter?.display_name ?? 'Unknown'}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
