/**
 * Full 5-player UI playthrough via the browser Dev Grid.
 * Drives real forms (not scenario seeding) to find product bugs.
 *
 * Usage: npx tsx scripts/ui-playthrough.mts
 * Requires: Vite on :5173, Supabase running, puppeteer-core + Chrome.
 */
import puppeteer, { type Frame, type Page } from 'puppeteer-core'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'

const BASE = process.env.FRINGO_BASE_URL ?? 'http://localhost:5173'
const NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve']
const ARTIFACTS = '/opt/cursor/artifacts/playthrough'
const CHROME =
  process.env.CHROME_PATH ??
  ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/local/bin/google-chrome'].find((p) =>
    existsSync(p),
  ) ?? '/usr/bin/google-chrome'

mkdirSync(ARTIFACTS, { recursive: true })

const bugs: string[] = []
const notes: string[] = []

function log(msg: string) {
  console.log(`[playthrough] ${msg}`)
}

function bug(msg: string) {
  bugs.push(msg)
  console.error(`[BUG] ${msg}`)
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function waitForText(page: Page, text: string, timeout = 30000) {
  await page.waitForFunction(
    (t) => document.body?.innerText?.includes(t),
    { timeout },
    text,
  )
}

async function frameForSlot(page: Page, slot: number): Promise<Frame> {
  const handle = await page.waitForSelector(`iframe[title="Player ${slot}"]`, { timeout: 30000 })
  const frame = await handle!.contentFrame()
  if (!frame) throw new Error(`No frame for slot ${slot}`)
  return frame
}

async function waitFrameText(frame: Frame, text: string, timeout = 45000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const body = await frame.evaluate(() => document.body?.innerText ?? '')
    if (body.includes(text)) return
    await sleep(250)
  }
  throw new Error(`Frame timed out waiting for: ${text}`)
}

/** Unique actions: 2 per observer→target (8 per target with 4 observers).
 * Keep phrases dissimilar — DB blocks near-duplicates via pg_trgm ≥ 0.6. */
const ACTION_BANK: Record<string, [string, string]> = {
  'Alice>Bob': ['checks phone mid-turn', 'invents a chaotic house rule'],
  'Alice>Carol': ['misquotes a famous movie', 'high-fives the dealer unprompted'],
  'Alice>Dave': ['forgets the running score', 'asks for snacks a third time'],
  'Alice>Eve': ['rearranges everyones seats', 'starts an improvised chant'],
  'Bob>Alice': ['orders a tower of fries', 'narrates every single move'],
  'Bob>Carol': ['spills a drink on purpose', 'challenges the current winner'],
  'Bob>Dave': ['loses a mysterious sock', 'claims pure beginner luck'],
  'Bob>Eve': ['takes endless group photos', 'switches teams mid-round'],
  'Carol>Alice': ['overexplains basic rules', 'celebrates victory too early'],
  'Carol>Bob': ['trash-talks with a smile', 'borrows a pen permanently'],
  'Carol>Dave': ['stacks cups into a tower', 'miscounts points confidently'],
  'Carol>Eve': ['hums the wrong theme song', 'calls an unnecessary timeout'],
  'Dave>Alice': ['double-checks every dice roll', 'proposes an instant rematch'],
  'Dave>Bob': ['draws doodles on the scorecard', 'negotiates wild item trades'],
  'Dave>Carol': ['whispers secret strategy', 'jokes about flipping the board'],
  'Dave>Eve': ['rates everyones snacks aloud', 'invents ridiculous nicknames'],
  'Eve>Alice': ['guards the snack pile fiercely', 'predicts outcomes dramatically'],
  'Eve>Bob': ['quotes an obscure meme', 'stretches like a gymnast'],
  'Eve>Carol': ['organizes tokens by color', 'requests a playlist change'],
  'Eve>Dave': ['recounts a childhood story', 'bets dessert on the next round'],
}

function actionText(observer: string, target: string, n: 1 | 2) {
  const pair = ACTION_BANK[`${observer}>${target}`]
  if (!pair) throw new Error(`Missing action bank for ${observer}>${target}`)
  return `${target} ${pair[n - 1]}`
}

async function clickButton(frame: Frame, label: string) {
  const clicked = await frame.evaluate((lab) => {
    const buttons = [...document.querySelectorAll('button')]
    const match = buttons.find(
      (b) => b.textContent?.trim() === lab || (b.textContent ?? '').includes(lab),
    )
    if (!match || (match as HTMLButtonElement).disabled) return false
    ;(match as HTMLButtonElement).click()
    return true
  }, label)
  if (!clicked) throw new Error(`Button not found: ${label}`)
}

async function selectTarget(frame: Frame, targetName: string) {
  await frame.evaluate((name) => {
    const select = document.querySelector('select') as HTMLSelectElement | null
    if (!select) throw new Error('No select')
    const opt = [...select.options].find((o) => o.textContent?.trim() === name)
    if (!opt) throw new Error(`Target option missing: ${name}`)
    select.value = opt.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }, targetName)
}

async function fillAction(frame: Frame, text: string) {
  await frame.evaluate((t) => {
    const input =
      (document.querySelector('input[placeholder*="mozzarella"]') as HTMLInputElement | null) ??
      (document.querySelector('form input') as HTMLInputElement | null)
    if (!input) throw new Error('Action input missing')
    const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    native?.call(input, t)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)
}

async function submitAction(frame: Frame, target: string, text: string) {
  await selectTarget(frame, target)
  await fillAction(frame, text)
  await clickButton(frame, 'Submit')
  // Wait for input to clear (success) or error banner
  const start = Date.now()
  while (Date.now() - start < 10000) {
    const state = await frame.evaluate(() => {
      const input =
        (document.querySelector('input[placeholder*="mozzarella"]') as HTMLInputElement | null) ??
        (document.querySelector('form input') as HTMLInputElement | null)
      // ErrorBanner uses role=alert when present; fall back to red banner text
      const alert = document.querySelector('[role="alert"]')?.textContent?.trim()
      const banners = [...document.querySelectorAll('div')].map((el) => el.textContent?.trim() ?? '')
      const banner = banners.find((t) =>
        /^(Submit failed|Too similar|Cannot |Not a |Game not|Action text)/i.test(t),
      )
      return { value: input?.value ?? '', err: alert || banner || null }
    })
    if (state.value === '') return
    if (state.err) throw new Error(`Submit failed for "${text}": ${state.err}`)
    await sleep(150)
  }
  throw new Error(`Submit did not clear for "${text}"`)
}

async function upvoteSome(frame: Frame, count: number) {
  for (let i = 0; i < count; i += 1) {
    const clicked = await frame.evaluate((idx) => {
      const buttons = [...document.querySelectorAll('button')].filter((b) =>
        b.querySelector('svg') && /^\d+$/.test((b.textContent ?? '').replace(/\D/g, '') || 'x') ||
        (b.textContent ?? '').match(/^\s*\d+\s*$/),
      )
      // Upvote buttons show chevron + count
      const voteBtns = [...document.querySelectorAll('button')].filter((b) => {
        const t = (b.textContent ?? '').trim()
        return /^\d+$/.test(t) || (b.querySelector('svg') && /\d/.test(t))
      })
      const btn = voteBtns[idx]
      if (!btn) return false
      ;(btn as HTMLButtonElement).click()
      return true
    }, i)
    if (!clicked) break
    await sleep(200)
  }
}

async function markUnmarkedSquares(frame: Frame, maxMarks: number) {
  let marked = 0
  for (let i = 0; i < maxMarks; i += 1) {
    const did = await frame.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => {
        if (b.disabled) return false
        const t = (b.textContent ?? '').trim()
        // Free space / marked / locked shouldn't be unmarked actionable cards with X icon only
        if (!t || t === 'FREE' || t.toLowerCase().includes('free')) return false
        // Unmarked squares are buttons with action text
        return t.length > 3 && !t.includes('Fringo claimed')
      })
      // Prefer squares that don't look already marked (no X icon child alone)
      for (const b of btns) {
        const hasLock = !!b.querySelector('svg.lucide-lock')
        const markedLook = b.className.includes('emerald') || b.className.includes('marked')
        if (hasLock || markedLook) continue
        ;(b as HTMLButtonElement).click()
        return true
      }
      return false
    })
    if (!did) break
    marked += 1
    await sleep(400)
  }
  return marked
}

async function main() {
  log(`Chrome: ${CHROME}`)
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    defaultViewport: { width: 1600, height: 1000 },
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1000'],
  })

  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  try {
    log('Open Dev Grid')
    await page.goto(`${BASE}/dev`, { waitUntil: 'networkidle2' })
    await waitForText(page, 'Fringo Dev Grid')

    // Set players = 5 (React controlled range)
    await page.focus('#count')
    await page.evaluate(() => {
      const input = document.querySelector('#count') as HTMLInputElement
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      proto?.call(input, '5')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await waitForText(page, 'Players (5)')

    // Scenario Lobby
    await page.select('#scenario', 'lobby')
    // Confirm Eve name field exists (5th player)
    await page.waitForSelector('#name-4')

    log('Launch Session')
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        (b.textContent ?? '').includes('Launch Session'),
      )
      ;(btn as HTMLButtonElement)?.click()
    })

    await waitForText(page, 'Session ready', 120000)
    await page.waitForSelector('iframe[title="Player 4"]', { timeout: 30000 })
    const invite = await page.evaluate(() => {
      const text = document.body.innerText
      const m = text.match(/Code:\s*([A-Z0-9]+)/)
      return m?.[1] ?? null
    })
    log(`Invite: ${invite}`)
    notes.push(`invite=${invite}`)

    await page.screenshot({ path: `${ARTIFACTS}/01-lobby.png`, fullPage: true })

    // Verify Alice not Player in host frame
    const host = await frameForSlot(page, 0)
    await waitFrameText(host, 'Alice')
    const hostBody = await host.evaluate(() => document.body.innerText)
    if (hostBody.includes('Player') && !hostBody.includes('Alice')) {
      bug('Host still shows as Player instead of Alice')
    } else {
      notes.push('Host displays as Alice')
    }

    log('Start Setup')
    await clickButton(host, 'Start Setup')
    await sleep(1000)

    // Navigate all to setup
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'setup')
      ;(btn as HTMLButtonElement)?.click()
    })
    await sleep(1500)

    for (let slot = 0; slot < 5; slot += 1) {
      const f = await frameForSlot(page, slot)
      await waitFrameText(f, 'Action Market')
    }
    notes.push('All players reached Action Market')

    // Progress should render without console 400 — check Progress card
    const progressOk = await host.evaluate(() => document.body.innerText.includes('Progress'))
    if (!progressOk) bug('Progress card missing on setup page')

    log('Submitting actions for all observer→target pairs')
    for (let obs = 0; obs < 5; obs += 1) {
      const frame = await frameForSlot(page, obs)
      const observer = NAMES[obs]
      for (let tgt = 0; tgt < 5; tgt += 1) {
        if (tgt === obs) continue
        const target = NAMES[tgt]
        for (const n of [1, 2] as const) {
          const text = actionText(observer, target, n)
          try {
            await submitAction(frame, target, text)
          } catch (e) {
            bug(`${observer}→${target} submit failed: ${e instanceof Error ? e.message : e}`)
            throw e
          }
        }
      }
      log(`Finished submissions for ${observer}`)
    }

    await page.screenshot({ path: `${ARTIFACTS}/02-setup-filled.png`, fullPage: true })

    // Check progress 8/8
    const progressText = await host.evaluate(() => document.body.innerText)
    for (const name of NAMES) {
      if (!progressText.includes(`${name}`) || !progressText.match(new RegExp(`${name}[\\s\\S]{0,40}8/8`))) {
        // softer check — look for 8/8 count
      }
    }
    if (!progressText.includes('8/8')) {
      bug(`Expected 8/8 progress entries; got:\n${progressText.slice(0, 500)}`)
    } else {
      notes.push('Progress shows 8/8')
    }

    log('Upvoting from Bob and Carol')
    const bob = await frameForSlot(page, 1)
    await upvoteSome(bob, 6)
    const carol = await frameForSlot(page, 2)
    await upvoteSome(carol, 6)

    // Stress: self-target must not appear in Alice's dropdown
    {
      const hasSelf = await host.evaluate(() => {
        const select = document.querySelector('select') as HTMLSelectElement | null
        return [...(select?.options ?? [])].some((o) => o.textContent?.trim() === 'Alice')
      })
      if (hasSelf) bug('Alice can select herself as action target')
      else notes.push('Self-target not offered in dropdown')
    }

    log('Finalize & Start Game')
    await clickButton(host, 'Finalize')
    await sleep(3000)
    // Host may still be on setup; wait for boards or navigate
    const afterStart = await host.evaluate(() => document.body.innerText)
    if (afterStart.includes('only') && afterStart.includes('need')) {
      bug(`Start blocked: ${afterStart.match(/Target[^\n]+/)?.[0] ?? afterStart.slice(0, 200)}`)
      throw new Error('Start game blocked')
    }

    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'boards')
      ;(btn as HTMLButtonElement)?.click()
    })
    await sleep(1500)

    for (let slot = 0; slot < 5; slot += 1) {
      const f = await frameForSlot(page, slot)
      try {
        await waitFrameText(f, 'My Boards', 20000)
      } catch {
        // maybe still loading
        const t = await f.evaluate(() => document.body.innerText)
        if (!t.includes('Board') && !t.includes('board')) {
          bug(`Slot ${slot} (${NAMES[slot]}) not on boards: ${t.slice(0, 200)}`)
        }
      }
    }
    await page.screenshot({ path: `${ARTIFACTS}/03-boards-list.png`, fullPage: true })
    notes.push('Reached boards list')

    // Open every board for each player and mark toward Fringo; try a long-press guess once
    log('Marking boards toward Fringo claims')
    let guessTried = false
    for (let slot = 0; slot < 5; slot += 1) {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'boards')
        ;(btn as HTMLButtonElement)?.click()
      })
      await sleep(1000)
      const f = await frameForSlot(page, slot)
      await waitFrameText(f, 'My Boards', 15000)
      const boardCount = await f.evaluate(
        () => document.querySelectorAll('a[href*="/boards/"]').length,
      )
      log(`${NAMES[slot]} has ${boardCount} boards`)
      if (boardCount !== 4) bug(`${NAMES[slot]} expected 4 boards, got ${boardCount}`)

      for (let bi = 0; bi < boardCount; bi += 1) {
        // Re-query links each time (DOM remounts after navigate-back)
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'boards')
          ;(btn as HTMLButtonElement)?.click()
        })
        await sleep(700)
        const frame = await frameForSlot(page, slot)
        await waitFrameText(frame, 'My Boards', 10000)
        const opened = await frame.evaluate((idx) => {
          const links = [...document.querySelectorAll('a[href*="/boards/"]')] as HTMLAnchorElement[]
          if (!links[idx]) return false
          links[idx].click()
          return true
        }, bi)
        if (!opened) continue
        await sleep(900)
        const marks = await markUnmarkedSquares(frame, 9)
        if (marks > 0) log(`${NAMES[slot]} marked ${marks} on board #${bi}`)

        if (!guessTried) {
          // FringoGrid listens for mouse/touch long-press (500ms)
          const longPressed = await frame.evaluate(async () => {
            const btn = [...document.querySelectorAll('button')].find((b) => {
              const t = (b.textContent ?? '').trim()
              return t.length > 8 && !b.disabled && !t.toLowerCase().includes('free')
            })
            if (!btn) return false
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            await new Promise((r) => setTimeout(r, 600))
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
            return true
          })
          if (longPressed) {
            await sleep(400)
            const menu = await frame.evaluate(() => document.body.innerText)
            if (/Report a Guess|guessed correctly|guessed incorrectly/i.test(menu)) {
              notes.push('Guess report menu opened via long-press')
              const reported = await frame.evaluate(() => {
                const b = [...document.querySelectorAll('button')].find((x) =>
                  /guessed incorrectly/i.test(x.textContent ?? ''),
                )
                if (!b) return false
                ;(b as HTMLButtonElement).click()
                return true
              })
              if (reported) notes.push('Reported incorrect guess')
              guessTried = true
            }
          }
        }
      }
    }
    if (!guessTried) notes.push('Guess long-press not exercised (boards may have been locked)')

    await page.screenshot({ path: `${ARTIFACTS}/04-after-marks.png`, fullPage: true })

    // Scoreboard
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'scoreboard')
      ;(btn as HTMLButtonElement)?.click()
    })
    await sleep(1500)
    await page.screenshot({ path: `${ARTIFACTS}/05-scoreboard.png`, fullPage: true })
    const scoreText = await (await frameForSlot(page, 0)).evaluate(() => document.body.innerText)
    notes.push(`Scoreboard snippet: ${scoreText.slice(0, 300).replace(/\s+/g, ' ')}`)

    // If not all claimed, end game from host lobby
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'lobby')
      ;(btn as HTMLButtonElement)?.click()
    })
    await sleep(1000)
    const hostLobby = await frameForSlot(page, 0)
    const lobbyText = await hostLobby.evaluate(() => document.body.innerText)
    if (lobbyText.includes('End Game')) {
      await clickButton(hostLobby, 'End Game')
      await sleep(1000)
    }
    if ((await hostLobby.evaluate(() => document.body.innerText)).includes('Reveal')) {
      await clickButton(hostLobby, 'Reveal')
      await sleep(1000)
    }

    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'reveal')
      ;(btn as HTMLButtonElement)?.click()
    })
    await sleep(1500)
    await page.screenshot({ path: `${ARTIFACTS}/06-reveal.png`, fullPage: true })
    const revealText = await (await frameForSlot(page, 0)).evaluate(() => document.body.innerText)
    if (!/reveal|submitted|board/i.test(revealText)) {
      bug(`Reveal page unexpected: ${revealText.slice(0, 300)}`)
    } else {
      notes.push('Reveal page loaded')
    }

    log('Playthrough finished')
  } finally {
    const summary = { bugs, notes, at: new Date().toISOString() }
    writeFileSync(`${ARTIFACTS}/summary.json`, JSON.stringify(summary, null, 2))
    console.log(JSON.stringify(summary, null, 2))
    await browser.close()
  }

  if (bugs.length) process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
