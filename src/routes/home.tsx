import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSessionStore } from '@/stores/session'
import { joinSearch, gameSearch } from '@/lib/route-search'

export function HomePage() {
  const lastGameId = useSessionStore((s) => s.lastGameId)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="py-8 text-center">
        <h1 className="text-4xl font-black tracking-tight text-primary">Fringo</h1>
        <p className="mt-2 text-muted-foreground">
          Hidden-event social game for friends
        </p>
      </div>

      <div className="space-y-3">
        <Link to="/create">
          <Button className="w-full" size="lg">Create Game</Button>
        </Link>
        <Link to="/join" search={joinSearch()}>
          <Button className="w-full" size="lg" variant="secondary">Join with Code</Button>
        </Link>
        {lastGameId && (
          <Link to="/game/$gameId" params={{ gameId: lastGameId }} search={gameSearch()}>
            <Button className="w-full" variant="outline">Resume Last Game</Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
          <CardDescription>Everyone is both player and target</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Submit secret actions for other players and upvote the best ones.</p>
          <p>2. Get private Fringo boards with the same actions in different layouts.</p>
          <p>3. Mark squares when you witness actions. First Fringo claims the target!</p>
          <p>4. Report when targets guess your actions — hold a card on your board.</p>
        </CardContent>
      </Card>

      {import.meta.env.DEV && (
        <Card className="border-dashed border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Dev tools</CardTitle>
            <CardDescription>Multi-player testing without extra browser windows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/dev">
              <Button className="w-full" variant="outline">Open Dev Grid (browser)</Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              Desktop app: <code className="rounded bg-secondary px-1">npm run dev:launcher</code>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
