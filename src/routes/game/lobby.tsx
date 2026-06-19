import { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, LoadingScreen, ErrorBanner } from '@/components/layout'
import { HostControls } from '@/components/game/scoreboard'
import { useGame, usePlayers, useCurrentPlayer } from '@/lib/api/hooks'
import { api } from '@/lib/api'
import { formatInviteCode } from '@/lib/utils'
import { useSessionStore } from '@/stores/session'

const statusLabels: Record<string, string> = {
  lobby: 'Lobby',
  setup: 'Setup',
  active: 'Active',
  ended: 'Ended',
  revealed: 'Revealed',
}

export function LobbyPage() {
  const { gameId } = useParams({ from: '/game/$gameId' })
  const { data: game, refetch: refetchGame } = useGame(gameId)
  const { data: players, isLoading } = usePlayers(gameId)
  const { data: currentPlayer } = useCurrentPlayer(gameId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const setLastGameId = useSessionStore((s) => s.setLastGameId)

  useEffect(() => {
    setLastGameId(gameId)
  }, [gameId, setLastGameId])

  const isHost = currentPlayer?.role === 'host' || currentPlayer?.role === 'admin'

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await refetchGame()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading || !game) return <LoadingScreen />

  return (
    <>
      <PageHeader
        title={game.name}
        subtitle={game.category ?? 'Social bingo'}
        action={<Badge>{statusLabels[game.status] ?? game.status}</Badge>}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {error && <ErrorBanner message={error} />}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite Code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-3xl font-black tracking-[0.3em] text-primary">
              {formatInviteCode(game.invite_code)}
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Share this code so friends can join
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Players ({players?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {players?.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
                <span>{p.display_name}</span>
                <div className="flex gap-2">
                  {p.role === 'host' && <Badge variant="outline">Host</Badge>}
                  {p.id === currentPlayer?.id && <Badge>You</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <HostControls
          isHost={!!isHost}
          status={game.status}
          busy={busy}
          onStartSetup={() => run(() => api.startSetup(gameId))}
          onStartGame={() => run(async () => {
            try {
              await api.finalizeSetup(gameId)
            } catch {
              // may already be finalized
            }
            await api.startGame(gameId)
          })}
          onEndGame={() => run(() => api.endGame(gameId))}
          onReveal={() => run(() => api.revealGame(gameId))}
        />
      </div>
    </>
  )
}
