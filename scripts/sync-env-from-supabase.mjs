import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const status = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const get = (key) => {
  const match = status.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'))
  return match?.[1]
}

const url = get('API_URL')
const anon = get('ANON_KEY')
const service = get('SERVICE_ROLE_KEY')

if (!url || !anon || !service) {
  console.error('[ERROR] Could not read Supabase keys. Is local Supabase running?')
  process.exit(1)
}

const envPath = '.env'
let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''

function setVar(name, value) {
  const line = `${name}=${value}`
  const pattern = new RegExp(`^${name}=.*$`, 'm')
  content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`
}

setVar('VITE_SUPABASE_URL', url)
setVar('VITE_SUPABASE_ANON_KEY', anon)
setVar('SUPABASE_SERVICE_ROLE_KEY', service)

if (!content.endsWith('\n')) content += '\n'
writeFileSync(envPath, content)
console.log('[OK] Synced .env from local Supabase')
