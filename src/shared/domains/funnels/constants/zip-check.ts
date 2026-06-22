/**
 * ZIP-step "checking your area" presentation config. The ZIP is already
 * resolved live (during input) before the checklist mounts, so these are pure
 * pacing values for the anticipation beat.
 */

/** One label per checklist line. */
export const CHECK_STEPS = [
  'Locating your ZIP…',
  'Checking service radius…',
  'Confirming crew availability…',
  'Reserving your area…',
]

/**
 * Per-step cadence (ms) — one entry per CHECK_STEPS line. Varied (not a flat
 * tick) so the sequence breathes, with the final step lingering to build
 * anticipation. Totals ~3550ms (vs the old flat 1800ms).
 */
export const CHECK_DURATIONS = [500, 950, 700, 1400]

/** Debounce before firing a live resolve on a valid in-area ZIP. */
export const RESOLVE_DEBOUNCE_MS = 350
