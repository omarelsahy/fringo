import { app, BrowserView, BrowserWindow, ipcMain, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  applyScenario,
  createAdminClient,
  routeForScenario,
  waitForDevServer,
} from '../../../src/dev/scenarios'
import type { DevPlayerReadyPayload, LauncherStatus, SessionConfig } from '../shared/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadServiceRoleKey(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  const envPath = path.resolve(__dirname, '../../../.env')
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)
    if (match?.[1]) return match[1].trim()
  }
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env from `npx supabase status -o env`')
}

const TOOLBAR_HEIGHT = 148
const MIN_WIDTH = 1100
const MIN_HEIGHT = 720

let mainWindow: BrowserWindow | null = null
const playerViews = new Map<number, BrowserView>()
let sessionState: {
  gameId: string | null
  inviteCode: string | null
  playerCount: number
  baseUrl: string
  readySlots: Set<number>
} = {
  gameId: null,
  inviteCode: null,
  playerCount: 0,
  baseUrl: 'http://localhost:5173',
  readySlots: new Set(),
}

function resolvePreload(name: string) {
  const js = path.join(__dirname, `../preload/${name}.js`)
  const mjs = path.join(__dirname, `../preload/${name}.mjs`)
  if (existsSync(js)) return js
  if (existsSync(mjs)) return mjs
  return js
}

function playerPreloadPath() {
  return resolvePreload('player')
}

function emitStatus(status: LauncherStatus) {
  mainWindow?.webContents.send('launcher-status', status)
}

function buildPlayerBootstrapUrl(baseUrl: string, slot: number, opts: {
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

function clearPlayerViews() {
  if (!mainWindow) return
  for (const view of playerViews.values()) {
    mainWindow.removeBrowserView(view)
    view.webContents.close()
  }
  playerViews.clear()
}

function layoutPlayerViews(count: number) {
  if (!mainWindow) return
  const bounds = mainWindow.getContentBounds()
  const cols = count <= 3 ? count : 3
  const rows = Math.ceil(count / cols)
  const width = Math.floor(bounds.width / cols)
  const height = Math.floor((bounds.height - TOOLBAR_HEIGHT) / rows)

  const views = [...playerViews.entries()].sort((a, b) => a[0] - b[0]).map(([, view]) => view)
  views.forEach((view, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    view.setBounds({
      x: col * width,
      y: TOOLBAR_HEIGHT + row * height,
      width,
      height,
    })
    view.setAutoResize({ width: true, height: true })
  })
}

function createPlayerView(slot: number) {
  if (!mainWindow) throw new Error('No main window')

  const partition = `persist:fringo-dev-player-${slot}`
  void session.fromPartition(partition).clearStorageData()

  const view = new BrowserView({
    webPreferences: {
      partition,
      preload: playerPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.addBrowserView(view)
  playerViews.set(slot, view)
  return view
}

async function waitForReady(count: number, timeoutMs: number) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (sessionState.readySlots.size >= count) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Timed out waiting for ${count} players (got ${sessionState.readySlots.size})`)
}

async function waitForInviteCode(timeoutMs: number) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (sessionState.inviteCode) return sessionState.inviteCode
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('Timed out waiting for host to create game')
}

async function launchSession(config: SessionConfig) {
  clearPlayerViews()
  sessionState = {
    gameId: null,
    inviteCode: null,
    playerCount: config.playerCount,
    baseUrl: config.baseUrl,
    readySlots: new Set(),
  }

  emitStatus({ message: 'Checking dev server...', playerCount: config.playerCount, readyCount: 0 })

  const ok = await waitForDevServer(config.baseUrl)
  if (!ok) throw new Error(`Dev server not reachable at ${config.baseUrl}. Run npm run dev first.`)

  emitStatus({ message: 'Launching host...', playerCount: config.playerCount, readyCount: 0 })

  const hostView = createPlayerView(0)
  layoutPlayerViews(config.playerCount)
  await hostView.webContents.loadURL(
    buildPlayerBootstrapUrl(config.baseUrl, 0, {
      action: 'create',
      name: config.names[0] ?? 'Alice',
    }),
  )

  const inviteCode = await waitForInviteCode(25000)
  emitStatus({
    message: `Invite ${inviteCode} — joining other players...`,
    inviteCode,
    gameId: sessionState.gameId,
    playerCount: config.playerCount,
    readyCount: sessionState.readySlots.size,
  })

  for (let slot = 1; slot < config.playerCount; slot += 1) {
    const view = createPlayerView(slot)
    layoutPlayerViews(config.playerCount)
    await view.webContents.loadURL(
      buildPlayerBootstrapUrl(config.baseUrl, slot, {
        action: 'join',
        name: config.names[slot] ?? `Player ${slot + 1}`,
        code: inviteCode,
      }),
    )
  }

  emitStatus({
    message: 'Waiting for all players...',
    inviteCode,
    gameId: sessionState.gameId,
    playerCount: config.playerCount,
    readyCount: sessionState.readySlots.size,
  })

  await waitForReady(config.playerCount, 45000)

  const gameId = sessionState.gameId
  if (!gameId) throw new Error('Missing game id')

  if (config.scenario !== 'lobby') {
    emitStatus({ message: `Applying scenario: ${config.scenario}...`, gameId, inviteCode })
    const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
    const admin = createAdminClient(supabaseUrl, loadServiceRoleKey())
    await applyScenario(admin, gameId, config.scenario)
  }

  const route = routeForScenario(config.scenario)
  for (let slot = 0; slot < config.playerCount; slot += 1) {
    const view = playerViews.get(slot)
    if (!view) continue
    await view.webContents.loadURL(buildGameUrl(config.baseUrl, gameId, route, slot))
  }

  emitStatus({
    message: `Session ready (${config.scenario}) — ${config.playerCount} players`,
    gameId,
    inviteCode,
    playerCount: config.playerCount,
    readyCount: config.playerCount,
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'Fringo Dev Launcher',
    webPreferences: {
      preload: resolvePreload('index'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('resize', () => layoutPlayerViews(sessionState.playerCount || playerViews.size))
  mainWindow.on('closed', () => {
    mainWindow = null
    clearPlayerViews()
  })
}

app.whenReady().then(() => {
  createMainWindow()

  ipcMain.handle('check-dev-server', async (_event, url: string) => waitForDevServer(url, 5000))

  ipcMain.handle('launch-session', async (_event, config: SessionConfig) => {
    try {
      await launchSession(config)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Launch failed'
      emitStatus({ message, error: true })
      throw e
    }
  })

  ipcMain.handle('navigate-all', async (_event, route: string) => {
    const { gameId, baseUrl, playerCount } = sessionState
    if (!gameId) throw new Error('No active session')
    for (let slot = 0; slot < playerCount; slot += 1) {
      const view = playerViews.get(slot)
      if (!view) continue
      await view.webContents.loadURL(buildGameUrl(baseUrl, gameId, route, slot))
    }
    emitStatus({ message: `Navigated all players to ${route}`, gameId, inviteCode: sessionState.inviteCode })
  })

  ipcMain.handle('reload-all', () => {
    for (const view of playerViews.values()) view.webContents.reload()
    emitStatus({ message: 'Reloaded all player views', gameId: sessionState.gameId, inviteCode: sessionState.inviteCode })
  })

  ipcMain.handle('reset-session', () => {
    clearPlayerViews()
    sessionState = {
      gameId: null,
      inviteCode: null,
      playerCount: 0,
      baseUrl: sessionState.baseUrl,
      readySlots: new Set(),
    }
    emitStatus({ message: 'Session reset', gameId: null, inviteCode: null, readyCount: 0 })
  })

  ipcMain.on('player-ready', (_event, payload: DevPlayerReadyPayload) => {
    sessionState.readySlots.add(payload.slot)
    if (payload.slot === 0) {
      sessionState.gameId = payload.gameId
      sessionState.inviteCode = payload.inviteCode
    }
    emitStatus({
      message: `${payload.displayName} ready`,
      gameId: sessionState.gameId,
      inviteCode: sessionState.inviteCode,
      playerCount: sessionState.playerCount,
      readyCount: sessionState.readySlots.size,
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
