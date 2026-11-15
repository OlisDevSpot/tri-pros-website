import type { DrawnHvac } from '@/features/trade-scenes/types'
import type { HvacIndoorLocation } from '@/shared/modules/construction/core/constants/enums'

// What heating & cooling's view looks at: the system that does the home's work on the side on show.
export type HvacFocus
  = | { kind: 'indoor', location: HvacIndoorLocation }
    | { kind: 'package' }
    | { kind: 'mini-split-head' }
    | { kind: 'wall-unit' }
    | { kind: 'window-unit' }

// An indoor unit takes the view from whatever it leaves idle. Every home type draws one of these, so a home with none of the
// others is a portable home, at its window unit.
export function hvacFocusOf(drawn: DrawnHvac): HvacFocus {
  if (drawn.indoor !== null) {
    return { kind: 'indoor', location: drawn.indoor.location }
  }
  if (drawn.packageUnit !== null) {
    return { kind: 'package' }
  }
  if (drawn.miniSplit !== null && !drawn.miniSplit.idle) {
    return { kind: 'mini-split-head' }
  }
  if (drawn.wallUnit !== null) {
    return { kind: 'wall-unit' }
  }
  return { kind: 'window-unit' }
}
