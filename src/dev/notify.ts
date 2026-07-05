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

export function notifyPlayerReady(payload: DevPlayerReadyPayload) {
  window.fringoDev?.playerReady(payload)
  window.parent.postMessage({ type: 'fringo-dev-player-ready', ...payload }, '*')
}
