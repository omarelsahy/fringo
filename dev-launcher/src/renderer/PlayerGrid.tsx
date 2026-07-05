import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from 'react'
import { routeForScenario, type DevScenario } from '../../../src/dev/scenarios'

const DEFAULT_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']

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
    gameName: 'Dev Launcher Game',
  })
  if (opts.code) params.set('code', opts.code)
  return `${baseUrl.replace(/\/$/, '')}/dev/player?${params}`
}

function buildGameUrl(baseUrl: string, gameId: string, route: string, slot: number) {
  const base = baseUrl.replace(/\/$/, '')
  const pathPart = route === 'lobby' ? `/game/${gameId}` : `/game/${gameId}/${route}`
  return `${base}${pathPart}?slot=${slot}`
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
      setTimeout(tick, 300)
    }
    tick()
  })
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
  const nextJoinSlot = useRef(1)
  const playerCountRef = useRef(playerCount)
  const namesRef = useRef(names)
  playerCountRef.current = playerCount
  namesRef.current = names

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
      onStatus(`Navigated all players to ${route}`, { gameId: gid, inviteCode: sessionRef.current.inviteCode })
    },
    [baseUrl, onStatus],
  )

  const reloadAll = useCallback(() => {
    setReloadKey((k) => k + 1)
    onStatus('Reloaded all player views', sessionRef.current)
  }, [onStatus])

  const reset = useCallback(() => {
    readySlots.current.clear()
    nextJoinSlot.current = 1
    sessionRef.current = { gameId: null, inviteCode: null }
    setFrameUrls(Array(6).fill(null))
    onSessionChange(null, null)
  }, [onSessionChange])

  const loadJoinSlot = useCallback(
    (slot: number, code: string) => {
      setFrameUrls((prev) => {
        const next = [...prev]
        next[slot] = buildPlayerUrl(baseUrl, slot, {
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
    nextJoinSlot.current = 1
    onStatus('Launching host...')

    setFrameUrls(() => {
      const urls: (string | null)[] = Array(6).fill(null)
      urls[0] = buildPlayerUrl(baseUrl, 0, { action: 'create', name: namesRef.current[0] ?? 'Alice' })
      return urls
    })

    await waitFor(() => sessionRef.current.inviteCode !== null, 45000)
    onStatus(`Invite ${sessionRef.current.inviteCode} — joining players sequentially...`, sessionRef.current)

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
      onStatus(`Applying scenario: ${scenario}...`, { gameId: gid, inviteCode: sessionRef.current.inviteCode })
      await window.fringoLauncher.applyScenario(gid, scenario)
    }

    const route = routeForScenario(scenario)
    setFrameUrls((prev) => {
      const next = [...prev]
      for (let slot = 0; slot < playerCountRef.current; slot += 1) {
        next[slot] = buildGameUrl(baseUrl, gid, route, slot)
      }
      return next
    })

    onStatus(`Session ready (${scenario})`, { gameId: gid, inviteCode: sessionRef.current.inviteCode })
    onLaunchComplete?.(true)
  }, [baseUrl, loadJoinSlot, onLaunchComplete, onStatus, reset, scenario])

  useImperativeHandle(ref, () => ({ launch, navigateAll, reloadAll, reset }), [launch, navigateAll, reloadAll, reset])

  useEffect(() => {
    void launch().catch((e) => {
      onStatus(e instanceof Error ? e.message : 'Launch failed', { error: true })
      onLaunchComplete?.(false)
    })
  }, [launch, onLaunchComplete, onStatus])

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
      onStatus(`${displayName} ready (${readySlots.current.size}/${playerCountRef.current})`, {
        gameId: gid,
        inviteCode: code,
      })

      if (slot === 0) {
        sessionRef.current = { gameId: gid, inviteCode: code }
        onSessionChange(gid, code)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onSessionChange, onStatus])

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
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
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
