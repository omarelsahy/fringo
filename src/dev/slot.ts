/** Player slot from ?slot=N — isolates storage when multiple views share an origin. */
export function getDevSlot(): string | null {
  if (typeof window === 'undefined') return null
  const slot = new URLSearchParams(window.location.search).get('slot')
  return slot !== null && slot !== '' ? slot : null
}

export function devStorageKey(key: string): string {
  const slot = getDevSlot()
  return slot !== null ? `fringo-dev-slot-${slot}-${key}` : key
}

export function devSessionPersistName(): string {
  const slot = getDevSlot()
  return slot !== null ? `fringo-session-slot-${slot}` : 'fringo-session'
}
