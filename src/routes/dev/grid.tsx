import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { routeForScenario, type DevScenario } from '@/dev/scenarios'
import type { DevPlayerReadyPayload } from '@/dev/session-bus'
import { GAME_PRESETS, type PresetKey } from '@/lib/constants'

const DEFAULT_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']

const SCENARIO_LABELS: Record<DevScenario, string> = {
  lobby: 'Lobby — players joined, waiting',
  setup: 'Setup — voting phase (empty)',
  'setup-seeded': 'Setup — prefilled submissions',
  active: 'Active — boards generated, gameplay',
  reveal: 'Reveal — post-game results',
}

function buildPlayerUrl(baseUrl: string, slot: number, launchId: string, opts: {
  action: 'create' | 'join'
  name: string
  code?: string
  preset: PresetKey
}) {
  const params = new URLSearchParams({
    fresh: '1',
    slot: String(slot),
    launchId,
    action: opts.action,
    name: opts.name,
    preset: opts.preset,
    gameName: 'Dev Grid Game',
  })
  if (opts.code) params.set('code', opts.code)
  return `${baseUrl}/dev/player?${params}`
}

export function DevGridPage() {
  const [playerCount, setPlayerCount] = useState(4)
  const [names, setNames] = useState(DEFAULT_NAMES)
  const [scenario, setScenario] = useState<DevScenario>('setup-seeded')
  const [preset, setPreset] = useState<PresetKey>('game_night')
  const [gameId, setGameId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [frameUrls, setFrameUrls] = useState<(string | null)[]>(Array(6).fill(null))
  const [log, setLog] = useState<string[]>([])
  const [launching, setLaunching] = useState(false)
  const readySlots = useRef(new Set<number>())
  const launchIdRef = useRef(crypto.randomUUID())
  const sessionRef = useRef<{ gameId: string | null; inviteCode: string | null }>({
    gameId: null,
    inviteCode: null,
  })

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const appendLog = useCallback((message: string) => {
    setLog((prev) => [...prev.slice(-40), message])
  }, [])

  const handlePlayerReady = useCallback((payload: DevPlayerReadyPayload) => {
    const slot = Number(payload.slot)
    if (readySlots.current.has(slot)) return

    readySlots.current.add(slot)
    appendLog(`${payload.displayName} ready (slot ${slot})`)

    if (slot === 0) {
      sessionRef.current = { gameId: payload.gameId, inviteCode: payload.inviteCode }
      setGameId(payload.gameId)
      setInviteCode(payload.inviteCode)
    }
  }, [appendLog])

  const pollPlayerReady = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/dev/api/player-ready?launchId=${encodeURIComponent(launchIdRef.current)}`)
      if (!res.ok) return
      const data = (await res.json()) as { ready?: DevPlayerReadyPayload[] }
      for (const payload of data.ready ?? []) {
        handlePlayerReady(payload)
      }
    } catch {
      // ignore
    }
  }, [baseUrl, handlePlayerReady])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== 'fringo-dev-player-ready') return
      handlePlayerReady(event.data as DevPlayerReadyPayload)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handlePlayerReady])

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
    // Bust the URL so React remounts iframes even when they navigated
    // internally away from the last parent-assigned src (same path).
    const bust = `t=${Date.now()}`

    setFrameUrls((prev) => {
      const next = [...prev]
      for (let slot = 0; slot < playerCount; slot += 1) {
        if (next[slot]) next[slot] = `${baseUrl}${path}?slot=${slot}&${bust}`
      }
      return next
    })
  }

  async function handleLaunch() {
    setLaunching(true)
    const previousLaunchId = launchIdRef.current
    launchIdRef.current = crypto.randomUUID()
    void fetch(`${baseUrl}/dev/api/player-ready?launchId=${encodeURIComponent(previousLaunchId)}`, {
      method: 'DELETE',
    }).catch(() => {})

    readySlots.current.clear()
    sessionRef.current = { gameId: null, inviteCode: null }
    setGameId(null)
    setInviteCode(null)
    setLog([])
    appendLog('Launching host...')

    const urls: (string | null)[] = Array(6).fill(null)
    urls[0] = buildPlayerUrl(baseUrl, 0, launchIdRef.current, {
      action: 'create',
      name: names[0] ?? 'Alice',
      preset,
    })
    setFrameUrls(urls)
    appendLog(`Preset: ${preset} (${GAME_PRESETS[preset].board_rows}×${GAME_PRESETS[preset].board_cols})`)

    try {
      await waitFor(() => sessionRef.current.inviteCode !== null, 45000, pollPlayerReady)
      appendLog(`Invite code: ${sessionRef.current.inviteCode}`)

      const code = sessionRef.current.inviteCode!
      for (let slot = 1; slot < playerCount; slot += 1) {
        appendLog(`Joining ${names[slot] ?? `Player ${slot + 1}`}...`)
        setFrameUrls((prev) => {
          const next = [...prev]
          next[slot] = buildPlayerUrl(baseUrl, slot, launchIdRef.current, {
            action: 'join',
            name: names[slot] ?? `Player ${slot + 1}`,
            code,
            preset,
          })
          return next
        })
        await waitFor(() => readySlots.current.has(slot), 60000, pollPlayerReady)
        await new Promise((r) => setTimeout(r, 800))
      }

      appendLog('All players joined')

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

            <div className="space-y-2">
              <Label htmlFor="preset">Game preset</Label>
              <select
                id="preset"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={preset}
                onChange={(e) => setPreset(e.target.value as PresetKey)}
              >
                {(Object.keys(GAME_PRESETS) as PresetKey[]).map((key) => (
                  <option key={key} value={key}>
                    {GAME_PRESETS[key].label} — {GAME_PRESETS[key].board_rows}×{GAME_PRESETS[key].board_cols},{' '}
                    {GAME_PRESETS[key].actions_per_target} actions
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
                  // No sandbox: Electron + multi-iframe auth/sessionStorage is
                  // unreliable under sandbox even with allow-same-origin.
                  allow="clipboard-read; clipboard-write"
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

function waitFor(predicate: () => boolean, timeoutMs: number, poll?: () => Promise<void>) {
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
      void (poll?.() ?? Promise.resolve()).finally(() => setTimeout(tick, 150))
    }
    tick()
  })
}
