import { useEffect, useRef, useState } from 'react'
import type { DevScenario } from '../../../src/dev/scenarios'
import { SCENARIO_LABELS } from '../../../src/dev/scenarios'
import { DEFAULT_NAMES, PlayerGrid, type PlayerGridHandle } from './PlayerGrid'

const ROUTES = ['lobby', 'setup', 'boards', 'scoreboard', 'reveal'] as const

export function App() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:5173')
  const [playerCount, setPlayerCount] = useState(5)
  const [names, setNames] = useState(DEFAULT_NAMES)
  const [scenario, setScenario] = useState<DevScenario>('lobby')
  const [status, setStatus] = useState('Configure players and click Launch Session.')
  const [gameId, setGameId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  const gridRef = useRef<PlayerGridHandle>(null)
  const [launchToken, setLaunchToken] = useState(0)

  useEffect(() => {
    void window.fringoLauncher.checkDevServer(baseUrl).then(setServerOk)
  }, [baseUrl])

  const visibleNames = names.slice(0, playerCount)

  function handleStatus(message: string, extra?: { gameId?: string | null; inviteCode?: string | null; error?: boolean }) {
    setStatus(message)
    if (extra?.gameId !== undefined) setGameId(extra.gameId)
    if (extra?.inviteCode !== undefined) setInviteCode(extra.inviteCode)
  }

  async function handleLaunch() {
    setBusy(true)
    setGameId(null)
    setInviteCode(null)
    setStatus('Launching session...')
    setLaunchToken((t) => t + 1)
    setSessionActive(true)
  }

  return (
    <div className="shell">
      <div className="toolbar">
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

          <div className="field" style={{ minWidth: 260 }}>
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
          <button className="secondary" onClick={() => gridRef.current?.reloadAll()} disabled={!sessionActive}>
            Reload All
          </button>
          <button
            className="secondary"
            onClick={() => {
              gridRef.current?.reset()
              setSessionActive(false)
              setGameId(null)
              setInviteCode(null)
            }}
            disabled={!sessionActive}
          >
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
              disabled={!gameId}
              onClick={() => gridRef.current?.navigateAll(route)}
            >
              → {route}
            </button>
          ))}
        </div>

        <div className="status">
          {status}
          {inviteCode ? ` · Code ${inviteCode}` : ''}
        </div>

        <div className="hint">
          {serverOk === false && 'Dev server not reachable — run `npm run dev` in the repo root.'}
          {serverOk === true && 'Iframe player grid — each panel has isolated auth via ?slot=N.'}
        </div>
      </div>

      {sessionActive && (
        <PlayerGrid
          key={launchToken}
          ref={gridRef}
          baseUrl={baseUrl}
          playerCount={playerCount}
          names={visibleNames}
          scenario={scenario}
          onStatus={handleStatus}
          onSessionChange={(gid, code) => {
            setGameId(gid)
            setInviteCode(code)
          }}
          onLaunchComplete={() => setBusy(false)}
        />
      )}
    </div>
  )
}
