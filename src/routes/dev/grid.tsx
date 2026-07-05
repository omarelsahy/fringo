import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { routeForScenario, type DevScenario } from '@/dev/scenarios'

const DEFAULT_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']

const SCENARIO_LABELS: Record<DevScenario, string> = {
  lobby: 'Lobby — players joined, waiting',
  setup: 'Setup — voting phase (empty)',
  'setup-seeded': 'Setup — prefilled submissions',
  active: 'Active — boards generated, gameplay',
  reveal: 'Reveal — post-game results',
}

function buildPlayerUrl(baseUrl: string, slot: number, opts: {
  action: 'create' | 'join'
  name: string
  code?: string
}) {
  const params = new URLSearchParams({
    fresh: '1',
    slot: String(slot),
    action: opts.action,
    name: opts.name,
    preset: 'game_night',
    gameName: 'Dev Grid Game',
  })
  if (opts.code) params.set('code', opts.code)
  return `${baseUrl}/dev/player?${params}`
}

export function DevGridPage() {
  const [playerCount, setPlayerCount] = useState(4)
  const [names, setNames] = useState(DEFAULT_NAMES)
  const [scenario, setScenario] = useState<DevScenario>('setup-seeded')
  const [gameId, setGameId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [frameUrls, setFrameUrls] = useState<(string | null)[]>(Array(6).fill(null))
  const [log, setLog] = useState<string[]>([])
  const [launching, setLaunching] = useState(false)
  const readySlots = useRef(new Set<number>())
  const sessionRef = useRef<{ gameId: string | null; inviteCode: string | null }>({
    gameId: null,
    inviteCode: null,
  })

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const appendLog = useCallback((message: string) => {
    setLog((prev) => [...prev.slice(-40), message])
  }, [])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== 'fringo-dev-player-ready') return
      const { slot, gameId: gid, inviteCode: code, displayName } = event.data as {
        slot: number
        gameId: string
        inviteCode: string
        displayName: string
      }

      readySlots.current.add(slot)
      appendLog(`${displayName} ready (slot ${slot})`)

      if (slot === 0) {
        sessionRef.current = { gameId: gid, inviteCode: code }
        setGameId(gid)
        setInviteCode(code)

        setFrameUrls((prev) => {
          const next = [...prev]
          for (let i = 1; i < playerCount; i += 1) {
            next[i] = buildPlayerUrl(baseUrl, i, {
              action: 'join',
              name: names[i] ?? `Player ${i + 1}`,
              code,
            })
          }
          return next
        })
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [appendLog, baseUrl, names, playerCount])

  async function applyScenarioApi(gid: string, selected: DevScenario) {
    appendLog(`Applying scenario: ${selected}`)
    const res = await fetch(`${baseUrl}/dev/api/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: gid, scenario: selected }),
    })
    if (!res.ok) throw new Error(await res.text())
    appendLog('Scenario applied')
  }

  function navigateAll(route: string, gid: string) {
    const path =
      route === 'lobby' ? `/game/${gid}` : `/game/${gid}/${route}`

    setFrameUrls((prev) => {
      const next = [...prev]
      for (let slot = 0; slot < playerCount; slot += 1) {
        if (next[slot]) next[slot] = `${baseUrl}${path}?slot=${slot}`
      }
      return next
    })
  }

  async function handleLaunch() {
    setLaunching(true)
    readySlots.current.clear()
    sessionRef.current = { gameId: null, inviteCode: null }
    setGameId(null)
    setInviteCode(null)
    setLog([])
    appendLog('Launching host...')

    const urls: (string | null)[] = Array(6).fill(null)
    urls[0] = buildPlayerUrl(baseUrl, 0, { action: 'create', name: names[0] ?? 'Alice' })
    setFrameUrls(urls)

    try {
      await waitFor(() => sessionRef.current.inviteCode !== null, 20000)
      appendLog(`Invite code: ${sessionRef.current.inviteCode}`)
      appendLog('Waiting for all players...')
      await waitFor(() => readySlots.current.size >= playerCount, 45000)

      const gid = sessionRef.current.gameId
      if (!gid) throw new Error('Missing game id')

      if (scenario !== 'lobby') {
        await applyScenarioApi(gid, scenario)
        navigateAll(routeForScenario(scenario), gid)
      } else {
        navigateAll('lobby', gid)
      }

      appendLog('Session ready — interact with any panel')
    } catch (e) {
      appendLog(e instanceof Error ? e.message : 'Launch failed')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold">Fringo Dev Grid</h1>
        <p className="text-sm text-muted-foreground">
          Browser-based multi-player view. For the desktop app run{' '}
          <code className="rounded bg-secondary px-1">npm run dev:launcher</code>.
        </p>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="count">Players ({playerCount})</Label>
              <input
                id="count"
                type="range"
                min={2}
                max={6}
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {names.slice(0, playerCount).map((name, i) => (
              <div key={i} className="space-y-1">
                <Label htmlFor={`name-${i}`}>{i === 0 ? 'Host' : `Player ${i + 1}`}</Label>
                <Input
                  id={`name-${i}`}
                  value={name}
                  onChange={(e) => {
                    const next = [...names]
                    next[i] = e.target.value
                    setNames(next)
                  }}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="scenario">Scenario</Label>
              <select
                id="scenario"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={scenario}
                onChange={(e) => setScenario(e.target.value as DevScenario)}
              >
                {(Object.keys(SCENARIO_LABELS) as DevScenario[]).map((key) => (
                  <option key={key} value={key}>
                    {SCENARIO_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <Button className="w-full" onClick={() => void handleLaunch()} disabled={launching}>
              {launching ? 'Launching...' : 'Launch Session'}
            </Button>

            {gameId && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-muted-foreground">
                  Game: {gameId.slice(0, 8)}… · Code: {inviteCode}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(['lobby', 'setup', 'boards', 'scoreboard', 'reveal'] as const).map((route) => (
                    <Button
                      key={route}
                      size="sm"
                      variant="outline"
                      onClick={() => navigateAll(route, gameId)}
                    >
                      {route}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-36 overflow-y-auto rounded-md bg-secondary/40 p-2 font-mono text-xs">
              {log.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(playerCount, 3)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: playerCount }, (_, slot) => (
            <div key={slot} className="flex min-h-[480px] flex-col overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-secondary/40 px-2 py-1 text-xs font-medium">
                {slot === 0 ? 'Host' : `P${slot + 1}`}: {names[slot]}
              </div>
              {frameUrls[slot] ? (
                <iframe
                  title={`Player ${slot}`}
                  src={frameUrls[slot]!}
                  className="min-h-0 flex-1 bg-background"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Waiting to launch...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function waitFor(predicate: () => boolean, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Timed out waiting for players'))
        return
      }
      setTimeout(tick, 250)
    }
    tick()
  })
}
