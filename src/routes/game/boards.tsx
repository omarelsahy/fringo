import { Link, useParams } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, LoadingScreen } from '@/components/layout'
import { useMyBoards, usePlayers, useCurrentPlayer, useTargetClaims } from '@/lib/api/hooks'

export function BoardsPage() {
  const { gameId } = useParams({ from: '/game/$gameId' })
  const { data: currentPlayer } = useCurrentPlayer(gameId)
  const { data: boards, isLoading } = useMyBoards(gameId, currentPlayer?.id)
  const { data: players } = usePlayers(gameId)
  const { data: claims } = useTargetClaims(gameId)

  const playerMap = Object.fromEntries((players ?? []).map((p) => [p.id, p.display_name]))
  const claimedTargets = new Set((claims ?? []).map((c) => c.target_player_id))

  if (isLoading) return <LoadingScreen />

  return (
    <>
      <PageHeader title="My Boards" subtitle="Private boards for each other player" />
      <div className="grid gap-3 p-4">
        {boards?.map((board) => {
          const claimed = claimedTargets.has(board.target_player_id)
          return (
            <Link
              key={board.id}
              to="/game/$gameId/boards/$boardId"
              params={{ gameId, boardId: board.id }}
            >
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">
                    {playerMap[board.target_player_id] ?? 'Player'}
                  </CardTitle>
                  {claimed ? (
                    <Badge variant="success">Claimed</Badge>
                  ) : board.state === 'active' ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge>{board.state}</Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Tap to view and mark your private board
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
        {boards?.length === 0 && (
          <p className="text-center text-muted-foreground">No boards yet. Wait for the host to start the game.</p>
        )}
      </div>
    </>
  )
}
