import { getDevSlot } from '@/dev/slot'

export type JoinSearch = {
  fresh: boolean
  code: string | undefined
  name: string | undefined
  auto: boolean
}

/** Default search params for `/join` links and navigations. */
export function joinSearch(overrides: Partial<JoinSearch> = {}): JoinSearch {
  return {
    fresh: overrides.fresh ?? false,
    code: overrides.code,
    name: overrides.name,
    auto: overrides.auto ?? false,
  }
}

export type GameSearch = {
  slot: number | undefined
}

/** Default search params for `/game/$gameId/*` links and navigations. */
export function gameSearch(overrides: Partial<GameSearch> = {}): GameSearch {
  if (overrides.slot !== undefined) {
    return { slot: overrides.slot }
  }
  const slot = getDevSlot()
  return { slot: slot !== null ? Number(slot) : undefined }
}
