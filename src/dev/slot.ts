/** Player slot from ?slot=N — isolates storage when multiple views share an origin. */
const ACTIVE_SLOT_KEY = 'fringo-dev-active-slot'

export function getDevSlot(): string | null {
  if (!import.meta.env.DEV) return null
  if (typeof window === 'undefined') return null
  const fromUrl = new URLSearchParams(window.location.search).get('slot')
  if (fromUrl !== null && fromUrl !== '') {
    sessionStorage.setItem(ACTIVE_SLOT_KEY, fromUrl)
    return fromUrl
  }
  return sessionStorage.getItem(ACTIVE_SLOT_KEY)
}

export function devStorageKey(key: string): string {
  const slot = getDevSlot()
  return slot !== null ? `fringo-dev-slot-${slot}-${key}` : key
}

export function devSessionPersistName(): string {
  const slot = getDevSlot()
  return slot !== null ? `fringo-session-slot-${slot}` : 'fringo-session'
}

/** Keep ?slot=N when navigating inside dev launcher iframes. */
export function preserveDevSlotUrl(pathname: string): string {
  const slot = getDevSlot()
  if (slot === null) return pathname
  const joiner = pathname.includes('?') ? '&' : '?'
  return `${pathname}${joiner}slot=${slot}`
}
