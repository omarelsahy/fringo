import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from 'react'
import { routeForScenario, type DevScenario } from '../../../src/dev/scenarios'
import type { DevPlayerReadyPayload } from '../../../src/dev/session-bus'

async function applyScenarioFromGameServer(baseUrl: string, gameId: string, scenario: DevScenario) {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/dev/api/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, scenario }),
    })
    if (!res.ok) throw new Error(await res.text())
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Scenario failed'
    if (message !== 'Failed to fetch') throw e
    await window.fringoLauncher.applyScenario(gameId, scenario)
  }
}

const DEFAULT_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']

function buildPlayerUrl(baseUrl: string, slot: number, launchId: string, opts: {
  action: 'create' | 'join'
  name: string
  code?: string
  preset?: string
}) {
  const params = new URLSearchParams({
    fresh: '1',
    slot: String(slot),
    launchId,
    action: opts.action,
    name: opts.name,
    preset: opts.preset ?? 'game_night',
    gameName: 'Dev Launcher Game',
  })
  if (opts.code) params.set('code', opts.code)
  return `${baseUrl.replace(/\/$/, '')}/dev/player?${params}`
}

function buildGameUrl(baseUrl: string, gameId: string, route: string, slot: number) {
  const base = baseUrl.replace(/\/$/, '')
  const pathPart = route === 'lobby' ? `/game/${gameId}` : `/game/${gameId}/${route}`
  // Cache-bust so Navigate All remounts iframes that drifted via in-frame links
  return `${base}${pathPart}?slot=${slot}&t=${Date.now()}`
}

export type PlayerGridHandle = {
  launch: () => Promise<void>
  navigateAll: (route: string) => void
  reloadAll: () => void
  reset: () => void
}

type Props = {
  baseUrl: string
  playerCount: number
  names: string[]
  scenario: DevScenario
  onStatus: (message: string, extra?: { gameId?: string | null; inviteCode?: string | null; error?: boolean }) => void
  onSessionChange: (gameId: string | null, inviteCode: string | null) => void
  onLaunchComplete?: (success: boolean) => void
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const PlayerGrid = forwardRef<PlayerGridHandle, Props>(function PlayerGrid(
  { baseUrl, playerCount, names, scenario, onStatus, onSessionChange, onLaunchComplete },
  ref,
) {
  const [frameUrls, setFrameUrls] = useState<(string | null)[]>(Array(6).fill(null))
  const [reloadKey, setReloadKey] = useState(0)
  const readySlots = useRef(new Set<number>())
  const sessionRef = useRef<{ gameId: string | null; inviteCode: string | null }>({
    gameId: null,
    inviteCode: null,
  })
  const launchIdRef = useRef(crypto.randomUUID())
  const playerCountRef = useRef(playerCount)
  const namesRef = useRef(names)
  const onStatusRef = useRef(onStatus)
  const onSessionChangeRef = useRef(onSessionChange)
  const onLaunchCompleteRef = useRef(onLaunchComplete)

  playerCountRef.current = playerCount
  namesRef.current = names
  onStatusRef.current = onStatus
  onSessionChangeRef.current = onSessionChange
  onLaunchCompleteRef.current = onLaunchComplete

  const handlePlayerReady = useCallback((payload: DevPlayerReadyPayload) => {
    const slot = Number(payload.slot)
    if (readySlots.current.has(slot)) return

    readySlots.current.add(slot)
    onStatusRef.current(`${payload.displayName} ready (${readySlots.current.size}/${playerCountRef.current})`, {
      gameId: payload.gameId,
      inviteCode: payload.inviteCode,
    })

    if (slot === 0) {
      sessionRef.current = { gameId: payload.gameId, inviteCode: payload.inviteCode }
      onSessionChangeRef.current(payload.gameId, payload.inviteCode)
    }
  }, [])

  const pollPlayerReady = useCallback(async () => {
    try {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/dev/api/player-ready?launchId=${encodeURIComponent(launchIdRef.current)}`,
      )
      if (!res.ok) return
      const data = (await res.json()) as { ready?: DevPlayerReadyPayload[] }
      for (const payload of data.ready ?? []) {
        handlePlayerReady(payload)
      }
    } catch {
      // Vite dev server may still be starting
    }
  }, [baseUrl, handlePlayerReady])

  const waitFor = useCallback(
    async (predicate: () => boolean, timeoutMs: number) => {
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        if (predicate()) return
        await pollPlayerReady()
        await delay(300)
      }
      throw new Error('Timed out waiting for players')
    },
    [pollPlayerReady],
  )

  const navigateAll = useCallback(
    (route: string) => {
      const gid = sessionRef.current.gameId
      if (!gid) return
      setFrameUrls((prev) => {
        const next = [...prev]
        for (let slot = 0; slot < playerCountRef.current; slot += 1) {
          if (next[slot]) next[slot] = buildGameUrl(baseUrl, gid, route, slot)
        }
        return next
      })
      onStatusRef.current(`Navigated all players to ${route}`, {
        gameId: gid,
        inviteCode: sessionRef.current.inviteCode,
      })
    },
    [baseUrl],
  )

  const reloadAll = useCallback(() => {
    const gid = sessionRef.current.gameId
    // Prefer reloading settled game routes — remounting /dev/player?fresh=1
    // re-creates auth (and a new host game) and blanks the session.
    if (gid) {
      setFrameUrls((prev) => {
        const next = [...prev]
        for (let slot = 0; slot < playerCountRef.current; slot += 1) {
          if (next[slot]) next[slot] = buildGameUrl(baseUrl, gid, 'lobby', slot)
        }
        return next
      })
    }
    setReloadKey((k) => k + 1)
    onStatusRef.current('Reloaded all player views', sessionRef.current)
  }, [baseUrl])

  const reset = useCallback(() => {
    const previousLaunchId = launchIdRef.current
    readySlots.current.clear()
    sessionRef.current = { gameId: null, inviteCode: null }
    launchIdRef.current = crypto.randomUUID()
    setFrameUrls(Array(6).fill(null))
    onSessionChangeRef.current(null, null)

    void fetch(
      `${baseUrl.replace(/\/$/, '')}/dev/api/player-ready?launchId=${encodeURIComponent(previousLaunchId)}`,
      { method: 'DELETE' },
    ).catch(() => {})
  }, [baseUrl])

  const loadJoinSlot = useCallback(
    (slot: number, code: string) => {
      setFrameUrls((prev) => {
        const next = [...prev]
        next[slot] = buildPlayerUrl(baseUrl, slot, launchIdRef.current, {
          action: 'join',
          name: namesRef.current[slot] ?? `Player ${slot + 1}`,
          code,
        })
        return next
      })
    },
    [baseUrl],
  )

  const launch = useCallback(async () => {
    reset()
    readySlots.current.clear()
    onStatusRef.current('Launching host...')

    setFrameUrls(() => {
      const urls: (string | null)[] = Array(6).fill(null)
      urls[0] = buildPlayerUrl(baseUrl, 0, launchIdRef.current, {
        action: 'create',
        name: namesRef.current[0] ?? 'Alice',
      })
      return urls
    })

    await waitFor(() => sessionRef.current.inviteCode !== null, 45000)
    onStatusRef.current(`Invite ${sessionRef.current.inviteCode} — joining players sequentially...`, sessionRef.current)

    const code = sessionRef.current.inviteCode!
    for (let slot = 1; slot < playerCountRef.current; slot += 1) {
      loadJoinSlot(slot, code)
      await waitFor(() => readySlots.current.has(slot), 45000)
      await delay(500)
    }

    await waitFor(() => readySlots.current.size >= playerCountRef.current, 10000)

    const gid = sessionRef.current.gameId
    if (!gid) throw new Error('Missing game id')

    if (scenario !== 'lobby') {
      onStatusRef.current(`Applying scenario: ${scenario}...`, {
        gameId: gid,
        inviteCode: sessionRef.current.inviteCode,
      })
      await applyScenarioFromGameServer(baseUrl, gid, scenario)
    }

    const route = routeForScenario(scenario)
    setFrameUrls((prev) => {
      const next = [...prev]
      for (let slot = 0; slot < playerCountRef.current; slot += 1) {
        next[slot] = buildGameUrl(baseUrl, gid, route, slot)
      }
      return next
    })

    onStatusRef.current(`Session ready (${scenario})`, {
      gameId: gid,
      inviteCode: sessionRef.current.inviteCode,
    })
    onLaunchCompleteRef.current?.(true)
  }, [baseUrl, loadJoinSlot, reset, scenario, waitFor])

  useImperativeHandle(ref, () => ({ launch, navigateAll, reloadAll, reset }), [launch, navigateAll, reloadAll, reset])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== 'fringo-dev-player-ready') return
      handlePlayerReady(event.data as DevPlayerReadyPayload)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handlePlayerReady])

  useEffect(() => {
    void launch().catch((e) => {
      onStatusRef.current(e instanceof Error ? e.message : 'Launch failed', { error: true })
      onLaunchCompleteRef.current?.(false)
    })
    // Each PlayerGrid instance launches once when mounted (parent remounts via launchToken).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="player-grid"
      style={{ gridTemplateColumns: `repeat(${Math.min(playerCount, 3)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: playerCount }, (_, slot) => (
        <div key={`${reloadKey}-${slot}`} className="player-panel">
          <div className="player-label">
            {slot === 0 ? 'Host' : `P${slot + 1}`}: {names[slot] ?? `Player ${slot + 1}`}
          </div>
          {frameUrls[slot] ? (
            <iframe
              title={`Player ${slot}`}
              src={frameUrls[slot]!}
              className="player-frame"
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <div className="player-placeholder">Waiting to launch...</div>
          )}
        </div>
      ))}
    </div>
  )
})

export { DEFAULT_NAMES, buildGameUrl }
