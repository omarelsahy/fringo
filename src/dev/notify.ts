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
  const message = { type: 'fringo-dev-player-ready', ...payload }
  window.fringoDev?.playerReady(payload)
  // Broadcast to parent and top — Electron BrowserWindow + iframe nesting
  // can make `parent` alone unreliable.
  try {
    window.parent?.postMessage(message, '*')
  } catch {
    /* ignore */
  }
  try {
    if (window.top && window.top !== window.parent) {
      window.top.postMessage(message, '*')
    }
  } catch {
    /* ignore */
  }

  if (launchId) {
    const post = () =>
      fetch(`${window.location.origin}/dev/api/player-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchId, ...payload }),
      })

    void post()
      .catch(() => post())
      .catch(() => {
        // postMessage remains a fallback path for same-origin parents
      })
  }
}
