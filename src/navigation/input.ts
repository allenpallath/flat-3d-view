// OWNER: Navigation agent (A3). Mutable input shared between DOM controls and the in-canvas Navigation.

/** Touch joystick (-1..1, y up = forward) and accumulated look deltas (degrees). */
export const touchInput = { moveX: 0, moveY: 0, lookYaw: 0, lookPitch: 0 }

/** Other modules (e.g. a furniture drag tool) can block drag-to-look while they handle a drag. */
let lookBlocked = false
export const setLookBlocked = (b: boolean) => {
  lookBlocked = b
}
export const isLookBlocked = () => lookBlocked

export const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export const isTouchDevice = () => {
  if (typeof window === 'undefined') return false
  if (/[?&]touch=1/.test(window.location.search)) return true
  return (window.matchMedia?.('(pointer: coarse)').matches ?? false) || 'ontouchstart' in window
}
