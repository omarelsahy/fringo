import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader, ErrorBanner, LoadingScreen } from '@/components/layout'
import { useJoinGame } from '@/lib/api/hooks'
import { ensureAnonymousAuth, supabase } from '@/lib/supabase'
import { useSessionStore } from '@/stores/session'
import { formatInviteCode } from '@/lib/utils'

export function JoinGamePage() {
  const navigate = useNavigate()
  const { fresh, code: codeParam, name: nameParam, auto } = useSearch({ from: '/join' })
  const displayName = useSessionStore((s) => s.displayName)
  const setDisplayName = useSessionStore((s) => s.setDisplayName)
  const setLastGameId = useSessionStore((s) => s.setLastGameId)
  const [code, setCode] = useState(codeParam ?? '')
  const [name, setName] = useState(nameParam ?? displayName)
  const [error, setError] = useState('')
  const [booting, setBooting] = useState(!!fresh)
  const autoRan = useRef(false)
  const joinGame = useJoinGame()

  async function handleJoin(overrideCode?: string, overrideName?: string) {
    const joinCode = (overrideCode ?? code).trim()
    const joinName = (overrideName ?? name).trim()
    setError('')
    try {
      await ensureAnonymousAuth()
      const playerId = await joinGame.mutateAsync({ code: joinCode, name: joinName })

      const { data: player, error: playerError } = await supabase
        .from('game_players')
        .select('game_id')
        .eq('id', playerId)
        .single()

      if (playerError || !player) throw playerError ?? new Error('Player not found')

      setDisplayName(joinName)
      setLastGameId(player.game_id)
      void navigate({ to: '/game/$gameId', params: { gameId: player.game_id } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game')
    }
  }

  useEffect(() => {
    if (codeParam) setCode(formatInviteCode(codeParam))
    if (nameParam) setName(nameParam)
  }, [codeParam, nameParam])

  useEffect(() => {
    if (!fresh) return
    void (async () => {
      await supabase.auth.signOut({ scope: 'local' })
      setBooting(false)
    })()
  }, [fresh])

  useEffect(() => {
    if (!auto || booting || autoRan.current) return
    if (!codeParam || !nameParam) return
    autoRan.current = true
    void handleJoin(codeParam, nameParam)
  }, [auto, booting, codeParam, nameParam])

  if (booting || (auto && joinGame.isPending && !error)) {
    return <LoadingScreen message={`Joining as ${nameParam ?? 'player'}...`} />
  }

  return (
    <>
      <PageHeader title="Join Game" subtitle="Enter the invite code from your host" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {error && <ErrorBanner message={error} />}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(formatInviteCode(e.target.value))}
                placeholder="ABC123"
                className="text-center text-lg tracking-widest uppercase"
                maxLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Your name</Label>
              <Input
                id="displayName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How others see you"
              />
            </div>
          </CardContent>
        </Card>

        <Button size="lg" onClick={() => handleJoin()} disabled={!code.trim() || !name.trim() || joinGame.isPending}>
          {joinGame.isPending ? 'Joining...' : 'Join Game'}
        </Button>
      </div>
    </>
  )
}
