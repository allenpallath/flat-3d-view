// Input plumbing shared between DOM controls and the in-canvas camera rigs: the touch joystick /
// look-pad values (mutable, read every frame by Navigation) and small keyboard / device checks.

/** Touch joystick (-1..1, y up = forward) and accumulated look deltas (degrees). */
export const touchInput = { moveX: 0, moveY: 0, lookYaw: 0, lookPitch: 0 }

/** True if a key event comes from a text field, so global shortcuts must ignore it. */
export const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Touch-first device (coarse pointer or touch events); `?touch=1` forces it for testing. */
export const isTouchDevice = () => {
  if (typeof window === 'undefined') return false
  if (/[?&]touch=1/.test(window.location.search)) return true
  return (window.matchMedia?.('(pointer: coarse)').matches ?? false) || 'ontouchstart' in window
}
