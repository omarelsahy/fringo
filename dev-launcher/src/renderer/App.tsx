import { useEffect, useMemo, useState } from 'react'
import type { DevScenario } from '../../../src/dev/scenarios'
import { SCENARIO_LABELS } from '../../../src/dev/scenarios'
import type { LauncherStatus } from '../shared/types'

const DEFAULT_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']
const ROUTES = ['lobby', 'setup', 'boards', 'scoreboard', 'reveal'] as const

export function App() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:5173')
  const [playerCount, setPlayerCount] = useState(4)
  const [names, setNames] = useState(DEFAULT_NAMES)
  const [scenario, setScenario] = useState<DevScenario>('setup-seeded')
  const [status, setStatus] = useState<LauncherStatus>({ message: 'Start Supabase + npm run dev, then launch a session.' })
  const [busy, setBusy] = useState(false)
  const [serverOk, setServerOk] = useState<boolean | null>(null)

  useEffect(() => {
    const unsub = window.fringoLauncher.onStatus(setStatus)
    return unsub
  }, [])

  useEffect(() => {
    void window.fringoLauncher.checkDevServer(baseUrl).then(setServerOk)
  }, [baseUrl])

  const visibleNames = useMemo(() => names.slice(0, playerCount), [names, playerCount])

  async function handleLaunch() {
    setBusy(true)
    try {
      await window.fringoLauncher.launchSession({
        baseUrl,
        playerCount,
        names: visibleNames,
        scenario,
      })
    } catch {
      // status updated via IPC
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="row">
        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="baseUrl">Game dev server</label>
          <input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:5173"
          />
        </div>

        <div className="field">
          <label htmlFor="count">Players</label>
          <input
            id="count"
            type="number"
            min={2}
            max={6}
            value={playerCount}
            onChange={(e) => setPlayerCount(Number(e.target.value))}
          />
        </div>

        <div className="field" style={{ minWidth: 240 }}>
          <label htmlFor="scenario">Scenario</label>
          <select id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value as DevScenario)}>
            {(Object.keys(SCENARIO_LABELS) as DevScenario[]).map((key) => (
              <option key={key} value={key}>
                {SCENARIO_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <button onClick={() => void handleLaunch()} disabled={busy}>
          {busy ? 'Launching…' : 'Launch Session'}
        </button>
        <button className="secondary" onClick={() => void window.fringoLauncher.reloadAll()} disabled={busy}>
          Reload All
        </button>
        <button className="secondary" onClick={() => void window.fringoLauncher.resetSession()} disabled={busy}>
          Reset
        </button>
      </div>

      <div className="row names">
        {visibleNames.map((name, i) => (
          <div key={i} className="field">
            <label>{i === 0 ? 'Host' : `P${i + 1}`}</label>
            <input
              value={name}
              onChange={(e) => {
                const next = [...names]
                next[i] = e.target.value
                setNames(next)
              }}
            />
          </div>
        ))}
      </div>

      <div className="row">
        {ROUTES.map((route) => (
          <button
            key={route}
            className="secondary"
            disabled={busy || !status.gameId}
            onClick={() => void window.fringoLauncher.navigateAll(route)}
          >
            → {route}
          </button>
        ))}
      </div>

      <div className={`status${status.error ? ' error' : ''}`}>
        {status.message}
        {status.inviteCode ? ` · Code ${status.inviteCode}` : ''}
        {status.readyCount !== undefined && status.playerCount
          ? ` · ${status.readyCount}/${status.playerCount} ready`
          : ''}
      </div>

      <div className="hint">
        {serverOk === false && 'Dev server not reachable — run `npm run dev` in the repo root.'}
        {serverOk === true && 'Dev server reachable. Player screens appear below this toolbar.'}
      </div>
    </div>
  )
}
