import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { applyScenario, createAdminClient, type DevScenario } from './src/dev/scenarios'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

export function devScenarioApiPlugin(): Plugin {
  return {
    name: 'fringo-dev-scenario-api',
    configureServer(server) {
      server.middlewares.use('/dev/api/scenario', (req, res, next) => {
        void handleScenario(req, res, server).catch(next)
      })
    },
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
