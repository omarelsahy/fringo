/**
 * Seeds an active game where Bob claims Carol,
 * so the host's board for Carol shows the locked overlay.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { applyScenario, createAdminClient, createNodeSupabaseClient } from '../src/dev/scenarios'

function readEnv(name: string): string {
  if (process.env[name]) return process.env[name]!
  const match = readFileSync('.env', 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'))
  if (!match?.[1]) throw new Error(`Missing ${name}`)
  return match[1].trim()
}

const url = readEnv('VITE_SUPABASE_URL')
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

const admin = await createAdminClient(url, service)

const host = await createPlayer()
const gameId = (await rpc(host, 'create_game', {
  p_name: 'Locked Board Demo',
  p_category: 'demo',
  p_board_rows: 3,
  p_board_cols: 3,
  p_has_free_space: true,
  p_actions_per_target: 8,
  p_guesses_per_target: 2,
  p_allow_diagonals: true,
})) as string

const { data: game } = await host.from('games').select('invite_code').eq('id', gameId).single()
const inviteCode = game?.invite_code as string

const bobClient = await createPlayer()
await rpc(bobClient, 'join_game', { p_invite_code: inviteCode, p_display_name: 'Bob' })

const carolClient = await createPlayer()
await rpc(carolClient, 'join_game', { p_invite_code: inviteCode, p_display_name: 'Carol' })

await applyScenario(admin, gameId, 'active')

const { data: players } = await admin
  .from('game_players')
  .select('id, display_name, role')
  .eq('game_id', gameId)

const hostPlayer = players?.find((p) => p.role === 'host')
const bobPlayer = players?.find((p) => p.display_name === 'Bob')
const carolPlayer = players?.find((p) => p.display_name === 'Carol')

const hostId = hostPlayer?.id
const bobId = bobPlayer?.id
const carolId = carolPlayer?.id

if (!hostId || !bobId || !carolId) {
  throw new Error(`Missing players: ${JSON.stringify(players)}`)
}

const { data: bobBoard } = await admin
  .from('boards')
  .select('id')
  .eq('game_id', gameId)
  .eq('owner_player_id', bobId)
  .eq('target_player_id', carolId)
  .single()

if (!bobBoard) throw new Error('Bob board for Carol not found')

const { data: squares } = await admin
  .from('board_squares')
  .select('id, row_index, col_index, state')
  .eq('board_id', bobBoard.id)
  .order('row_index')
  .order('col_index')

const row0 = (squares ?? []).filter((s) => s.row_index === 0 && s.state === 'unmarked')
for (const sq of row0) {
  const result = await rpc(bobClient, 'mark_square', { p_board_square_id: sq.id })
  console.log('mark', sq.row_index, sq.col_index, JSON.stringify(result))
}

const { data: hostBoard } = await admin
  .from('boards')
  .select('id, state')
  .eq('game_id', gameId)
  .eq('owner_player_id', hostId)
  .eq('target_player_id', carolId)
  .single()

if (!hostBoard) throw new Error('Host board for Carol not found')

const boardUrl = `http://localhost:5173/game/${gameId}/boards/${hostBoard.id}`

const session = (await host.auth.getSession()).data.session
mkdirSync('/opt/cursor/artifacts', { recursive: true })
writeFileSync(
  '/opt/cursor/artifacts/demo-session.json',
  JSON.stringify({
    boardUrl,
    gameId,
    hostBoardId: hostBoard.id,
    hostBoardState: hostBoard.state,
    access_token: session?.access_token,
    refresh_token: session?.refresh_token,
  }, null, 2),
)

console.log(JSON.stringify({ boardUrl, hostBoardState: hostBoard.state, gameId }, null, 2))
