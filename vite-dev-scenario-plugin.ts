import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { applyScenario, createAdminClient, type DevScenario } from './src/dev/scenarios'
import {
  clearPlayerReadySession,
  getPlayerReadyState,
  registerPlayerReady,
  type DevPlayerReadyPayload,
} from './src/dev/session-bus'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function setDevCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function withDevCors(
  handler: (req: IncomingMessage, res: ServerResponse, ...args: unknown[]) => Promise<void>,
) {
  return (req: IncomingMessage, res: ServerResponse, ...args: unknown[]) => {
    setDevCorsHeaders(res)
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    void handler(req, res, ...args)
  }
}

export function devScenarioApiPlugin(): Plugin {
  return {
    name: 'fringo-dev-scenario-api',
    configureServer(server) {
      server.middlewares.use('/dev/api/scenario', withDevCors((req, res) => handleScenario(req, res, server)))
      server.middlewares.use('/dev/api/player-ready', withDevCors((req, res) => handlePlayerReady(req, res)))
    },
  }
}

async function handlePlayerReady(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'GET') {
    const launchId = url.searchParams.get('launchId')
    if (!launchId) {
      res.statusCode = 400
      res.end('launchId required')
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ready: getPlayerReadyState(launchId) }))
    return
  }

  if (req.method === 'DELETE') {
    const launchId = url.searchParams.get('launchId')
    if (!launchId) {
      res.statusCode = 400
      res.end('launchId required')
      return
    }

    clearPlayerReadySession(launchId)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  try {
    const raw = await readBody(req)
    const body = JSON.parse(raw) as { launchId?: string } & DevPlayerReadyPayload

    if (!body.launchId || body.slot === undefined || !body.gameId || !body.inviteCode || !body.displayName) {
      res.statusCode = 400
      res.end('launchId, slot, gameId, inviteCode, and displayName required')
      return
    }

    registerPlayerReady(body.launchId, {
      slot: Number(body.slot),
      gameId: body.gameId,
      inviteCode: body.inviteCode,
      displayName: body.displayName,
      role: body.role === 'host' ? 'host' : 'player',
    })

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true }))
  } catch (e) {
    res.statusCode = 500
    res.end(e instanceof Error ? e.message : 'Player ready failed')
  }
}

async function handleScenario(req: IncomingMessage, res: ServerResponse, server: Parameters<NonNullable<Plugin['configureServer']>>[0]) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  try {
    const raw = await readBody(req)
    const body = JSON.parse(raw) as { gameId?: string; scenario?: DevScenario }

    if (!body.gameId || !body.scenario) {
      res.statusCode = 400
      res.end('gameId and scenario required')
      return
    }

    const env = loadEnv(server.config.mode, server.config.envDir, '')
    const url = env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
    const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!key) {
      res.statusCode = 500
      res.end('Missing SUPABASE_SERVICE_ROLE_KEY in .env (from `npx supabase status -o env`)')
      return
    }
    const admin = createAdminClient(url, key)
    await applyScenario(admin, body.gameId, body.scenario)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true }))
  } catch (e) {
    res.statusCode = 500
    res.end(e instanceof Error ? e.message : 'Scenario failed')
  }
}
