import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GamePlayer, ScoreEvent, TargetClaim } from '@/types/app'

interface ScoreboardProps {
  players: GamePlayer[]
  claims: TargetClaim[]
  events: ScoreEvent[]
  playerNameById: Record<string, string>
}

const reasonLabels: Record<string, string> = {
  bingo: 'Bingo',
  multi_bingo: 'Double Bingo',
  pre_action_guess: 'Pre-action Guess',
  giveaway_penalty: 'Giveaway Penalty',
  admin_adjustment: 'Admin Adjustment',
}

export function Scoreboard({ players, claims, events, playerNameById }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">#{i + 1}</span>
                <span className="font-medium">{p.display_name}</span>
                {p.role === 'host' && <Badge variant="outline">Host</Badge>}
              </div>
              <span className="text-lg font-bold">{p.score}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Claimed Targets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {claims.length === 0 && (
            <p className="text-sm text-muted-foreground">No targets claimed yet.</p>
          )}
          {claims.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium">{playerNameById[c.claimed_by_player_id]}</span>
              {' claimed '}
              <span className="font-medium">{playerNameById[c.target_player_id]}</span>
              {' (+'}
              {c.points_awarded}
              {')'}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.slice(0, 10).map((e) => (
            <div key={e.id} className="flex justify-between text-sm">
              <span>
                {playerNameById[e.player_id]} · {reasonLabels[e.reason] ?? e.reason}
              </span>
              <span className={e.points >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {e.points >= 0 ? '+' : ''}
                {e.points}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function HostControls({
  isHost,
  status,
  onStartSetup,
  onStartGame,
  onEndGame,
  onReveal,
  busy,
}: {
  isHost: boolean
  status: string
  onStartSetup?: () => void
  onStartGame?: () => void
  onEndGame?: () => void
  onReveal?: () => void
  busy?: boolean
}) {
  if (!isHost) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Host Controls</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {status === 'lobby' && onStartSetup && (
          <Button onClick={onStartSetup} disabled={busy}>Start Setup</Button>
        )}
        {status === 'setup' && onStartGame && (
          <Button onClick={onStartGame} disabled={busy}>Finalize & Start Game</Button>
        )}
        {status === 'active' && onEndGame && (
          <Button variant="secondary" onClick={onEndGame} disabled={busy}>End Game</Button>
        )}
        {(status === 'active' || status === 'ended') && onReveal && (
          <Button variant="outline" onClick={onReveal} disabled={busy}>Reveal All</Button>
        )}
      </CardContent>
    </Card>
  )
}
