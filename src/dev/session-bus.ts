export interface DevPlayerReadyPayload {
  slot: number
  gameId: string
  inviteCode: string
  displayName: string
  role: 'host' | 'player'
}

type SessionState = {
  ready: DevPlayerReadyPayload[]
}

const sessions = new Map<string, SessionState>()

function getSession(launchId: string): SessionState {
  let session = sessions.get(launchId)
  if (!session) {
    session = { ready: [] }
    sessions.set(launchId, session)
  }
  return session
}

export function registerPlayerReady(launchId: string, payload: DevPlayerReadyPayload) {
  const session = getSession(launchId)
  const existing = session.ready.find((entry) => entry.slot === payload.slot)
  if (existing) {
    Object.assign(existing, payload)
    return
  }
  session.ready.push(payload)
}

export function getPlayerReadyState(launchId: string): DevPlayerReadyPayload[] {
  return sessions.get(launchId)?.ready ?? []
}

export function clearPlayerReadySession(launchId: string) {
  sessions.delete(launchId)
}
