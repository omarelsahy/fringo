import { createClient } from '@supabase/supabase-js'
import { applyScenario, createAdminClient } from '../src/dev/scenarios'

const url = 'http://127.0.0.1:54321'
const anon =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const service =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

async function createPlayer() {
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { error } = await client.auth.signInAnonymously()
  if (error) throw error
  return client
}

async function rpc(client: ReturnType<typeof createClient>, fn: string, args: Record<string, unknown>) {
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

const admin = createAdminClient(url, service)

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
console.log('vite api', res.status, await res.text())

const devPage = await fetch('http://localhost:5173/dev')
console.log('dev grid page', devPage.status)
