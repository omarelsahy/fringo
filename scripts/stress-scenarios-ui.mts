import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
const CHROME = ['/usr/bin/google-chrome-stable','/usr/bin/google-chrome'].find(existsSync)!
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false,
  args: ['--no-sandbox','--disable-gpu',`--user-data-dir=/tmp/fringo-stress-chrome`],
  defaultViewport: { width: 1400, height: 900 },
})
const page = await browser.newPage()
const results: string[] = []
for (const scenario of ['setup-seeded', 'active', 'reveal'] as const) {
  await page.goto('http://localhost:5173/dev', { waitUntil: 'networkidle2' })
  await page.focus('#count')
  await page.evaluate(() => {
    const input = document.querySelector('#count') as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set?.call(input,'3')
    input.dispatchEvent(new Event('input',{bubbles:true}))
  })
  await page.select('#scenario', scenario)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('Launch Session'))
    ;(btn as HTMLButtonElement).click()
  })
  await page.waitForFunction(() => {
    const t = document.body.innerText
    return t.includes('Session ready') || t.includes('Timed out') || t.includes('failed')
  }, { timeout: 120000 })
  const text = await page.evaluate(() => document.body.innerText)
  const ok = text.includes('Session ready')
  results.push(`${scenario}: ${ok ? 'OK' : 'FAIL'}`)
  console.log(results[results.length-1])
  if (!ok) {
    await page.screenshot({ path: `/opt/cursor/artifacts/playthrough/stress-${scenario}-fail.png`, fullPage: true })
    throw new Error(results.join('\n'))
  }
}
console.log('ALL_SCENARIOS_OK')
await browser.close()
