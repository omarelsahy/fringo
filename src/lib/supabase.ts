import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase env vars. Copy .env.example to .env and run `supabase start`.')
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'http://127.0.0.1:54321',
  supabaseAnonKey ?? 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    },
  },
)

let signInFlight: Promise<void> | null = null

export function resetAuthReady() {
  signInFlight = null
}

export async function ensureAnonymousAuth(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return

  if (!signInFlight) {
    signInFlight = (async () => {
      try {
        const { error } = await supabase.auth.signInAnonymously()
        if (error) throw error
      } finally {
        signInFlight = null
      }
    })()
  }

  return signInFlight
}

export async function getCurrentUserId(): Promise<string | null> {
  await ensureAnonymousAuth()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}
