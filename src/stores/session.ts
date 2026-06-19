import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SessionState {
  displayName: string
  lastGameId: string | null
  setDisplayName: (name: string) => void
  setLastGameId: (id: string | null) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      displayName: '',
      lastGameId: null,
      setDisplayName: (displayName) => set({ displayName }),
      setLastGameId: (lastGameId) => set({ lastGameId }),
    }),
    { name: 'fringo-session' },
  ),
)
