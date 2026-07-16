import { existsSync, readFileSync } from 'node:fs'
import { applyScenario, createAdminClient, createNodeSupabaseClient } from '../src/dev/scenarios'

function readEnv(name: string, fallback?: string): string {
  if (process.env[name]) return process.env[name]!
  if (existsSync('.env')) {
    const match = readFileSync('.env', 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'))
    if (match?.[1]) return match[1].trim()
  }
  if (fallback) return fallback
  throw new Error(`Missing ${name} — run scripts/sync-env-from-supabase.mjs after supabase start`)
}

const url = readEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
const anon = readEnv('VITE_SUPABASE_ANON_KEY')
const service = readEnv('SUPABASE_SERVICE_ROLE_KEY')

type PlayerClient = Awaited<ReturnType<typeof createNodeSupabaseClient>>

async function createPlayer() {
  const client = await createNodeSupabaseClient(url, anon, { auth: { persistSession: false } })
  const { error } = await client.auth.signInAnonymously()
  if (error) throw error
  return client
}

async function rpc(client: PlayerClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(fn as never, args as never)
  if (error) throw error
  return data
}

async function createLobbyGame() {
  const host = await createPlayer()
  const gameId = (await rpc(host, 'create_game', {
    p_name: 'Test',
    p_category: 'dev',
    p_board_rows: 3,
    p_board_cols: 3,
    p_has_free_space: true,
    p_actions_per_target: 8,
    p_guesses_per_target: 2,
    p_allow_diagonals: true,
  })) as string

  const { data: game } = await host.from('games').select('invite_code, status').eq('id', gameId).single()

  for (const name of ['Bob', 'Carol']) {
    const p = await createPlayer()
    await rpc(p, 'join_game', { p_invite_code: game?.invite_code, p_display_name: name })
  }

  return gameId
}

const admin = await createAdminClient(url, service)

for (const scenario of ['setup-seeded', 'active', 'reveal'] as const) {
  const gameId = await createLobbyGame()
  await applyScenario(admin, gameId, scenario)
  const { data } = await admin.from('games').select('status').eq('id', gameId).single()
  console.log(scenario, '=>', data?.status)
}

const apiGameId = await createLobbyGame()
const res = await fetch('http://localhost:5173/dev/api/scenario', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ gameId: apiGameId, scenario: 'active' }),
})
const apiBody = await res.text()
if (!res.ok) throw new Error(`vite api failed: ${res.status} ${apiBody}`)
console.log('vite api', res.status, apiBody)

const devPage = await fetch('http://localhost:5173/dev')
if (!devPage.ok) throw new Error(`dev grid page failed: ${devPage.status}`)
console.log('dev grid page', devPage.status)
