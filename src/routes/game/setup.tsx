import { useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, LoadingScreen, ErrorBanner } from '@/components/layout'
import { SetupFeed } from '@/components/game/setup-feed'
import { HostControls } from '@/components/game/scoreboard'
import {
  useSetupFeed,
  useSetupProgress,
  usePlayers,
  useCurrentPlayer,
  useSubmitAction,
  useToggleUpvote,
  useGame,
} from '@/lib/api/hooks'
import { api } from '@/lib/api'

export function SetupPage() {
  const { gameId } = useParams({ from: '/game/$gameId' })
  const { data: game, refetch: refetchGame } = useGame(gameId)
  const { data: feed, isLoading } = useSetupFeed(gameId, game?.status === 'setup')
  const { data: progress } = useSetupProgress(gameId)
  const { data: players } = usePlayers(gameId)
  const { data: currentPlayer } = useCurrentPlayer(gameId)
  const submitAction = useSubmitAction(gameId)
  const toggleUpvote = useToggleUpvote(gameId)

  const [filter, setFilter] = useState<string>('all')
  const [targetId, setTargetId] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const otherPlayers = useMemo(
    () => players?.filter((p) => p.id !== currentPlayer?.id) ?? [],
    [players, currentPlayer],
  )

  const filteredFeed = useMemo(() => {
    if (!feed) return []
    if (filter === 'all') return feed
    return feed.filter((item) => item.target_player_id === filter)
  }, [feed, filter])

  const isHost = currentPlayer?.role === 'host' || currentPlayer?.role === 'admin'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetId || !text.trim()) return
    setError('')
    try {
      await submitAction.mutateAsync({ targetId, text: text.trim() })
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    }
  }

  if (isLoading) return <LoadingScreen message="Loading setup..." />

  return (
    <>
      <PageHeader title="Action Market" subtitle="Submit and upvote actions for other players" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {error && <ErrorBanner message={error} />}

        {progress && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {progress.map((p) => (
                <div key={p.target_player_id} className="flex justify-between text-sm">
                  <span>{p.target_display_name}</span>
                  <span className={p.submission_count >= p.required_count ? 'text-emerald-400' : 'text-muted-foreground'}>
                    {p.submission_count}/{p.required_count}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit Action</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label>Target</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  <option value="">Select player...</option>
                  {otherPlayers.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Orders mozzarella sticks"
                />
              </div>
              <Button type="submit" disabled={!targetId || !text.trim() || submitAction.isPending}>
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>

        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {otherPlayers.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>{p.display_name}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={filter}>
            <SetupFeed
              items={filteredFeed}
              loading={toggleUpvote.isPending}
              onToggleUpvote={(item) => {
                void toggleUpvote.mutateAsync({ submissionId: item.id, voted: item.voted_by_me })
              }}
            />
          </TabsContent>
        </Tabs>

        <HostControls
          isHost={!!isHost}
          status={game?.status ?? 'setup'}
          busy={busy}
          onStartGame={() => {
            setBusy(true)
            void (async () => {
              try {
                await api.finalizeSetup(gameId)
                await api.startGame(gameId)
                await refetchGame()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Start failed')
              } finally {
                setBusy(false)
              }
            })()
          }}
        />
      </div>
    </>
  )
}
