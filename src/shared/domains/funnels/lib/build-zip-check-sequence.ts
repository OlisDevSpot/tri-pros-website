/** Inputs the zip-check anticipation beat interpolates into its lines. */
export interface ZipCheckInput {
  zip: string
  /** Resolved city (falls back to "your area" when absent). */
  city: string
  /** Trade noun for the crew line, e.g. "Kitchen Renovation". */
  trade: string
}

/** One checklist line + how long it dwells before completing. */
export interface ZipCheckTick { label: string, duration: number }

// Cadence bands (ms). Earlier ticks are brisk; the final tick lingers to build
// anticipation before the "qualified" reveal. Each duration is random within its
// band on every run, so the sequence feels live rather than mechanical.
const EARLY_MIN = 450
const EARLY_MAX = 950
const FINAL_MIN = 1100
const FINAL_MAX = 1600

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/**
 * Build the "checking your area" checklist dynamically from what the form
 * already knows (zip, resolved city, trade). The ZIP is resolved BEFORE this
 * runs, so the lines are pure anticipation — labels reflect real context and
 * durations are random with the final tick lingering. Impure (random): call
 * ONCE per mount (the engine does so via a `useState` initializer) so the
 * cadence is fixed for the life of the checklist.
 */
export function buildZipCheckSequence(input: ZipCheckInput): ZipCheckTick[] {
  const { zip, city, trade } = input
  const place = city || 'your area'
  const labels = [
    `Locating ${zip}…`,
    `Checking service radius near ${place}…`,
    `Confirming ${trade} crew availability…`,
    `Reserving your spot in ${place}…`,
  ]
  const lastIndex = labels.length - 1
  return labels.map((label, i) => ({
    label,
    duration: i === lastIndex ? randInt(FINAL_MIN, FINAL_MAX) : randInt(EARLY_MIN, EARLY_MAX),
  }))
}
