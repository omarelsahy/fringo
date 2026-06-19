/**
 * Seeds setup-phase submissions and random upvotes for the active setup game.
 * Usage: node scripts/seed-setup.mjs
 */

import crypto from 'node:crypto'

const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const API = 'http://127.0.0.1:54321'

function signJwt(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'supabase-demo',
      sub: userId,
      aud: 'authenticated',
      role: 'authenticated',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url')
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

async function rpc(token, fn, args) {
  const res = await fetch(`${API}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${fn} failed (${res.status}): ${text}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function getSetupGame() {
  const res = await fetch(
    `${API}/rest/v1/rpc/get_setup_progress`,
    {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${signJwt('00000000-0000-0000-0000-000000000000')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_game_id: 'ce6f0a55-b0c4-419c-a230-e4eb3011561a' }),
    },
  )
  // fallback: hardcoded from demo
}

// Demo game players (from DB)
const GAME_ID = 'ce6f0a55-b0c4-419c-a230-e4eb3011561a'
const PLAYERS = [
  { playerId: '1beac5a3-0b2e-47d8-9bff-2992c24cf733', name: 'Player', userId: '8ff7a3e7-29be-4bd6-8adb-9f3c67b6d12d' },
  { playerId: 'e1fcd241-4c00-4fc2-b57b-5b2b5cd6f4f0', name: 'Blake', userId: 'c5f673eb-72d9-439f-a3a4-a99a87d263d7' },
  { playerId: '164a2480-a334-4b9a-8537-e4870f93aba2', name: 'Casey', userId: '39406a58-a775-497e-b054-dcd9bc9a52eb' },
  { playerId: 'd5fe2adb-6459-4272-b1ca-aef199deb215', name: 'Drew', userId: '87719c1e-44cc-43ea-9fd7-2741e2f572c4' },
  { playerId: '0165a84c-de4d-4f11-8bab-38f3f56101b8', name: 'Elliot', userId: '0f95788f-1ed3-407a-b9fc-e0de287e3bdd' },
]

const TEMPLATES = [
  '{name} orders delivery mid-game',
  '{name} explains a rule wrong and doubles down',
  '{name} checks their phone during someone\'s turn',
  '{name} says "one more round" at least twice',
  '{name} spills something on the table',
  '{name} trash talks after winning a round',
  '{name} suggests switching to a different game',
  '{name} forgets whose turn it is',
  '{name} shows up late with snacks for themselves only',
  '{name} narrates their strategy out loud',
  '{name} quotes a meme nobody understands',
  '{name} gets caught bending the rules',
  '{name} dozes off between turns',
  '{name} takes a suspiciously long bathroom break',
  '{name} brings up an awkward story from the past',
  '{name} reads every card in a dramatic voice',
  '{name} insists on being the banker every time',
  '{name} blames the dice for a bad roll',
  '{name} tries to start a side bet',
  '{name} reorganizes someone else\'s game pieces',
]

function pickTemplates(targetName, count, seed) {
  const shuffled = [...TEMPLATES].sort((a, b) => {
    const ha = crypto.createHash('md5').update(`${seed}-${a}`).digest('hex')
    const hb = crypto.createHash('md5').update(`${seed}-${b}`).digest('hex')
    return ha.localeCompare(hb)
  })
  return shuffled.slice(0, count).map((t) => t.replaceAll('{name}', targetName))
}

function tokenFor(userId) {
  return signJwt(userId)
}

function rand() {
  return Math.random()
}

async function main() {
  const submissionIds = []
  let templateIdx = 0

  console.log('Submitting actions...')

  for (const submitter of PLAYERS) {
    const token = tokenFor(submitter.userId)
    for (const target of PLAYERS) {
      if (target.playerId === submitter.playerId) continue

      const actions = pickTemplates(target.name, 2, `${submitter.name}-${target.name}`)
      for (const text of actions) {
        try {
          const id = await rpc(token, 'submit_action', {
            p_game_id: GAME_ID,
            p_target_player_id: target.playerId,
            p_text: text,
          })
          submissionIds.push({
            id,
            targetId: target.playerId,
            submitterId: submitter.playerId,
            text,
          })
          console.log(`  ✓ ${submitter.name} → ${target.name}: "${text}"`)
        } catch (e) {
          console.warn(`  skip: ${e.message}`)
        }
        templateIdx++
      }
    }
  }

  console.log(`\nSubmitted ${submissionIds.length} actions. Adding random upvotes...`)

  let upvoteCount = 0
  for (const voter of PLAYERS) {
    const token = tokenFor(voter.userId)
    const feed = await rpc(token, 'get_setup_feed', { p_game_id: GAME_ID })

    for (const item of feed) {
      if (item.is_mine) continue
      if (item.target_player_id === voter.playerId) continue
      if (item.voted_by_me) continue
      if (rand() < 0.55) {
        try {
          await rpc(token, 'upvote_submission', { p_submission_id: item.id })
          upvoteCount++
          console.log(`  ▲ ${voter.name} upvoted "${item.text.slice(0, 40)}..." (${item.vote_count + 1})`)
        } catch (e) {
          console.warn(`  upvote skip: ${e.message}`)
        }
      }
    }
  }

  console.log(`\nDone! ${submissionIds.length} submissions, ${upvoteCount} upvotes added.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
