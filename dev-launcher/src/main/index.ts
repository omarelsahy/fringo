import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { applyScenario, createAdminClient, waitForDevServer } from '../../../src/dev/scenarios'
import type { DevScenario } from '../../../src/dev/scenarios'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Headless / VM displays often fail to composite iframe contents with GPU on.
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

const envPath = path.resolve(__dirname, '../../../.env')

function readEnvVar(name: string): string | null {
  if (process.env[name]) return process.env[name]!
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'))
    if (match?.[1]) return match[1].trim()
  }
  return null
}

function loadServiceRoleKey(): string {
  const key = readEnvVar('SUPABASE_SERVICE_ROLE_KEY')
  if (key) return key
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env from `npx supabase status -o env`')
}

async function checkSupabaseHealth(): Promise<{ ok: boolean; url: string }> {
  const url = readEnvVar('VITE_SUPABASE_URL') ?? 'http://127.0.0.1:54321'
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`)
    return { ok: res.ok, url }
  } catch {
    return { ok: false, url }
  }
}

function resolvePreload(name: string) {
  const js = path.join(__dirname, `../preload/${name}.js`)
  const mjs = path.join(__dirname, `../preload/${name}.mjs`)
  if (existsSync(js)) return js
  if (existsSync(mjs)) return mjs
  return js
}

let mainWindow: BrowserWindow | null = null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
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

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createMainWindow()

  ipcMain.handle('check-dev-server', async (_event, url: string) => waitForDevServer(url, 5000))
  ipcMain.handle('check-supabase', async () => checkSupabaseHealth())

  ipcMain.handle('apply-scenario', async (_event, payload: { gameId: string; scenario: DevScenario }) => {
    const supabaseUrl = readEnvVar('VITE_SUPABASE_URL') ?? 'http://127.0.0.1:54321'
    const admin = await createAdminClient(supabaseUrl, loadServiceRoleKey())
    try {
      await applyScenario(admin, payload.gameId, payload.scenario)
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Scenario failed'
      const hint =
        message.includes('permission denied')
          ? ' Run: npm run supabase:reset'
          : ''
      throw new Error(`${message}${hint}`)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
