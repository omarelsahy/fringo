export interface DevPlayerReadyPayload {
  slot: number
  gameId: string
  inviteCode: string
  displayName: string
  role: 'host' | 'player'
}

declare global {
  interface Window {
    fringoDev?: {
      playerReady: (payload: DevPlayerReadyPayload) => void
    }
  }
}

export function notifyPlayerReady(payload: DevPlayerReadyPayload, launchId?: string) {
  window.fringoDev?.playerReady(payload)
  window.parent.postMessage({ type: 'fringo-dev-player-ready', ...payload }, '*')

  if (launchId) {
    void fetch(`${window.location.origin}/dev/api/player-ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launchId, ...payload }),
    }).catch(() => {
      // postMessage remains the primary path for same-origin parents
    })
  }
}
