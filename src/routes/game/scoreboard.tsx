import { useParams } from '@tanstack/react-router'
import { PageHeader, LoadingScreen } from '@/components/layout'
import { Scoreboard } from '@/components/game/scoreboard'
import { usePlayers, useScoreEvents, useTargetClaims } from '@/lib/api/hooks'

export function ScoreboardPage() {
  const { gameId } = useParams({ from: '/game/$gameId' })
  const { data: players, isLoading: loadingPlayers } = usePlayers(gameId)
  const { data: events, isLoading: loadingEvents } = useScoreEvents(gameId)
  const { data: claims, isLoading: loadingClaims } = useTargetClaims(gameId)

  if (loadingPlayers || loadingEvents || loadingClaims) return <LoadingScreen />

  const playerMap = Object.fromEntries((players ?? []).map((p) => [p.id, p.display_name]))

  return (
    <>
      <PageHeader title="Scoreboard" subtitle="Live standings and events" />
      <div className="p-4">
        <Scoreboard
          players={players ?? []}
          claims={claims ?? []}
          events={events ?? []}
          playerNameById={playerMap}
        />
      </div>
    </>
  )
}
