import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSessionStore } from '@/stores/session'

export function HomePage() {
  const lastGameId = useSessionStore((s) => s.lastGameId)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="py-8 text-center">
        <h1 className="text-4xl font-black tracking-tight text-primary">Fringo</h1>
        <p className="mt-2 text-muted-foreground">
          Hidden-event social bingo for friends
        </p>
      </div>

      <div className="space-y-3">
        <Link to="/create">
          <Button className="w-full" size="lg">Create Game</Button>
        </Link>
        <Link to="/join">
          <Button className="w-full" size="lg" variant="secondary">Join with Code</Button>
        </Link>
        {lastGameId && (
          <Link to="/game/$gameId" params={{ gameId: lastGameId }}>
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
          <p>2. Get private bingo boards with the same actions in different layouts.</p>
          <p>3. Mark squares when you witness actions. First bingo claims the target!</p>
          <p>4. Use limited guesses to deduce actions about yourself.</p>
        </CardContent>
      </Card>
    </div>
  )
}
