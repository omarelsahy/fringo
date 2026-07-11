import type { DevScenario } from '../../../src/dev/scenarios'

export type DevPlayerReadyPayload = {
  slot: number
  gameId: string
  inviteCode: string
  displayName: string
  role: 'host' | 'player'
}

export type SessionConfig = {
  baseUrl: string
  playerCount: number
  names: string[]
  scenario: DevScenario
}

export type LauncherStatus = {
  message: string
  gameId?: string | null
  inviteCode?: string | null
  readyCount?: number
  playerCount?: number
  error?: boolean
}
