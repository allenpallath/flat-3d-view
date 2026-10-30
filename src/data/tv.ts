// TV sizing shared by the furniture catalog (wall-TV items) and the electrical TV-point planner.

/** Standard 16:9 TV sizes offered in the app (diagonal, inches). */
export const TV_SIZES = [43, 50, 55, 65, 75] as const

/** Default height (cm) of a wall TV's centre above the floor (about seated eye level). */
export const TV_CENTRE_CM = 110

/** 16:9 panel size (cm) for a diagonal in inches: screen plus ~1 cm bezel on each side. `diag` is the screen diagonal. */
export function tvPanelCm(inches: number) {
  const diag = inches * 2.54
  const k = Math.hypot(16, 9) // diagonal of a 16:9 rectangle
  return { w: (diag * 16) / k + 2, h: (diag * 9) / k + 2, diag }
}
