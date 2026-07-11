import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

export type DevScenario = 'lobby' | 'setup' | 'setup-seeded' | 'active' | 'reveal'

export const SCENARIO_LABELS: Record<DevScenario, string> = {
  lobby: 'Lobby — players joined, waiting',
  setup: 'Setup — voting phase (empty)',
  'setup-seeded': 'Setup — prefilled submissions & upvotes',
  active: 'Active — boards generated, gameplay',
  reveal: 'Reveal — post-game results',
}

const SAMPLE_ACTIONS = [
  'Orders the weirdest drink on the menu',
  'Starts an impromptu group singalong',
  'Challenges someone to arm wrestling',
  'Takes a selfie with a stranger',
  'Invents a new cocktail name out loud',
  'Does a dramatic toast to nobody in particular',
  'Disappears for ten minutes without explanation',
  'Brings up an embarrassing story from high school',
  'Tries to start a conga line',
  'Insists on splitting the bill in the most complicated way',
  'Gets overly competitive at a bar game',
  'Makes friends with the bartender',
  'Pretends to be the group tour guide',
  'Orders food for the whole table without asking',
  'Starts quoting a movie loudly',
  'Loses something important and does not care',
  'Convinces someone to do karaoke',
  'Tells a story that goes on way too long',
  'Takes charge of playlist duties',
  'Misremembers someone\'s name confidently',
  'Proposes an absurd group challenge',
  'Gets philosophical after one drink',
  'Tries to pay with exact change only',
  'Dances like nobody is watching (everyone is)',
]

export function createAdminClient(url: string, serviceRoleKey: string) {
  const options: NonNullable<Parameters<typeof createClient>[2]> = {
    auth: { persistSession: false, autoRefreshToken: false },
  }
  if (typeof WebSocket === 'undefined') {
    options.realtime = { transport: ws as unknown as typeof WebSocket }
  }
  return createClient(url, serviceRoleKey, options)
}

export function routeForScenario(scenario: DevScenario): string {
  switch (scenario) {
    case 'lobby':
      return 'lobby'
    case 'setup':
    case 'setup-seeded':
      return 'setup'
    case 'active':
      return 'boards'
    case 'reveal':
      return 'reveal'
  }
}

export async function applyScenario(
  admin: SupabaseClient,
  gameId: string,
  scenario: DevScenario,
): Promise<void> {
  if (scenario === 'lobby') return

  await admin.from('games').update({ status: 'setup', updated_at: new Date().toISOString() }).eq('id', gameId)

  if (scenario === 'setup') return

  await seedSubmissions(admin, gameId)

  if (scenario === 'setup-seeded') return

  await finalizeAndStart(admin, gameId)

  if (scenario === 'active') return

  await admin
    .from('games')
    .update({ status: 'ended', ends_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', gameId)

  await admin.from('games').update({ status: 'revealed', updated_at: new Date().toISOString() }).eq('id', gameId)
  await admin.from('selected_actions').update({ global_state: 'revealed' }).eq('game_id', gameId)
  await admin.from('boards').update({ state: 'revealed' }).eq('game_id', gameId)
}

async function seedSubmissions(admin: SupabaseClient, gameId: string) {
  const { data: settings } = await admin.from('game_settings').select('actions_per_target').eq('game_id', gameId).single()
  const required = settings?.actions_per_target ?? 8

  const { data: players, error } = await admin
    .from('game_players')
    .select('id, display_name')
    .eq('game_id', gameId)
    .eq('status', 'active')

  if (error) throw error
  if (!players?.length) throw new Error('No active players')

  let actionIdx = 0

  for (const target of players) {
    const submitters = players.filter((p) => p.id !== target.id)
    let created = 0
    let round = 0

    while (created < required + 2 && round < 20) {
      for (const submitter of submitters) {
        if (created >= required + 2) break
        const text = `${SAMPLE_ACTIONS[actionIdx % SAMPLE_ACTIONS.length]} (#${actionIdx + 1})`
        actionIdx += 1

        const { data: sub, error: insertError } = await admin
          .from('action_submissions')
          .insert({
            game_id: gameId,
            target_player_id: target.id,
            submitted_by_player_id: submitter.id,
            text,
            status: 'submitted',
          })
          .select('id')
          .single()

        if (insertError) continue
        created += 1

        for (const voter of submitters) {
          if (voter.id === submitter.id) continue
          await admin.from('action_upvotes').insert({
            submission_id: sub.id,
            voter_player_id: voter.id,
          })
        }
      }
      round += 1
    }
  }
}

async function finalizeAndStart(admin: SupabaseClient, gameId: string) {
  const { data: players } = await admin
    .from('game_players')
    .select('id')
    .eq('game_id', gameId)
    .eq('status', 'active')

  for (const player of players ?? []) {
    const { error } = await admin.rpc('finalize_actions_for_target', {
      p_game_id: gameId,
      p_target_player_id: player.id,
    })
    if (error) throw error
  }

  const { error: boardError } = await admin.rpc('generate_boards', { p_game_id: gameId })
  if (boardError) throw boardError

  const { data: settings } = await admin.from('game_settings').select('guesses_per_target').eq('game_id', gameId).single()

  await admin
    .from('game_players')
    .update({ guesses_remaining: settings?.guesses_per_target ?? 2 })
    .eq('game_id', gameId)
    .eq('status', 'active')

  await admin
    .from('games')
    .update({
      status: 'active',
      starts_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId)
}

export async function waitForDevServer(baseUrl: string, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl, { method: 'HEAD' })
      if (res.ok) return true
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}
